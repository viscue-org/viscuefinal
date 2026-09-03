import test from 'node:test';
import assert from 'node:assert/strict';
await import('../../extension/handoff-contract.js');

test('handoff receipt contains only confirmed attachment state hashes and verified destination facts', () => {
  const receipt = globalThis.ViscueHandoff.buildReceipt({
    executionId: 'exec_1',
    destinationFingerprint: 'ChatGPT:/c/1',
    promptHash: 'prompt:1',
    attachments: [
      { stateHash: 'state:a', confirmed: true },
      { stateHash: 'state:b', confirmed: false },
    ],
    promptVerified: true,
    submitted: false,
  });
  assert.deepEqual(receipt.attachment_state_hashes, ['state:a']);
  assert.equal(receipt.prompt_verified, true);
  assert.equal(receipt.submitted, false);
  assert.equal(receipt.execution_id, 'exec_1');
});

test('handoff receipt rejects missing execution and prompt verification', () => {
  assert.throws(() => globalThis.ViscueHandoff.buildReceipt({ promptVerified: true }), /execution/i);
  assert.throws(() => globalThis.ViscueHandoff.buildReceipt({ executionId: 'exec', destinationFingerprint: 'dest', promptHash: 'hash', promptVerified: false }), /verified/i);
});
