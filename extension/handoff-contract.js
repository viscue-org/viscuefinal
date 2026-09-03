(function installViscueHandoffContract(target) {
  function buildReceipt({ executionId, destinationFingerprint, promptHash, attachments = [], promptVerified, submitted = false } = {}) {
    if (!executionId) throw new TypeError('A handoff execution ID is required.');
    if (!destinationFingerprint) throw new TypeError('A handoff destination fingerprint is required.');
    if (!promptHash) throw new TypeError('A handoff prompt hash is required.');
    if (promptVerified !== true) throw new TypeError('The destination prompt must be verified before a receipt is created.');
    return {
      execution_id: executionId,
      destination_fingerprint: destinationFingerprint,
      prompt_hash: promptHash,
      attachment_state_hashes: [...new Set(attachments.filter(item => item?.confirmed && item.stateHash).map(item => item.stateHash))],
      prompt_verified: true,
      submitted: Boolean(submitted),
    };
  }
  target.ViscueHandoff = Object.freeze({ buildReceipt });
})(globalThis);
