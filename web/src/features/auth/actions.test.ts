import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

import { createServerClient } from '../../lib/supabase/server';
import { signUpWithPassword } from './actions';

describe('authentication actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ext.viscue.space');
  });

  it('preserves the extension authorization return path through email verification', async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    vi.mocked(createServerClient).mockResolvedValue({ auth: { signUp } } as never);
    const formData = new FormData();
    formData.set('email', 'person@example.com');
    formData.set('password', 'strong-password-123');

    await signUpWithPassword(formData, '/connect?authorization_id=authorization-123');

    expect(signUp).toHaveBeenCalledWith({
      email: 'person@example.com',
      password: 'strong-password-123',
      options: {
        emailRedirectTo:
          'https://ext.viscue.space/auth/callback?next=%2Fconnect%3Fauthorization_id%3Dauthorization-123',
      },
    });
  });
});
