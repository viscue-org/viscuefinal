import test from 'node:test';
import assert from 'node:assert/strict';
import { BedrockGateway } from '../lib/bedrock.mjs';
import { MODEL_ROUTES, resolveModelRoutes } from '../lib/contracts.mjs';

const routes = {
  imagePrimary: 'us.amazon.nova-lite-v1:0',
  imageFallback: 'us.amazon.nova-pro-v1:0',
  videoPrimary: 'us.amazon.nova-pro-v1:0',
  videoFallback: 'us.amazon.nova-lite-v1:0',
  relevance: 'amazon.titan-embed-image-v1',
  compiler: 'mistral.ministral-3-8b-instruct',
};

function converse(text) {
  return { status: 200, body: JSON.stringify({ output: { message: { content: [{ text }] } } }) };
}

test('production defaults route still images through US Nova Lite and compile with Ministral 8B', () => {
  assert.equal(MODEL_ROUTES.imagePrimary, 'us.amazon.nova-lite-v1:0');
  assert.equal(MODEL_ROUTES.imageFallback, 'us.amazon.nova-pro-v1:0');
  assert.equal(MODEL_ROUTES.compiler, 'mistral.ministral-3-8b-instruct');
});

test('runtime model resolution uses provider-neutral overrides and ignores stale provider-specific variables', () => {
  const resolved = resolveModelRoutes({
    IMAGE_MODEL_ID: 'us.amazon.nova-lite-v1:0',
    PROMPT_MODEL_ID: 'mistral.ministral-3-8b-instruct',
    QWEN_MODEL_ID: 'qwen.old-model',
    BEDROCK_MODEL_ID: 'mistral.old-large-model',
    NOVA_PRO_MODEL_ID: 'amazon.old-nova-pro',
  });

  assert.equal(resolved.imagePrimary, 'us.amazon.nova-lite-v1:0');
  assert.equal(resolved.imageFallback, MODEL_ROUTES.imageFallback);
  assert.equal(resolved.compiler, 'mistral.ministral-3-8b-instruct');
  assert.ok(!Object.values(resolved).some(value => String(value).includes('old')));
});

test('invalid primary evidence falls back once without retrying the same model', async () => {
  const calls = [];
  const responses = [converse('not-json'), converse('{"claims":[{"type":"object","value":"shoe","confidence":0.8}]}')];
  const gateway = new BedrockGateway({ region: 'us-east-1', routes, request: async input => { calls.push(input); return responses.shift(); } });
  const result = await gateway.analyzeImage({ assetId: 'image_1', dataUrl: 'data:image/jpeg;base64,YQ==', prompt: 'Describe only visible facts.' });
  assert.equal(result.provider, 'nova-pro');
  assert.equal(result.status, 'degraded');
  assert.deepEqual(result.evidence.map(item => item.value), ['shoe']);
  assert.deepEqual(calls.map(call => call.modelId), [routes.imagePrimary, routes.imageFallback]);
});

test('placeholder or zero-confidence visual evidence is retried instead of reported as success', async () => {
  const calls = [];
  const responses = [
    converse('{"claims":[{"type":"object","value":"...","confidence":0}]}'),
    converse('{"claims":[{"type":"layout","value":"green logo on a white tile","confidence":0.92}]}'),
  ];
  const gateway = new BedrockGateway({ region: 'us-east-1', routes, request: async input => {
    calls.push(input);
    return responses.shift();
  } });

  const result = await gateway.analyzeImage({ assetId: 'image_1', dataUrl: 'data:image/png;base64,YQ==' });

  assert.equal(result.provider, 'nova-pro');
  assert.equal(result.status, 'degraded');
  assert.deepEqual(result.evidence.map(item => item.value), ['green logo on a white tile']);
  assert.equal(calls.length, 2);
});

test('visual attempts share one short deadline and expose complete failure timing', async () => {
  const calls = [];
  const gateway = new BedrockGateway({
    region: 'us-east-1',
    routes,
    visualTimeoutMs: 3500,
    request: async input => {
      calls.push(input);
      throw new Error('provider unavailable');
    },
  });

  let failure;
  try {
    await gateway.analyzeImage({ assetId: 'image_1', dataUrl: 'data:image/png;base64,YQ==' });
  } catch (error) {
    failure = error;
  }

  assert.ok(failure);
  assert.deepEqual(calls.map(call => call.modelId), [routes.imagePrimary, routes.imageFallback]);
  assert.ok(calls.every(call => Number.isFinite(call.timeoutMs) && call.timeoutMs > 0 && call.timeoutMs <= 3500));
  assert.equal(failure.attempt, 2);
  assert.equal(failure.model, routes.imageFallback);
  assert.equal(failure.fallback_from, routes.imagePrimary);
  assert.equal(typeof failure.duration_ms, 'number');
});

test('compiler and relevance calls receive bounded provider timeouts', async () => {
  const calls = [];
  const gateway = new BedrockGateway({
    region: 'us-east-1',
    routes,
    compilerTimeoutMs: 2500,
    relevanceTimeoutMs: 1200,
    request: async input => {
      calls.push(input);
      if (input.api === 'invoke') return { status: 200, body: JSON.stringify({ embedding: [0.1, 0.2] }) };
      return converse('Use "Exact.png".');
    },
  });

  await gateway.embedReference({ text: 'replace the subject' });
  await gateway.compilePrompt({ prompt: 'Use "Exact.png".', protectedFacts: [{ id: 'name:a', text: 'Exact.png' }], excluded: [] });

  assert.equal(calls.find(call => call.api === 'invoke').timeoutMs, 1200);
  assert.equal(calls.find(call => call.api === 'converse').timeoutMs, 2500);
});

test('visual request prevents Nova from copying schema alternatives as placeholders', async () => {
  let calls = 0;
  const gateway = new BedrockGateway({ region: 'us-east-1', routes: { ...routes, imagePrimary: routes.imageFallback }, request: async input => {
    calls += 1;
    const instruction = input.body.messages[0].content.find(part => part.text)?.text || '';
    const hasConcreteSchema = instruction.includes('Choose exactly one type')
      && instruction.includes('"type":"object"')
      && !instruction.includes('"type":"object|layout|ocr|relation"');
    return hasConcreteSchema
      ? converse('{"claims":[{"type":"object","value":"red logo on a black background","bbox":[0.1,0.1,0.9,0.9],"confidence":0.98}]}')
      : converse('{"claims":[{"type":"object|layout|ocr|relation","value":"...","bbox":null,"confidence":0.0}]}');
  } });

  const result = await gateway.analyzeImage({ assetId: 'image_1', dataUrl: 'data:image/png;base64,YQ==' });

  assert.equal(result.provider, 'nova-pro');
  assert.deepEqual(result.evidence.map(item => item.value), ['red logo on a black background']);
  assert.equal(calls, 1);
});

test('video analysis uses Nova and preserves explicit degraded fallback provenance', async () => {
  const calls = [];
  const gateway = new BedrockGateway({ region: 'us-east-1', routes, request: async input => {
    calls.push(input);
    if (input.modelId === routes.videoPrimary) throw new Error('primary unavailable');
    return converse('{"claims":[{"type":"layout","value":"speaker centered in frame","confidence":0.9}]}');
  } });
  const result = await gateway.analyzeVideo({ assetId: 'video_1', dataUrl: 'data:video/mp4;base64,YQ==' });
  assert.equal(result.provider, 'nova-lite');
  assert.equal(result.status, 'degraded');
  assert.deepEqual(result.evidence.map(item => item.value), ['speaker centered in frame']);
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
