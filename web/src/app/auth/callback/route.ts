import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '../../../lib/supabase/server';
import { safeRedirectPath } from '../../../features/auth/safe-redirect';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeRedirectPath(searchParams.get('next'));

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // Return to login with generic error if code exchange fails
  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin));
}
