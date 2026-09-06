import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import * as oauthServer from '../../../../../features/connect/oauth-server';

vi.mock('../../../../../features/connect/oauth-server', async importOriginal => {
  const actual = await importOriginal<typeof oauthServer>();
  return {
    ...actual,
    exchangeCodeForSupabaseSession: vi.fn(),
    refreshSupabaseSession: vi.fn(),
  };
});

describe('POST /api/auth/oauth/token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unsupported grant type', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'password' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('unsupported_grant_type');
  });

  it('rejects missing parameters for authorization_code grant', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'authorization_code' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_request');
  });

  it('rejects invalid client_id', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: 'some-code',
        code_verifier: 'verifier',
        client_id: 'bad-client',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('invalid_client');
  });

  it('exchanges a valid authorization code and verifier for tokens', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const secret = 'test-secret-at-least-32-bytes-long-for-hmac-sha256';
    process.env.SUPABASE_SERVICE_ROLE_KEY = secret;

    const code = oauthServer.createAuthorizationCode({
      userId: 'user-uuid-1',
      email: 'witne@gmail.com',
      clientId: 'viscue-extension',
      redirectUri: 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2',
      codeChallenge: challenge,
      secret,
    });

    vi.mocked(oauthServer.exchangeCodeForSupabaseSession).mockResolvedValueOnce({
      access_token: 'fake_jwt_token',
      refresh_token: 'fake_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer',
      user: { id: 'user-uuid-1', email: 'witne@gmail.com' } as any,
    } as any);

    const req = new NextRequest('http://localhost:3000/api/auth/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        client_id: 'viscue-extension',
        redirect_uri: 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2',
      }).toString(),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.access_token).toBe('fake_jwt_token');
    expect(data.refresh_token).toBe('fake_refresh_token');
    expect(data.expires_in).toBe(3600);
    expect(data.user.email).toBe('witne@gmail.com');
  });

  it('refreshes a session using refresh_token grant', async () => {
    vi.mocked(oauthServer.refreshSupabaseSession).mockResolvedValueOnce({
      access_token: 'refreshed_jwt',
      refresh_token: 'refreshed_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer',
      user: { id: 'user-uuid-1' } as any,
    } as any);

    const req = new NextRequest('http://localhost:3000/api/auth/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: 'valid_refresh_token',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.access_token).toBe('refreshed_jwt');
    expect(data.refresh_token).toBe('refreshed_refresh_token');
  });
});
