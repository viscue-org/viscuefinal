import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '../../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  return handleSignOut(request);
}

export async function POST(request: NextRequest) {
  return handleSignOut(request);
}

async function handleSignOut(request: NextRequest) {
  const supabase = await createServerClient();
  await supabase.auth.signOut();

  const nextParam = request.nextUrl.searchParams.get('next') || '/login';
  const redirectUrl = new URL(nextParam, request.nextUrl.origin);

  const response = NextResponse.redirect(redirectUrl);

  // Clear all Supabase auth cookie variants explicitly on the response
  const cookies = request.cookies.getAll();
  for (const cookie of cookies) {
    if (cookie.name.includes('sb-') || cookie.name.includes('auth-token')) {
      response.cookies.delete(cookie.name);
    }
  }

  return response;
}
