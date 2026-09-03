import test from 'node:test';
import assert from 'node:assert/strict';
import { ReceiptStore } from '../lib/receipts.mjs';

const execution = {
  executionId: 'exec_1',
  chatId: 'chat:1',
  destinationFingerprint: 'chatgpt:conversation:1',
  promptHash: 'prompt:a',
  attachments: [{ id: 'a', stateHash: 'state:a', required: true }],
};

const validReceipt = {
  execution_id: 'exec_1',
  destination_fingerprint: 'chatgpt:conversation:1',
  prompt_hash: 'prompt:a',
  attachment_state_hashes: ['state:a'],
  prompt_verified: true,
  submitted: false,
};

test('beginning an execution does not mark attachments as uploaded', () => {
  const store = new ReceiptStore();
  store.beginExecution(execution);
  assert.equal(store.hasConfirmedState('chat:1', 'state:a'), false);
});

test('only a matching destination and verified prompt can commit attachment state', () => {
  const store = new ReceiptStore();
  store.beginExecution(execution);
  assert.throws(() => store.commitReceipt({ ...validReceipt, destination_fingerprint: 'claude:other' }), /destination/i);
  assert.throws(() => store.commitReceipt({ ...validReceipt, prompt_verified: false }), /prompt/i);
  const result = store.commitReceipt(validReceipt);
  assert.deepEqual(result.confirmed, ['state:a']);
  assert.equal(store.hasConfirmedState('chat:1', 'state:a'), true);
});

test('a receipt missing a required attachment cannot commit partial state', () => {
  const store = new ReceiptStore();
  store.beginExecution(execution);
  assert.throws(() => store.commitReceipt({ ...validReceipt, attachment_state_hashes: [] }), /required attachment/i);
  assert.equal(store.hasConfirmedState('chat:1', 'state:a'), false);
});

test('reset clears only the named conversation', () => {
  const store = new ReceiptStore();
  store.beginExecution(execution);
  store.commitReceipt(validReceipt);
  store.beginExecution({ ...execution, executionId: 'exec_2', chatId: 'chat:2', destinationFingerprint: 'chatgpt:conversation:2' });
  store.commitReceipt({ ...validReceipt, execution_id: 'exec_2', destination_fingerprint: 'chatgpt:conversation:2' });
  store.resetSession('chat:1');
  assert.equal(store.hasConfirmedState('chat:1', 'state:a'), false);
  assert.equal(store.hasConfirmedState('chat:2', 'state:a'), true);
});
