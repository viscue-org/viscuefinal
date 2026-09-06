import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSession,
  setSession,
  clearSession,
  getAccessToken,
  signOut,
} from '../auth/session.mjs';
import * as sessionModule from '../auth/session.mjs';

describe('Extension Auth Session Storage', () => {
  it('saves, retrieves, and clears session data in storage', async () => {
    const memory = {};
    const mockStorage = {
      get: async key => ({ [key]: memory[key] }),
      set(obj, callback) {
        Object.assign(memory, obj);
        callback?.();
        return Promise.resolve();
      },
      remove(key, callback) {
        delete memory[key];
        callback?.();
        return Promise.resolve();
      },
    };

    const sessionData = {
      accessToken: 'access_jwt_123',
      refreshToken: 'refresh_tok_456',
      expiresAt: Date.now() + 3600_000,
      user: { id: 'u-1', email: 'test@example.com' },
    };

    await setSession(sessionData, mockStorage);
    const retrieved = await getSession(mockStorage);
    assert.deepStrictEqual(retrieved, sessionData);

    const token = await getAccessToken({}, mockStorage);
    assert.strictEqual(token, 'access_jwt_123');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true });
    try {
      await signOut(mockStorage);
    } finally {
      globalThis.fetch = originalFetch;
    }
    const cleared = await getSession(mockStorage);
    assert.strictEqual(cleared, null);
  });

  it('does not reuse an expired access token when refresh fails', async () => {
    const memory = {
      viscue_oauth_session: {
        accessToken: 'expired_access_token',
        refreshToken: 'invalid_refresh_token',
        expiresAt: Date.now() - 1,
      },
    };
    const storage = {
      get: async key => ({ [key]: memory[key] }),
      set: async obj => Object.assign(memory, obj),
      remove: async key => delete memory[key],
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false });
    try {
      assert.equal(await getAccessToken({}, storage), null);
      assert.equal(await getSession(storage), null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('builds the OAuth 2.1 public-client token exchange request', () => {
    assert.equal(typeof sessionModule.buildOAuthTokenRequest, 'function');
    const request = sessionModule.buildOAuthTokenRequest?.({
      supabaseUrl: 'https://project.supabase.co',
      clientId: 'viscue-extension',
      redirectUri: 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2',
      code: 'authorization-code',
      verifier: 'pkce-verifier',
    });

    assert.equal(request?.url, 'https://project.supabase.co/auth/v1/oauth/token');
    assert.equal(request?.init.method, 'POST');
    assert.equal(request?.init.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(
      request?.init.body,
      'grant_type=authorization_code&code=authorization-code&client_id=viscue-extension&redirect_uri=https%3A%2F%2Fabcdefghijklmnopabcdefghijklmnop.chromiumapp.org%2Foauth2&code_verifier=pkce-verifier'
    );
  });

  it('requires authentication before opening the workspace', async () => {
    assert.equal(typeof sessionModule.handleWorkspaceAccess, 'function');
    const calls = [];
    const result = await sessionModule.handleWorkspaceAccess?.({
      getAccessToken: async () => null,
      authenticate: async () => calls.push('authenticate'),
      openWorkspace: async () => calls.push('open-workspace'),
      showPopup: async () => calls.push('show-popup'),
    });

    assert.deepEqual(calls, ['authenticate', 'show-popup']);
    assert.deepEqual(result, {
      ok: false,
      authRequired: true,
      authenticated: true,
    });
  });

  it('opens the workspace directly only when a valid token exists', async () => {
    assert.equal(typeof sessionModule.handleWorkspaceAccess, 'function');
    const calls = [];
    const result = await sessionModule.handleWorkspaceAccess?.({
      getAccessToken: async () => 'valid-access-token',
      authenticate: async () => calls.push('authenticate'),
      openWorkspace: async () => calls.push('open-workspace'),
      showPopup: async () => calls.push('show-popup'),
    });

    assert.deepEqual(calls, ['open-workspace']);
    assert.deepEqual(result, { ok: true });
  });

  it('signIn creates adjacent tab, persists pending auth, and restores source focus', async () => {
    const memory = {};
    let pendingAuthResolve;
    const pendingAuthPromise = new Promise(resolve => { pendingAuthResolve = resolve; });

    const mockStorage = {
      get: async key => ({ [key]: memory[key] }),
      set: async obj => {
        Object.assign(memory, obj);
        if (obj.viscue_pending_auth) pendingAuthResolve();
      },
      remove: async key => delete memory[key],
    };

    let createdTabProps = null;
    let focusedWindowId = null;
    let activatedTabId = null;
    let closedTabs = [];
    let updatedListener = null;

    let tabCreatedResolve;
    const tabCreatedPromise = new Promise(resolve => { tabCreatedResolve = resolve; });

    const mockBrowserApi = {
      tabs: {
        query: async () => [{ id: 42, index: 3, windowId: 10 }],
        create: async props => {
          createdTabProps = props;
          tabCreatedResolve(props);
          return { id: 99, index: props.index, windowId: props.windowId };
        },
        update: async (tabId, props) => {
          if (props.active) activatedTabId = tabId;
        },
        remove: async tabIds => {
          closedTabs.push(...tabIds);
        },
        onUpdated: {
          addListener: fn => {
            updatedListener = fn;
            setTimeout(() => {
              const state = memory.viscue_pending_auth?.state;
              fn(99, {
                url: `https://mock-ext.chromiumapp.org/oauth2?code=mock-code&state=${state}`,
              });
            }, 10);
          },
          removeListener: () => { updatedListener = null; },
        },
        onRemoved: {
          addListener: () => {},
          removeListener: () => {},
        },
      },
      windows: {
        update: async (winId, props) => {
          if (props.focused) focusedWindowId = winId;
        },
      },
    };

    const mockIdentity = {
      getRedirectURL: () => 'https://mock-ext.chromiumapp.org/oauth2',
    };

    const signInPromise = sessionModule.signIn(
      {
        timeoutMs: 2000,
        fetch: async () => ({
          ok: true,
          json: async () => ({
            access_token: 'new-acc-tok',
            refresh_token: 'new-ref-tok',
            expires_in: 3600,
            user: { id: 'u2' },
          }),
        }),
      },
      mockStorage,
      mockIdentity,
      mockBrowserApi
    );

    await pendingAuthPromise;

    // Verify pending auth was stored with adjacent tab index
    assert.equal(createdTabProps.index, 4); // sourceTab.index + 1
    assert.equal(createdTabProps.windowId, 10);
    assert.ok(memory.viscue_pending_auth);
    assert.equal(memory.viscue_pending_auth.authTabId, 99);

    const session = await signInPromise;
    assert.equal(session.accessToken, 'new-acc-tok');

    // Verify pending auth was cleared
    assert.equal(memory.viscue_pending_auth, undefined);

    // Verify focus restoration
    assert.equal(focusedWindowId, 10);
    assert.equal(activatedTabId, 42);

    // Verify auth tab was closed
    assert.ok(closedTabs.includes(99));
  });

  it('refreshSession discards new tokens if signOut happened concurrently', async () => {
    const memory = {
      viscue_logout_generation: 1,
    };
    const mockStorage = {
      get: async key => ({ [key]: memory[key] }),
      set: async obj => Object.assign(memory, obj),
      remove: async key => delete memory[key],
    };

    // Simulate fetch taking time, during which signOut runs
    let fetchCalled = false;
    const mockFetch = async () => {
      fetchCalled = true;
      // In the middle of network call, logout occurs!
      memory.viscue_logout_generation = 2;
      return {
        ok: true,
        json: async () => ({
          access_token: 'stale-refreshed-token',
          refresh_token: 'stale-refresh-token',
          expires_in: 3600,
          user: { id: 'u1' },
        }),
      };
    };

    const result = await sessionModule.refreshSession(
      'some-refresh-token',
      { fetch: mockFetch },
      mockStorage
    );

    assert.equal(fetchCalled, true);
    assert.equal(result, null);
    assert.equal(memory.viscue_oauth_session, undefined);
  });
});
