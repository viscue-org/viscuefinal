import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { accountView } from '../src/accountModel.mjs';

describe('accountView Model', () => {
  it('returns signed-out state when summary is null', () => {
    const view = accountView(null);
    assert.strictEqual(view.state, 'signed-out');
    assert.strictEqual(view.count, '9/9');
  });

  it('formats remaining/allowance and ready state correctly', () => {
    const view = accountView({
      email: 'witne@gmail.com',
      plan: 'plus',
      allowance: 28,
      remaining: 24,
      resetsAt: '2026-09-04T00:00:00Z',
    });

    assert.strictEqual(view.state, 'ready');
    assert.strictEqual(view.plan, 'plus');
    assert.strictEqual(view.count, '24/28');
    assert.strictEqual(view.email, 'witne@gmail.com');
  });

  it('marks state as exhausted when remaining is 0', () => {
    const view = accountView({
      email: 'witne@gmail.com',
      plan: 'free',
      allowance: 9,
      remaining: 0,
      resetsAt: '2026-09-04T00:00:00Z',
    });

    assert.strictEqual(view.state, 'exhausted');
    assert.strictEqual(view.count, '0/9');
  });
});
