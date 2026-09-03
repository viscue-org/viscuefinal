import test from 'node:test';
import assert from 'node:assert/strict';
import { FontGateway } from '../lib/font-gateway.mjs';

test('unconfigured commercial font provider returns degraded unknown', async () => {
  const result = await new FontGateway({}).identify({ imageBase64: 'YQ==' });
  assert.deepEqual(result, { status: 'degraded', exact_match: null, candidates: [], warning: 'Font provider is not configured.' });
});

test('low-confidence font candidates never become an exact match', async () => {
  const gateway = new FontGateway({
    endpoint: 'https://font.example/identify',
    apiKey: 'configured',
    threshold: 0.9,
    request: async () => ({ ok: true, json: async () => ({ matches: [
      { fontName: 'Maybe Sans', confidence: 0.81, commercial: true },
      { fontName: 'Possible Grotesk', confidence: 0.62, commercial: true },
    ] }) }),
  });
  const result = await gateway.identify({ imageBase64: 'YQ==', recognizedText: 'Hello', topK: 2 });
  assert.equal(result.exact_match, null);
  assert.deepEqual(result.candidates.map(item => item.name), ['Maybe Sans', 'Possible Grotesk']);
});

test('font provider failures remain unknown and never invent a family name', async () => {
  const gateway = new FontGateway({ endpoint: 'https://font.example/identify', apiKey: 'configured', request: async () => { throw new Error('network down'); } });
  const result = await gateway.identify({ imageBase64: 'YQ==' });
  assert.equal(result.status, 'degraded');
  assert.equal(result.exact_match, null);
  assert.match(result.warning, /unavailable/i);
});
