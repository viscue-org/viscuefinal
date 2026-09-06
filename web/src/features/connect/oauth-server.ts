import crypto from 'crypto';
import { createAdminClient } from '../../lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '../../lib/env';

export interface AuthorizationCodePayload {
  sub: string;
  email: string | null;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  exp: number;
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

function getSigningSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to sign OAuth codes');
  }
  return secret;
}

/**
 * Creates a cryptographically signed authorization code containing the user's
 * identity, PKCE challenge, and expiry (5 minutes).
 */
export function createAuthorizationCode(params: {
  userId: string;
  email: string | null;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  ttlSeconds?: number;
  secret?: string;
}): string {
  const ttl = params.ttlSeconds || 300;
  const payload: AuthorizationCodePayload = {
    sub: params.userId,
    email: params.email,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    exp: Math.floor(Date.now() / 1000) + ttl,
  };

  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  const secret = params.secret || getSigningSecret();
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(encodedPayload).digest()
  );

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies the authorization code signature, expiry, and PKCE challenge.
 */
export function verifyAuthorizationCode(
  code: string,
  codeVerifier: string,
  secretOverride?: string
): AuthorizationCodePayload | null {
  const parts = code.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = parts;
  const secret = secretOverride || getSigningSecret();

  const expectedSignature = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(encodedPayload).digest()
  );

  // Timing-safe signature check
  const sigBuf = Buffer.from(signature);
  const expectedSigBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
    return null;
  }

  let payload: AuthorizationCodePayload;
  try {
    const jsonStr = base64UrlDecode(encodedPayload).toString('utf8');
    payload = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  // Expiry check
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    return null;
  }

  // PKCE verification (RFC 7636 S256: BASE64URL(SHA256(verifier)) == challenge)
  const computedChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  const computedBuf = Buffer.from(computedChallenge);
  const challengeBuf = Buffer.from(payload.code_challenge);

  if (computedBuf.length !== challengeBuf.length || !crypto.timingSafeEqual(computedBuf, challengeBuf)) {
    return null;
  }

  return payload;
}

/**
 * Exchanges a verified authorization code payload for a full Supabase session
 * (access_token, refresh_token, user).
 */
export async function exchangeCodeForSupabaseSession(payload: AuthorizationCodePayload) {
  if (!payload.email) {
    throw new Error('Authorization code has no associated user email');
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: payload.email,
  });

  if (error || !data?.properties?.hashed_token) {
    throw new Error(error?.message || 'Failed to generate user credentials');
  }

  const client = createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const verify = await client.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
  });

  if (verify.error || !verify.data?.session) {
    throw new Error(verify.error?.message || 'Failed to verify session tokens');
  }

  return verify.data.session;
}

/**
 * Refreshes an existing Supabase session using standard Supabase Auth refresh.
 */
export async function refreshSupabaseSession(refreshToken: string) {
  const client = createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { data, error } = await client.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data?.session) {
    throw new Error(error?.message || 'Failed to refresh session');
  }

  return data.session;
}
