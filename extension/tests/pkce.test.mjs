import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  randomVerifier,
  challengeFor,
  safeOAuthCallback,
} from '../auth/pkce.mjs';

describe('PKCE generation and callback validation', () => {
  it('generates high entropy verifier and correct S256 challenge', async () => {
    const verifier = randomVerifier();
    assert.ok(verifier.length >= 43 && verifier.length <= 128);

    const challenge = await challengeFor(verifier);
    assert.ok(typeof challenge === 'string');
    assert.ok(challenge.length > 20);
    assert.strictEqual(challenge.includes('+'), false);
    assert.strictEqual(challenge.includes('/'), false);
    assert.strictEqual(challenge.includes('='), false);
  });

  it('validates safe OAuth callback and extracts code', () => {
    const state = 'state_1234567890abcdef';
    const callbackUrl = `https://abcdef.chromiumapp.org/oauth?code=auth_code_999&state=${state}`;

    const result = safeOAuthCallback(callbackUrl, state);
    assert.deepStrictEqual(result, { ok: true, code: 'auth_code_999' });
  });

  it('rejects mismatched state or oauth errors', () => {
    const state = 'state_1234567890abcdef';
    const wrongStateUrl = `https://abcdef.chromiumapp.org/oauth?code=auth_code_999&state=wrong_state`;

    assert.deepStrictEqual(safeOAuthCallback(wrongStateUrl, state), {
      ok: false,
      error: 'state_mismatch',
    });

    const errorUrl = `https://abcdef.chromiumapp.org/oauth?error=access_denied&state=${state}`;
    assert.deepStrictEqual(safeOAuthCallback(errorUrl, state), {
      ok: false,
      error: 'access_denied',
    });
  });
});
