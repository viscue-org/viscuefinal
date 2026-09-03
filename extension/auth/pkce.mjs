// PKCE helper for Chrome extension OAuth 2.1 authentication

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function randomVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export async function challengeFor(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(hash);
}

export function safeOAuthCallback(callbackUrl, expectedState) {
  try {
    const url = new URL(callbackUrl);
    const error = url.searchParams.get('error');
    if (error) {
      return { ok: false, error };
    }

    const state = url.searchParams.get('state');
    if (!state || state !== expectedState) {
      return { ok: false, error: 'state_mismatch' };
    }

    const code = url.searchParams.get('code');
    if (!code) {
      return { ok: false, error: 'missing_code' };
    }

    return { ok: true, code };
  } catch {
    return { ok: false, error: 'invalid_url' };
  }
}
