import { randomVerifier, challengeFor, safeOAuthCallback } from './pkce.mjs';

export const STORAGE_KEY = 'viscue_oauth_session';
export const LOGOUT_GEN_KEY = 'viscue_logout_generation';
export const PENDING_AUTH_KEY = 'viscue_pending_auth';

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
      return refreshed?.accessToken || null;
    } catch {
      await clearSession(storage);
      return null;
    }
  }

  return session.accessToken;
}

export async function refreshSession(refreshToken, config = {}, storage = globalThis.chrome?.storage?.local) {
  const startGen = (await storage?.get?.(LOGOUT_GEN_KEY))?.[LOGOUT_GEN_KEY] || 0;
  const webUrl = config.webUrl || 'https://ext.viscue.space';
  const clientId = config.clientId || 'viscue-extension';
  const tokenEndpoint = config.tokenUrl || `${webUrl}/api/auth/oauth/token`;

  const response = await (config.fetch || fetch)(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh session');
  }

  const currentGen = (await storage?.get?.(LOGOUT_GEN_KEY))?.[LOGOUT_GEN_KEY] || 0;
  if (currentGen !== startGen) {
    // Logout occurred while refresh was in flight
    return null;
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

export function buildOAuthTokenRequest({
  webUrl,
  tokenUrl,
  supabaseUrl,
  clientId,
  redirectUri,
  code,
  verifier,
}) {
  const targetUrl = tokenUrl || (webUrl ? `${webUrl}/api/auth/oauth/token` : (supabaseUrl ? `${supabaseUrl}/auth/v1/oauth/token` : 'https://ext.viscue.space/api/auth/oauth/token'));
  return {
    url: targetUrl,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }).toString(),
    },
  };
}

export async function handleWorkspaceAccess({
  getAccessToken: readAccessToken,
  authenticate,
  openWorkspace,
  showPopup,
}) {
  const accessToken = await readAccessToken();
  if (accessToken) {
    await openWorkspace();
    return { ok: true };
  }

  await authenticate();
  await showPopup();
  return { ok: false, authRequired: true, authenticated: true };
}

async function waitForOAuthCallback(tabs, authTabId, redirectUri, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      tabs.onUpdated?.removeListener?.(handleUpdated);
      tabs.onRemoved?.removeListener?.(handleRemoved);
    };
    const handleUpdated = (tabId, changeInfo) => {
      if (!changeInfo.url?.startsWith(redirectUri)) return;
      cleanup();
      resolve({ callbackUrl: changeInfo.url, callbackTabId: tabId });
    };
    const handleRemoved = tabId => {
      if (tabId !== authTabId) return;
      cleanup();
      reject(new Error('Authentication cancelled by user'));
    };

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        cleanup();
        reject(new Error('Authentication timed out'));
      }, timeoutMs);
    }

    tabs.onUpdated?.addListener?.(handleUpdated);
    tabs.onRemoved?.addListener?.(handleRemoved);
  });
}

export async function signIn(
  config = {},
  storage = globalThis.chrome?.storage?.local,
  identity = globalThis.chrome?.identity,
  browserApi = globalThis.chrome
) {
  const webUrl = config.webUrl || 'https://ext.viscue.space';
  const supabaseUrl = config.supabaseUrl || 'https://vqqaxhzqaehjdpoefrjc.supabase.co';
  const clientId = config.clientId || 'viscue-extension';

  const verifier = randomVerifier();
  const challenge = await challengeFor(verifier);
  const state = randomVerifier();

  const redirectUri = identity?.getRedirectURL ? identity.getRedirectURL('oauth2') : 'https://viscue.internal/oauth';

  let authUrl = `${webUrl}/connect?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&code_challenge=${encodeURIComponent(
    challenge
  )}&code_challenge_method=S256&state=${encodeURIComponent(
    state
  )}&scope=openid%20email%20profile`;

  const forceLogin = Boolean((await storage?.get?.('viscue_force_login'))?.viscue_force_login);
  if (forceLogin) {
    authUrl += '&prompt=login';
    await storage?.remove?.('viscue_force_login');
  }

  if (!browserApi?.tabs) throw new Error('Chrome tabs API is not available');

  // Identify active source tab
  let sourceTab = null;
  if (browserApi.tabs.query) {
    try {
      const activeTabs = await browserApi.tabs.query({ active: true, lastFocusedWindow: true });
      sourceTab = activeTabs?.[0] || null;
    } catch {}
  }

  const createProps = { url: authUrl, active: true };
  if (sourceTab?.id !== undefined) {
    if (sourceTab.index !== undefined) createProps.index = sourceTab.index + 1;
    if (sourceTab.windowId !== undefined) createProps.windowId = sourceTab.windowId;
  }

  const authTab = await browserApi.tabs.create(createProps);

  // Persist pending attempt so service worker restart can recover
  if (storage?.set) {
    await storage.set({
      [PENDING_AUTH_KEY]: {
        state,
        verifier,
        authTabId: authTab.id,
        sourceTabId: sourceTab?.id,
        sourceWindowId: sourceTab?.windowId,
        startedAt: Date.now(),
      },
    });
  }

  let callbackResult;
  try {
    callbackResult = await waitForOAuthCallback(
      browserApi.tabs,
      authTab.id,
      redirectUri,
      config.timeoutMs || 300000
    );
  } catch (err) {
    if (storage?.remove) await storage.remove(PENDING_AUTH_KEY).catch(() => {});
    throw err;
  }

  const { callbackUrl, callbackTabId } = callbackResult;
  if (storage?.remove) await storage.remove(PENDING_AUTH_KEY).catch(() => {});

  const parsed = safeOAuthCallback(callbackUrl, state);
  if (!parsed.ok) {
    throw new Error(`Authentication error: ${parsed.error}`);
  }

  const tokenRequest = buildOAuthTokenRequest({
    webUrl,
    supabaseUrl,
    clientId,
    redirectUri,
    code: parsed.code,
    verifier,
  });
  const tokenRes = await (config.fetch || fetch)(tokenRequest.url, tokenRequest.init);

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

  // Restore focus to source tab/window
  if (sourceTab?.windowId && browserApi.windows?.update) {
    await browserApi.windows.update(sourceTab.windowId, { focused: true }).catch(() => {});
  }
  if (sourceTab?.id && browserApi.tabs?.update) {
    await browserApi.tabs.update(sourceTab.id, { active: true }).catch(() => {});
  }

  // Close owned auth tabs
  const tabsToClose = [...new Set([authTab.id, callbackTabId].filter(Number.isInteger))];
  if (tabsToClose.length && browserApi.tabs?.remove) {
    await browserApi.tabs.remove(tabsToClose).catch(() => {});
  }

  return session;
}

export async function signOut(storage = globalThis.chrome?.storage?.local) {
  const session = await getSession(storage);
  const formerToken = session?.accessToken;

  // 1. Clear local extension session before awaiting remote logout
  await clearSession(storage);
  const logoutGen = Date.now();
  if (storage?.set) {
    await storage.set({ [LOGOUT_GEN_KEY]: logoutGen, viscue_force_login: true });
  }

  // 2. Best-effort remote logout with captured token
  if (formerToken) {
    try {
      const supabaseUrl = 'https://vqqaxhzqaehjdpoefrjc.supabase.co';
      await fetch(`${supabaseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${formerToken}`,
        },
      });
    } catch (err) {
      console.error('Failed to logout on server:', err);
    }
  }
}
