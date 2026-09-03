'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerClient } from '../../lib/supabase/server';
import { publicEnv } from '../../lib/env';
import { safeRedirectPath } from './safe-redirect';

const credentialsSchema = z.object({
  email: z.string().email({ message: 'Please provide a valid email address' }),
  password: z
    .string()
    .min(12, { message: 'Password must be at least 12 characters long' }),
});

const emailSchema = z.object({
  email: z.string().email({ message: 'Please provide a valid email address' }),
});

const passwordSchema = z.object({
  password: z
    .string()
    .min(12, { message: 'Password must be at least 12 characters long' }),
});

export type AuthActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

export async function signUpWithPassword(
  formData: FormData
): Promise<AuthActionResult> {
  const rawEmail = formData.get('email');
  const rawPassword = formData.get('password');

  const parsed = credentialsSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid credentials supplied',
    };
  }

  const supabase = await createServerClient();
  const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=/account`,
    },
  });

  if (error) {
    return {
      ok: false,
      error: 'Unable to complete signup. Please verify your details and try again.',
    };
  }

  return {
    ok: true,
    message: 'Please check your email to verify your account and complete registration.',
  };
}

export async function signInWithPassword(
  formData: FormData,
  nextParam?: string | null
): Promise<AuthActionResult> {
  const rawEmail = formData.get('email');
  const rawPassword = formData.get('password');

  const parsed = credentialsSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid email or password',
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      ok: false,
      error: 'Invalid email or password. Please try again.',
    };
  }

  redirect(safeRedirectPath(nextParam));
}

export async function signInWithGoogle(nextParam?: string | null) {
  const supabase = await createServerClient();
  const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;
  const targetNext = safeRedirectPath(nextParam);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(targetNext)}`,
    },
  });

  if (error || !data?.url) {
    redirect('/login?error=oauth_failed');
  }

  redirect(data.url);
}

export async function requestPasswordReset(
  formData: FormData
): Promise<AuthActionResult> {
  const rawEmail = formData.get('email');
  const parsed = emailSchema.safeParse({ email: rawEmail });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Please provide a valid email address',
    };
  }

  const supabase = await createServerClient();
  const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;

  // Supabase sends reset email if account exists, generic response avoids account enumeration
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/update-password`,
  });

  return {
    ok: true,
    message: 'If an account exists for that email, a password reset link has been sent.',
  };
}

export async function updatePassword(
  formData: FormData
): Promise<AuthActionResult> {
  const rawPassword = formData.get('password');
  const parsed = passwordSchema.safeParse({ password: rawPassword });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Password must be at least 12 characters',
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      ok: false,
      error: 'Unable to update password. Please request a new reset link.',
    };
  }

  redirect('/account?updated=password');
}

export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
