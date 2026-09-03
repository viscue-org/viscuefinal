import { randomVerifier, challengeFor, safeOAuthCallback } from './pkce.mjs';

const STORAGE_KEY = 'viscue_oauth_session';

export async function getSession(storage = globalThis.chrome?.storage?.local) {
  if (!storage) return null;
  const result = await storage.get(STORAGE_KEY);
  return result?.[STORAGE_KEY] || null;
}

export async function setSession(sessionData, storage = globalThis.chrome?.storage?.local) {
  if (!storage) return;
  await storage.set({ [STORAGE_KEY]: sessionData });
}

export async function clearSession(storage = globalThis.chrome?.storage?.local) {
  if (!storage) return;
  await storage.remove(STORAGE_KEY);
}

export async function getAccessToken(config = {}, storage = globalThis.chrome?.storage?.local) {
  const session = await getSession(storage);
  if (!session?.accessToken) {
    return null;
  }

  // Refresh if within 60 seconds of expiry
  const now = Date.now();
  if (session.expiresAt && session.expiresAt - now < 60_000 && session.refreshToken) {
    try {
      const refreshed = await refreshSession(session.refreshToken, config, storage);
      return refreshed?.accessToken || session.accessToken;
    } catch {
      return session.accessToken;
    }
  }

  return session.accessToken;
}

export async function refreshSession(refreshToken, config, storage = globalThis.chrome?.storage?.local) {
  const supabaseUrl = config.supabaseUrl || 'https://vqqaxhzqaehjdpoefrjc.supabase.co';
  const tokenEndpoint = `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`;

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.publishableKey || '',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh session');
  }

  const data = await response.json();
  const session = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    user: data.user,
  };

  await setSession(session, storage);
  return session;
}

export async function signIn(config = {}, storage = globalThis.chrome?.storage?.local, identity = globalThis.chrome?.identity) {
  const webUrl = config.webUrl || 'https://viscue.com';
  const supabaseUrl = config.supabaseUrl || 'https://vqqaxhzqaehjdpoefrjc.supabase.co';
  const clientId = config.clientId || 'viscue-extension';

  const verifier = randomVerifier();
  const challenge = await challengeFor(verifier);
  const state = randomVerifier();

  const redirectUri = identity?.getRedirectURL ? identity.getRedirectURL('oauth2') : 'https://viscue.internal/oauth';

  const authUrl = `${webUrl}/connect?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&code_challenge=${encodeURIComponent(
    challenge
  )}&code_challenge_method=S256&state=${encodeURIComponent(
    state
  )}&scope=openid%20email%20profile`;

  if (!identity?.launchWebAuthFlow) {
    throw new Error('chrome.identity.launchWebAuthFlow is not available');
  }

  const callbackUrl = await new Promise((resolve, reject) => {
    identity.launchWebAuthFlow({ url: authUrl, interactive: true }, responseUrl => {
      if (chrome.runtime.lastError || !responseUrl) {
        reject(new Error(chrome.runtime.lastError?.message || 'Authentication cancelled'));
      } else {
        resolve(responseUrl);
      }
    });
  });

  const parsed = safeOAuthCallback(callbackUrl, state);
  if (!parsed.ok) {
    throw new Error(`Authentication error: ${parsed.error}`);
  }

  // Exchange code for tokens at Supabase token endpoint
  const tokenEndpoint = `${supabaseUrl}/auth/v1/token?grant_type=pkce`;
  const tokenRes = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.publishableKey || '',
    },
    body: JSON.stringify({
      auth_code: parsed.code,
      code_verifier: verifier,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error('Failed to exchange authorization code');
  }

  const tokenData = await tokenRes.json();
  const session = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
    user: tokenData.user,
  };

  await setSession(session, storage);
  return session;
}

export async function signOut(storage = globalThis.chrome?.storage?.local) {
  await clearSession(storage);
}
