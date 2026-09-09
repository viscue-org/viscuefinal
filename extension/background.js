import { signIn, signOut, getSession, getAccessToken, handleWorkspaceAccess } from './auth/session.mjs';
import { apiFetch } from './api/client.mjs';
import { VISCUE_WEB_URL, VISCUE_API_URL } from './api/config.mjs';
import { isWorkspaceUrl } from './api/workspaceCompletion.mjs';
import { parsePlatformChatContext } from '../local-server/lib/platform-capabilities.mjs';
import { compileLocal } from './compiler.mjs';

const API = VISCUE_API_URL;
const ONBOARDING_KEY = 'viscue-onboarding-complete';

async function showAccountPopup() {
  await chrome.storage.local.set({ [ONBOARDING_KEY]: true });
  if (chrome.action?.openPopup) {
    await chrome.action.openPopup().catch(() => {});
  }
}

async function authenticateAndShowPopup() {
  const session = await signIn({ webUrl: VISCUE_WEB_URL, forceLogin: true });
  await showAccountPopup();
  return session;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === 'auth-sign-in') {
      const session = await authenticateAndShowPopup();
      sendResponse({ ok: true, session });
      return;
    }
    if (message.type === 'auth-sign-out') {
      await signOut();
      sendResponse({ ok: true });
      return;
    }
    if (message.type === 'auth-get-session') {
      const session = await getSession();
      sendResponse({ ok: true, session });
      return;
    }
    if (message.type === 'account-get') {
      const token = await getAccessToken();
      if (!token) {
        sendResponse({ ok: true, data: null, signedOut: true });
        return;
      }
      try {
        const summary = await apiFetch('/account/summary');
        sendResponse(summary);
      } catch (err) {
        const session = await getSession();
        if (session?.user?.email) {
          sendResponse({
            ok: true,
            data: {
              email: session.user.email,
              plan: session.user.plan || 'free',
              allowance: 9,
              remaining: 9,
              subscriptionStatus: null,
            },
          });
        } else {
          sendResponse({ ok: false, error: err.message });
        }
      }
      return;
    }
    if (message.type === 'billing-open') {
      const planParam = message.plan && ['plus', 'pro'].includes(message.plan) ? `?plan=${message.plan}` : '';
      const [sourceTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const createProps = { url: `${VISCUE_WEB_URL}/account${planParam}#plans`, active: true };
      if (sourceTab) {
        if (sourceTab.index !== undefined) createProps.index = sourceTab.index + 1;
        if (sourceTab.windowId !== undefined) createProps.windowId = sourceTab.windowId;
      }
      await chrome.tabs.create(createProps);
      sendResponse({ ok: true });
      return;
    }
    if (message.type === 'open-workspace') {
      const result = await handleWorkspaceAccess({
        getAccessToken: () => getAccessToken(),
        authenticate: () => signIn({ webUrl: VISCUE_WEB_URL, forceLogin: true }),
        openWorkspace: () => openWorkspace(sender.tab),
        showPopup: showAccountPopup,
      });
      sendResponse(result);
      return;
    }
    if (message.type === 'capture-page') {
      const tab = message.tabId ? await chrome.tabs.get(message.tabId) : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
      if (!tab?.windowId) throw new Error('No active webpage is available to capture.');
      const [previous] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
      let dataUrl;
      try {
        if (previous?.id !== tab.id) {
          await chrome.tabs.update(tab.id, { active: true });
          await new Promise(resolve => setTimeout(resolve, 220));
        }
        dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      } finally {
        if (previous?.id && previous.id !== tab.id) await chrome.tabs.update(previous.id, { active: true });
      }
      sendResponse({ ok: true, dataUrl, url: tab.url, title: tab.title });
      return;
    }
    if (message.type === 'active-context') {
      const tab = message.tabId ? await chrome.tabs.get(message.tabId).catch(() => null) : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
      let liveContext = null;
      if (tab?.id) {
        try {
          const res = await chrome.tabs.sendMessage(tab.id, { type: 'get-chat-context' });
          if (res?.ok && res.context) {
            liveContext = {
              ...res.context,
              title: tab.title || res.context.platform,
              tabId: tab.id,
              fingerprint: res.context.destinationFingerprint,
            };
          }
        } catch {}
      }
      sendResponse({ ok: true, context: liveContext || detectContext(tab || {}) });
      return;
    }
    if (message.type === 'compile') {
      try {
        const result = await compileLocal(message.payload);
        sendResponse(result);
      } catch (err) {
        sendResponse({ ok: false, error: err.message, code: err.code });
      }
      return;
    }
    if (message.type === 'insert-prompt') {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id) throw new Error('No active destination tab');
      try {
        sendResponse(await chrome.tabs.sendMessage(tab.id, { type: 'insert-prompt', prompt: message.prompt }));
      } catch (err) {
        sendResponse({ ok: false, error: 'Target page not supported. Please open ChatGPT, Claude, or Gemini, or refresh the page.' });
      }
      return;
    }
    if (message.type === 'handoff') {
      const tab = message.tabId ? await chrome.tabs.get(message.tabId).catch(() => null) : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
      if (!tab?.id) throw new Error('Open the destination AI chat before sending intent.');
      try {
        let liveCtx = null;
        try {
          const res = await chrome.tabs.sendMessage(tab.id, { type: 'get-chat-context' });
          if (res?.ok && res.context) liveCtx = res.context;
        } catch {}
        if (!liveCtx) liveCtx = detectContext(tab);
        const liveFingerprint = liveCtx.destinationFingerprint || liveCtx.fingerprint || message.destinationFingerprint;
        sendResponse(await chrome.tabs.sendMessage(tab.id, {
          type: 'handoff', prompt: message.prompt, attachments: message.attachments || [], submit: Boolean(message.submit),
          executionId: message.executionId, destinationFingerprint: liveFingerprint, promptHash: message.promptHash, tabId: tab.id
        }));
      } catch (err) {
        sendResponse({ ok: false, error: 'Could not connect to the page. Make sure you are on a supported AI chat (ChatGPT, Claude, etc.) and refresh the page if needed.' });
      }
      return;
    }
    if (message.type === 'handoff-receipt') {
      try {
        const receipt = message.receipt || {};
        const destFp = receipt.destination_fingerprint || receipt.destinationFingerprint || '';
        const tabId = receipt.tabId || message.tabId;
        const chatId = receipt.chatId || (destFp ? destFp.split(':').slice(1).join(':') : null);
        const platform = receipt.platform || (destFp ? destFp.split(':')[0] : null);
        const isNewChat = Boolean(
          receipt.isNewChat ||
          chatId === 'new' ||
          chatId === '/' ||
          !chatId ||
          destFp.endsWith(':new') ||
          destFp.endsWith(':/') ||
          destFp.endsWith(':/app') ||
          destFp.endsWith(':/new')
        );

        // Only maintain cumulative confirmed attachment hashes for real persistent chats
        let cumulativeSentHashes = [];
        const realChatKey = (!isNewChat && platform && chatId) ? `viscue-chat-state-${platform}:${chatId}` : null;
        if (realChatKey) {
          const existingData = await chrome.storage.local.get(realChatKey);
          const priorReceipt = existingData[realChatKey] || {};
          const priorSentHashes = priorReceipt.sent_attachment_hashes || priorReceipt.attachment_state_hashes || [];
          const newHashes = receipt.attachment_state_hashes || [];
          cumulativeSentHashes = [...new Set([...priorSentHashes, ...newHashes])];
        } else {
          cumulativeSentHashes = receipt.attachment_state_hashes || [];
        }

        const enrichedReceipt = {
          ...receipt,
          destinationFingerprint: destFp,
          destination_fingerprint: destFp,
          chatId,
          tabId,
          platform,
          isNewChat,
          sent_attachment_hashes: cumulativeSentHashes,
        };

        const updates = {
          'viscue-state-cache': enrichedReceipt,
          'viscue-last-receipt': enrichedReceipt,
          [`viscue-receipt-${receipt.execution_id || receipt.executionId || Date.now()}`]: enrichedReceipt,
          // Always write tab-scoped state so that if the platform redirects
          // from a "new" URL (e.g. /app, /new) to an assigned chat ID, we
          // can still bridge the prior upload state from the same tab.
          [`viscue-tab-state-${tabId}`]: enrichedReceipt,
        };
        if (realChatKey) {
          updates[realChatKey] = enrichedReceipt;
          if (destFp) updates[`viscue-chat-state-${destFp}`] = enrichedReceipt;
        }

        await chrome.storage.local.set(updates);

        // Clean up any stale generic new-chat keys so new chats always start clean
        await chrome.storage.local.remove([
          'viscue-chat-state-ChatGPT:/',
          'viscue-chat-state-ChatGPT:new',
          'viscue-chat-state-Claude:/new',
          'viscue-chat-state-Gemini:/app',
          'viscue-chat-state-Perplexity:/',
          'viscue-chat-state-Grok:/'
        ]).catch(() => {});
        const devSettings = await chrome.storage.local.get('viscue-dev-server').catch(() => ({}));
        if (devSettings?.['viscue-dev-server']) {
          const auth = await getAuthHeader();
          await fetch(`${API}/handoff-receipt`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...auth },
            body: JSON.stringify(enrichedReceipt),
          }).catch(() => {});
        }
        sendResponse({ ok: true, cached: true, receiptId: receipt.execution_id || receipt.executionId });
      } catch (err) {
        sendResponse({ ok: true, cached: false, warning: err.message });
      }
      return;
    }
    if (message.type === 'complete-workspace') {
      const workspaceTab = sender.tab;
      if (!workspaceTab?.id || !isWorkspaceUrl(workspaceTab.url, chrome.runtime.getURL(''))) {
        sendResponse({ ok: false, error: 'Automatic close is limited to the Viscue workspace tab.' });
        return;
      }
      if (message.sourceTabId) {
        const destination = await chrome.tabs.get(message.sourceTabId).catch(() => null);
        if (destination?.id) {
          await chrome.tabs.update(destination.id, { active: true }).catch(() => {});
          if (destination.windowId) await chrome.windows.update(destination.windowId, { focused: true }).catch(() => {});
        }
      }
      sendResponse({ ok: true });
      await chrome.tabs.remove(workspaceTab.id).catch(() => {});
      return;
    }
    if (message.type === 'health') {
      try {
        const auth = await getAuthHeader();
        sendResponse(await (await fetch(`${API}/health`, { headers: auth })).json());
      }
      catch { sendResponse({ ok: false }); }
    }
  })().catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function getAuthHeader() {
  try {
    const data = await chrome.storage.local.get('viscue-api-key');
    const key = data?.['viscue-api-key'];
    return key ? { 'authorization': `Bearer ${key}` } : {};
  } catch {
    return {};
  }
}

async function openWorkspace(sourceTab) {
  const tab = sourceTab?.id ? sourceTab : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  const context = detectContext(tab);
  const url = new URL(chrome.runtime.getURL('index.html'));
  if (tab?.id) url.searchParams.set('sourceTab', String(tab.id));
  url.searchParams.set('destination', context.platform);
  const existing = (await chrome.tabs.query({ url: `${chrome.runtime.getURL('index.html')}*` }))[0];
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true, url: url.href });
    if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url: url.href, active: true });
}

function detectContext(tab = {}) {
  const parsed = parsePlatformChatContext(tab?.url || '');
  return {
    platform: parsed.platform,
    url: tab?.url || parsed.url,
    title: tab?.title || parsed.platform,
    tabId: tab?.id,
    chatId: `${parsed.platform}:${parsed.chatId}`,
    rawChatId: parsed.chatId,
    fingerprint: parsed.destinationFingerprint,
    destinationFingerprint: parsed.destinationFingerprint,
    isNewChat: parsed.isNewChat,
  };
}
