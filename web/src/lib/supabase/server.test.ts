// @vitest-environment node
import { it, expect, vi, afterEach } from 'vitest';
import { createServerClient } from './server';
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ getAll: () => [], set: () => {} })) }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('uses extension bearer identity for both user verification and quota RPC, without a cookie session', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');
  const calls: { url: string; authorization: string | null }[] = [];
  vi.stubGlobal('fetch', async (input: string | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, authorization: new Headers(init?.headers).get('authorization') });
    return new Response(JSON.stringify(url.includes('/auth/v1/user') ? { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', email: 'test@example.com' } : []), { headers: { 'content-type': 'application/json' } });
  });
  const client = await createServerClient(new Request('https://app.test/api/account/summary', { headers: { authorization: 'Bearer extension-user-token' } }));
  await client.auth.getUser('extension-user-token');
  await client.rpc('get_account_summary');
  expect(calls).toHaveLength(2);
  expect(calls.map(call => call.authorization)).toEqual(['Bearer extension-user-token', 'Bearer extension-user-token']);
});
