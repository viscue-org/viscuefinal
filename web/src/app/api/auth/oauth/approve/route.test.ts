import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { requireUser } from '../../../../../lib/auth/require-user';

vi.mock('../../../../../lib/auth/require-user', () => ({
  requireUser: vi.fn(),
}));

vi.mock('../../../../../lib/supabase/server', () => ({
  createServerClient: vi.fn().mockResolvedValue({}),
}));

describe('POST /api/auth/oauth/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret-at-least-32-bytes-long-for-hmac-sha256';
  });

  it('redirects to login if user is unauthenticated', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('Unauthorized'));

    const req = new NextRequest('http://localhost:3000/api/auth/oauth/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login?next=');
  });

  it('rejects invalid client_id or redirect_uri', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'witne@gmail.com' });

    const req = new NextRequest('http://localhost:3000/api/auth/oauth/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'bad-client',
        redirect_uri: 'https://evil.example/callback',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('generates signed code and redirects to chromiumapp.org with code and state', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'witne@gmail.com' });

    const redirectUri = 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2';
    const state = 'abcdef0123456789abcdef0123456789';

    const req = new NextRequest('http://localhost:3000/api/auth/oauth/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: 'viscue-extension',
        redirect_uri: redirectUri,
        response_type: 'code',
        code_challenge: 'E9Melhoa2OwvFrGMTJguCH5Zw_l5UG39WgpmJ351min',
        code_challenge_method: 'S256',
        state,
      }).toString(),
    });

    const res = await POST(req);
    expect(res.status).toBe(303);
    const location = res.headers.get('location');
    expect(location).toBeTruthy();

    const parsed = new URL(location!);
    expect(parsed.origin + parsed.pathname).toBe(redirectUri);
    expect(parsed.searchParams.get('state')).toBe(state);
    expect(parsed.searchParams.get('code')).toBeTruthy();
  });

  it('returns JSON with redirectUrl when Accept header includes application/json', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'witne@gmail.com' });

    const redirectUri = 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2';
    const state = 'abcdef0123456789abcdef0123456789';

    const req = new NextRequest('http://localhost:3000/api/auth/oauth/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: 'viscue-extension',
        redirect_uri: redirectUri,
        response_type: 'code',
        code_challenge: 'E9Melhoa2OwvFrGMTJguCH5Zw_l5UG39WgpmJ351min',
        code_challenge_method: 'S256',
        state,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.redirectUrl).toContain(redirectUri);
    expect(body.redirectUrl).toContain(`state=${state}`);
    expect(body.redirectUrl).toContain('code=');
  });
});

