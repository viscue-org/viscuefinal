import test from 'node:test';
import assert from 'node:assert/strict';
import { BedrockGateway } from '../../local-server/lib/bedrock.mjs';
import { MODEL_ROUTES } from '../../local-server/lib/contracts.mjs';
import { normalizeExecutionLedger } from '../../local-server/lib/execution-ledger.mjs';

const routes = {
  imagePrimary: 'qwen.qwen3-vl-235b-a22b',
  imageFallback: 'amazon.nova-pro-v1:0',
  videoPrimary: 'amazon.nova-pro-v1:0',
  videoFallback: 'amazon.nova-lite-v1:0',
  relevance: 'amazon.titan-embed-image-v1',
  compiler: 'mistral.mistral-large-3-675b-instruct',
};

function converseResponse(text) {
  return {
    status: 200,
    body: JSON.stringify({
      output: { message: { content: [{ text }] } },
    }),
  };
}

test('Provider Canaries: Primary visual perception succeeds deterministically', async () => {
  const calls = [];
  const gateway = new BedrockGateway({
    region: 'us-east-1',
    routes,
    request: async (input) => {
      calls.push(input);
      return converseResponse(JSON.stringify({
        claims: [{ type: 'object', value: 'red car', confidence: 0.95 }]
      }));
    },
  });

  const result = await gateway.analyzeImage({
    assetId: 'img-1',
    dataUrl: 'data:image/png;base64,YQ==',
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.provider, 'qwen');
  assert.equal(result.fallback, false);
  assert.equal(result.attempt, 1);
  assert.equal(typeof result.duration_ms, 'number');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].modelId, routes.imagePrimary);

  const ledger = normalizeExecutionLedger([
    {
      name: 'perception.image',
      status: result.status,
      provider: result.provider,
      model: result.model,
      duration_ms: result.duration_ms,
      fallback: result.fallback,
    }
  ]);

  assert.equal(ledger.trust.level, 'ok');
  assert.equal(ledger.stages[0].fallback, false);
});

test('Provider Canaries: Primary visual fails and degrades to fallback model with latency tracking', async () => {
  const calls = [];
  const gateway = new BedrockGateway({
    region: 'us-east-1',
    routes,
    request: async (input) => {
      calls.push(input);
      if (input.modelId === routes.imagePrimary) {
        return converseResponse('Invalid non-json response');
      }
      return converseResponse(JSON.stringify({
        claims: [{ type: 'object', value: 'fallback red car', confidence: 0.88 }]
      }));
    },
  });

  const result = await gateway.analyzeImage({
    assetId: 'img-fallback',
    dataUrl: 'data:image/png;base64,YQ==',
  });

  assert.equal(result.status, 'degraded');
  assert.equal(result.provider, 'nova-pro');
  assert.equal(result.fallback, true);
  assert.equal(result.fallback_from, routes.imagePrimary);
  assert.equal(typeof result.duration_ms, 'number');

  const ledger = normalizeExecutionLedger([
    {
      name: 'perception.image',
      status: result.status,
      provider: result.provider,
      model: result.model,
      duration_ms: result.duration_ms,
      fallback: result.fallback,
      fallback_from: result.fallback_from,
    }
  ]);

  assert.equal(ledger.trust.level, 'fallback');
  assert.match(ledger.trust.message, /fallback/i);
  assert.equal(ledger.stages[0].fallback, true);
  assert.equal(ledger.stages[0].fallback_from, routes.imagePrimary);
});

test('Provider Canaries: Video perception routes to Nova Lite on primary failure', async () => {
  const calls = [];
  const gateway = new BedrockGateway({
    region: 'us-east-1',
    routes,
    request: async (input) => {
      calls.push(input);
      if (input.modelId === routes.videoPrimary) {
        throw new Error('Nova Pro ThrottlingException: Rate exceeded');
      }
      return converseResponse(JSON.stringify({
        claims: [{ type: 'action', value: 'Walking', confidence: 0.9 }],
        summary: 'A person walking down the street',
        temporal_events: [{ start_ms: 0, end_ms: 1000, description: 'Walking' }]
      }));
    },
  });

  const result = await gateway.analyzeVideo({
    assetId: 'video-1',
    dataUrl: 'data:video/mp4;base64,AAAA',
  });

  assert.equal(result.status, 'degraded');
  assert.equal(result.provider, 'nova-lite');
  assert.equal(result.fallback, true);
  assert.equal(result.fallback_from, routes.videoPrimary);
  assert.equal(typeof result.duration_ms, 'number');
});

test('Provider Canaries: Token and secret redaction on canary ledger messages', () => {
  const rawCanaryStages = [
    {
      name: 'perception.image',
      status: 'degraded',
      provider: 'qwen-vl',
      message: 'Failed with status 401 Bearer sk-ant-secret1234567890abcdef at line 42',
      duration_ms: 120,
    },
    {
      name: 'compiler.vicsuc',
      status: 'ok',
      provider: 'mistral',
      message: 'Compiled with api_key="secret-key-xyz"',
      duration_ms: 250,
    },
  ];

  const ledger = normalizeExecutionLedger(rawCanaryStages);

  for (const stage of ledger.stages) {
    assert.doesNotMatch(stage.message, /sk-ant-secret/);
    assert.doesNotMatch(stage.message, /secret-key-xyz/);
    assert.doesNotMatch(stage.message, /Bearer\s+sk-/);
    assert.match(stage.message, /\[REDACTED\]/);
  }
});
