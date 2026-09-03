export class ReceiptStore {
  #executions = new Map();
  #confirmedByChat = new Map();

  beginExecution(execution = {}) {
    if (!execution.executionId || !execution.chatId || !execution.destinationFingerprint || !execution.promptHash) throw new TypeError('Execution identity, chat, destination, and prompt hash are required.');
    this.#executions.set(execution.executionId, {
      ...execution,
      attachments: (execution.attachments || []).map(item => ({ ...item })),
      createdAt: Date.now(),
    });
  }

  hasConfirmedState(chatId, stateHash) {
    return this.#confirmedByChat.get(chatId)?.has(stateHash) || false;
  }

  commitReceipt(receipt = {}) {
    const execution = this.#executions.get(receipt.execution_id);
    if (!execution) throw new Error('Receipt execution is unknown or expired.');
    if (receipt.destination_fingerprint !== execution.destinationFingerprint) throw new Error('Receipt destination does not match the execution.');
    if (receipt.prompt_hash !== execution.promptHash) throw new Error('Receipt prompt hash does not match the execution.');
    if (receipt.prompt_verified !== true) throw new Error('Receipt prompt was not verified at the destination.');
    const received = new Set(Array.isArray(receipt.attachment_state_hashes) ? receipt.attachment_state_hashes : []);
    const expected = new Set(execution.attachments.map(item => item.stateHash).filter(Boolean));
    const required = execution.attachments.filter(item => item.required && item.stateHash).map(item => item.stateHash);
    if (required.some(stateHash => !received.has(stateHash))) throw new Error('Receipt is missing a required attachment state.');
    if ([...received].some(stateHash => !expected.has(stateHash))) throw new Error('Receipt contains an attachment state outside this execution.');

    const confirmed = this.#confirmedByChat.get(execution.chatId) || new Set();
    for (const stateHash of received) confirmed.add(stateHash);
    this.#confirmedByChat.set(execution.chatId, confirmed);
    this.#executions.delete(receipt.execution_id);
    return { ok: true, confirmed: [...received], chat_id: execution.chatId };
  }

  resetSession(chatId) {
    this.#confirmedByChat.delete(chatId);
    for (const [executionId, execution] of this.#executions) if (execution.chatId === chatId) this.#executions.delete(executionId);
    return { ok: true, chat_id: chatId };
  }
}
