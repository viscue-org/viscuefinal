import test from 'node:test';
import assert from 'node:assert/strict';
import { BedrockGateway } from '../lib/bedrock.mjs';

const routes = {
  imagePrimary: 'qwen.qwen3-vl-235b-a22b',
  imageFallback: 'amazon.nova-pro-v1:0',
  videoPrimary: 'amazon.nova-pro-v1:0',
  videoFallback: 'amazon.nova-lite-v1:0',
  relevance: 'amazon.titan-embed-image-v1',
  compiler: 'mistral.test',
};

function converse(text) {
  return { status: 200, body: JSON.stringify({ output: { message: { content: [{ text }] } } }) };
}

test('invalid Qwen evidence retries once and then degrades to Nova image evidence', async () => {
  const calls = [];
  const responses = [converse('not-json'), converse('{bad'), converse('{"claims":[{"type":"object","value":"shoe","confidence":0.8}]}')];
  const gateway = new BedrockGateway({ region: 'us-east-1', routes, request: async input => { calls.push(input); return responses.shift(); } });
  const result = await gateway.analyzeImage({ assetId: 'image_1', dataUrl: 'data:image/jpeg;base64,YQ==', prompt: 'Describe only visible facts.' });
  assert.equal(result.provider, 'nova-pro');
  assert.equal(result.status, 'degraded');
  assert.deepEqual(result.evidence.map(item => item.value), ['shoe']);
  assert.deepEqual(calls.map(call => call.modelId), [routes.imagePrimary, routes.imagePrimary, routes.imageFallback]);
});

test('video analysis uses Nova and preserves explicit degraded fallback provenance', async () => {
  const calls = [];
  const gateway = new BedrockGateway({ region: 'us-east-1', routes, request: async input => {
    calls.push(input);
    if (input.modelId === routes.videoPrimary) throw new Error('primary unavailable');
    return converse('{"claims":[]}');
  } });
  const result = await gateway.analyzeVideo({ assetId: 'video_1', dataUrl: 'data:video/mp4;base64,YQ==' });
  assert.equal(result.provider, 'nova-lite');
  assert.equal(result.status, 'degraded');
  assert.deepEqual(calls.map(call => call.modelId), [routes.videoPrimary, routes.videoFallback]);
});

test('Titan embedding failure is normalized without leaking provider response bodies', async () => {
  const gateway = new BedrockGateway({ region: 'us-east-1', routes, request: async () => { throw new Error('secret upstream body'); } });
  await assert.rejects(() => gateway.embedReference({ text: 'red shoe' }), /Titan relevance unavailable/);
});

test('compiler output is accepted only when every canonical protected fact survives', async () => {
  const gateway = new BedrockGateway({ region: 'us-east-1', routes, request: async () => converse('Shorter wording with no required filename.') });
  const canonical = { prompt: 'Use “Exact.png”.', protectedFacts: [{ id: 'name:a', text: 'Exact.png' }], excluded: [] };
  const result = await gateway.compilePrompt(canonical);
  assert.equal(result.status, 'degraded');
  assert.equal(result.text, canonical.prompt);
  assert.deepEqual(result.warning.missing, ['name:a']);
});
