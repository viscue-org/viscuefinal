import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSession,
  setSession,
  clearSession,
  getAccessToken,
  signOut,
} from '../auth/session.mjs';

describe('Extension Auth Session Storage', () => {
  it('saves, retrieves, and clears session data in storage', async () => {
    const memory = {};
    const mockStorage = {
      get: async key => ({ [key]: memory[key] }),
      set: async obj => Object.assign(memory, obj),
      remove: async key => delete memory[key],
    };

    const sessionData = {
      accessToken: 'access_jwt_123',
      refreshToken: 'refresh_tok_456',
      expiresAt: Date.now() + 3600_000,
      user: { id: 'u-1', email: 'test@example.com' },
    };

    await setSession(sessionData, mockStorage);
    const retrieved = await getSession(mockStorage);
    assert.deepStrictEqual(retrieved, sessionData);

    const token = await getAccessToken({}, mockStorage);
    assert.strictEqual(token, 'access_jwt_123');

    await signOut(mockStorage);
    const cleared = await getSession(mockStorage);
    assert.strictEqual(cleared, null);
  });
});
