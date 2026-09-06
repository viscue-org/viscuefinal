import { NextResponse, type NextRequest } from 'next/server';
import {
  verifyAuthorizationCode,
  exchangeCodeForSupabaseSession,
  refreshSupabaseSession,
} from '../../../../../features/connect/oauth-server';

// Track used authorization codes to ensure single-use
const usedCodes = new Set<string>();

export async function POST(request: NextRequest) {
  let params: Record<string, string> = {};
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      formData.forEach((val, key) => {
        if (typeof val === 'string') params[key] = val;
      });
    } catch {}
  } else {
    try {
      params = await request.json();
    } catch {}
  }

  const grantType = params.grant_type;

  if (grantType === 'authorization_code') {
    const { code, code_verifier, client_id, redirect_uri } = params;

    if (!code || !code_verifier || !client_id) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing required parameters' },
        { status: 400 }
      );
    }

    if (client_id !== 'viscue-extension') {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Unknown client identifier' },
        { status: 401 }
      );
    }

    if (usedCodes.has(code)) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Authorization code has already been used' },
        { status: 400 }
      );
    }

    const payload = verifyAuthorizationCode(code, code_verifier);
    if (!payload) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
        { status: 400 }
      );
    }

    if (redirect_uri && payload.redirect_uri !== redirect_uri) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Redirect URI mismatch' },
        { status: 400 }
      );
    }

    // Mark code as used
    usedCodes.add(code);
    setTimeout(() => usedCodes.delete(code), 360_000);

    try {
      const session = await exchangeCodeForSupabaseSession(payload);
      return NextResponse.json({
        access_token: session.access_token,
        token_type: 'Bearer',
        expires_in: session.expires_in,
        refresh_token: session.refresh_token,
        user: session.user,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Token exchange failed';
      return NextResponse.json(
        { error: 'server_error', error_description: message },
        { status: 500 }
      );
    }
  }

  if (grantType === 'refresh_token') {
    const { refresh_token } = params;
    if (!refresh_token) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing refresh_token' },
        { status: 400 }
      );
    }

    try {
      const session = await refreshSupabaseSession(refresh_token);
      return NextResponse.json({
        access_token: session.access_token,
        token_type: 'Bearer',
        expires_in: session.expires_in,
        refresh_token: session.refresh_token,
        user: session.user,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Session refresh failed';
      return NextResponse.json(
        { error: 'invalid_grant', error_description: message },
        { status: 400 }
      );
    }
  }

  return NextResponse.json(
    { error: 'unsupported_grant_type', error_description: 'Grant type must be authorization_code or refresh_token' },
    { status: 400 }
  );
}
