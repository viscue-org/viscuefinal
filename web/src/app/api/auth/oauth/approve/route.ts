import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '../../../../../lib/supabase/server';
import { requireUser } from '../../../../../lib/auth/require-user';
import { validateAuthorizationRequest } from '../../../../../features/connect/authorize';
import { createAuthorizationCode } from '../../../../../features/connect/oauth-server';

export async function POST(request: NextRequest) {
  return handleApprove(request);
}

export async function GET(request: NextRequest) {
  return handleApprove(request);
}

async function handleApprove(request: NextRequest) {
  const supabase = await createServerClient();
  let user;

  try {
    user = await requireUser(supabase);
  } catch {
    const nextUrl = `/login?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(new URL(nextUrl, request.url));
  }

  let params: Record<string, string> = {};
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      formData.forEach((val, key) => {
        if (typeof val === 'string') params[key] = val;
      });
    } catch {}
  } else if (contentType.includes('application/json')) {
    try {
      params = await request.json();
    } catch {}
  }

  // Fallback to URL search params if not provided in body
  if (!params.client_id) {
    request.nextUrl.searchParams.forEach((val, key) => {
      params[key] = val;
    });
  }

  const validation = validateAuthorizationRequest(params);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const { client_id, redirect_uri, code_challenge, state } = validation.params;

  const code = createAuthorizationCode({
    userId: user.id,
    email: user.email,
    clientId: client_id,
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
  });

  const callbackUrl = new URL(redirect_uri);
  callbackUrl.searchParams.set('code', code);
  callbackUrl.searchParams.set('state', state);

  return NextResponse.redirect(callbackUrl.toString(), 303);
}
