import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequestHandler } from '../lib/server-app.mjs';
import { ReceiptStore } from '../lib/receipts.mjs';

async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('capabilities expose route readiness without credentials and blocked compile returns 422', async () => {
  const handler = createRequestHandler({
    receiptStore: new ReceiptStore(),
    capabilities: { region: 'us-east-1', bedrockConfigured: false, fontConfigured: false, routes: { imagePrimary: 'qwen.test' } },
    run: async () => ({ ok: false, status: 'blocked', error: '3 required references exceed the plan limit.', stages: [] }),
  });
  await withServer(handler, async base => {
    const capabilities = await (await fetch(`${base}/capabilities`)).json();
    assert.equal(capabilities.ok, true);
    assert.equal(capabilities.credentials_exposed, false);
    assert.equal(capabilities.models.imagePrimary.id, 'qwen.test');
    const response = await fetch(`${base}/compile`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ graph: { items: [{ id: 'a' }] } }) });
    assert.equal(response.status, 422);
  });
});

test('compile creates an unconfirmed execution and a matching receipt commits it', async () => {
  const receiptStore = new ReceiptStore();
  const handler = createRequestHandler({
    receiptStore,
    capabilities: { region: 'us-east-1', bedrockConfigured: false, fontConfigured: false, routes: {} },
    run: async () => ({ ok: true, status: 'degraded', executionId: 'exec_http', execution_id: 'exec_http', prompt_hash: 'prompt:http', final_prompt: 'Use A.png.', attachments: [{ id: 'a', stateHash: 'state:http', required: true }], stages: [] }),
  });
  await withServer(handler, async base => {
    const compiled = await (await fetch(`${base}/compile`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ graph: { destination: 'ChatGPT', items: [{ id: 'a', kind: 'image', intentional: true }] }, session: { chatId: 'chat:http', destinationFingerprint: 'chatgpt:http' } }) })).json();
    assert.equal(compiled.ok, true);
    assert.equal(receiptStore.hasConfirmedState('chat:http', 'state:http'), false);
    const receiptResponse = await fetch(`${base}/handoff-receipt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ execution_id: 'exec_http', destination_fingerprint: 'chatgpt:http', prompt_hash: 'prompt:http', attachment_state_hashes: ['state:http'], prompt_verified: true }) });
    assert.equal(receiptResponse.status, 200);
    assert.equal(receiptStore.hasConfirmedState('chat:http', 'state:http'), true);
  });
});
