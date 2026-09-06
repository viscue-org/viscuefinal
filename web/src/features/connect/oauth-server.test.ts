import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { createAuthorizationCode, verifyAuthorizationCode } from './oauth-server';

describe('OAuth Server PKCE Helpers', () => {
  const secret = 'test-secret-at-least-32-bytes-long-for-hmac-sha256';
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  it('creates and verifies a valid authorization code with PKCE verifier', () => {
    const code = createAuthorizationCode({
      userId: '12345678-1234-4234-8234-123456789abc',
      email: 'witne@gmail.com',
      clientId: 'viscue-extension',
      redirectUri: 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2',
      codeChallenge: challenge,
      secret,
    });

    const verified = verifyAuthorizationCode(code, verifier, secret);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe('12345678-1234-4234-8234-123456789abc');
    expect(verified?.email).toBe('witne@gmail.com');
    expect(verified?.client_id).toBe('viscue-extension');
    expect(verified?.redirect_uri).toBe(
      'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2'
    );
  });

  it('rejects an incorrect PKCE code verifier', () => {
    const code = createAuthorizationCode({
      userId: '12345678-1234-4234-8234-123456789abc',
      email: 'witne@gmail.com',
      clientId: 'viscue-extension',
      redirectUri: 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2',
      codeChallenge: challenge,
      secret,
    });

    const verified = verifyAuthorizationCode(code, 'wrong-verifier', secret);
    expect(verified).toBeNull();
  });

  it('rejects an altered or forged authorization code', () => {
    const code = createAuthorizationCode({
      userId: '12345678-1234-4234-8234-123456789abc',
      email: 'witne@gmail.com',
      clientId: 'viscue-extension',
      redirectUri: 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2',
      codeChallenge: challenge,
      secret,
    });

    const [payload, sig] = code.split('.');
    const forged = payload.slice(0, -2) + 'aa.' + sig;
    expect(verifyAuthorizationCode(forged, verifier, secret)).toBeNull();
  });

  it('rejects an expired authorization code', () => {
    const code = createAuthorizationCode({
      userId: '12345678-1234-4234-8234-123456789abc',
      email: 'witne@gmail.com',
      clientId: 'viscue-extension',
      redirectUri: 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2',
      codeChallenge: challenge,
      ttlSeconds: -10, // already expired
      secret,
    });

    expect(verifyAuthorizationCode(code, verifier, secret)).toBeNull();
  });
});
