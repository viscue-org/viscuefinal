import { describe, it, expect } from 'vitest';
import { parsePublicEnv, parseServerEnv } from './env';

describe('Environment validation', () => {
  it('rejects a service role key from public configuration', () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://vqqaxhzqaehjdpoefrjc.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'service_role.secret',
        NEXT_PUBLIC_SITE_URL: 'https://viscue.com',
      })
    ).toThrow(/service/i);
  });

  it('accepts valid public configuration', () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://vqqaxhzqaehjdpoefrjc.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_pub_1234567890abcdef',
      NEXT_PUBLIC_SITE_URL: 'https://viscue.com',
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://vqqaxhzqaehjdpoefrjc.supabase.co');
  });

  it('validates server-only configuration strictly', () => {
    expect(() =>
      parseServerEnv({
        SUPABASE_SERVICE_ROLE_KEY: '',
      })
    ).toThrow();
  });
});
