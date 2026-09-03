import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface VerifiedUser {
  id: string;
  email: string | null;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export async function requireUser(supabase: SupabaseClient): Promise<VerifiedUser> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    throw new AuthError('Unauthorized', 401);
  }

  const user = data.user;

  if (!user.id || !UUID_REGEX.test(user.id)) {
    throw new AuthError('Invalid user identifier', 401);
  }

  return {
    id: user.id,
    email: user.email ?? null,
  };
}
