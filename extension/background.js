import { signIn, signOut, getSession } from './auth/session.mjs';
import { apiFetch } from './api/client.mjs';
import { VISCUE_WEB_URL } from './api/config.mjs';

const API = 'http://127.0.0.1:8787';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === 'auth-sign-in') {
      const session = await signIn();
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
      const summary = await apiFetch('/account/summary');
      sendResponse(summary);
      return;
    }
    if (message.type === 'billing-open') {
      await chrome.tabs.create({ url: `${VISCUE_WEB_URL}/account#plans`, active: true });
      sendResponse({ ok: true });
      return;
    }
    if (message.type === 'open-workspace') {
      await openWorkspace(sender.tab);
      sendResponse({ ok: true });
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
    if (message.type === 'capture-url') {
      const targetUrl = message.url;
      const tabs = await chrome.tabs.query({});
      let tab = tabs.find(t => t.url && (t.url.startsWith(targetUrl) || t.url.replace(/\/$/, '') === targetUrl.replace(/\/$/, '')));
      let created = false;
      if (!tab) {
        tab = await chrome.tabs.create({ url: targetUrl, active: false });
        created = true;
        await new Promise((resolve) => {
          const listener = (tabId, info) => {
            if (tabId === tab.id && (info.status === 'complete' || info.title)) {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          setTimeout(resolve, 3500);
        });
      }
      
      const [previous] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
      let dataUrl;
      try {
        await chrome.tabs.update(tab.id, { active: true });
        await new Promise(resolve => setTimeout(resolve, 280));
        dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      } finally {
        if (created) {
          await chrome.tabs.remove(tab.id).catch(() => {});
        }
        if (previous?.id && previous.id !== tab.id) {
          await chrome.tabs.update(previous.id, { active: true }).catch(() => {});
        }
      }
      sendResponse({ ok: true, dataUrl, url: tab.url, title: tab.title });
      return;
    }
    if (message.type === 'active-context') {
      const tab = message.tabId ? await chrome.tabs.get(message.tabId) : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
      sendResponse({ ok: true, context: detectContext(tab) });
      return;
    }
    if (message.type === 'compile') {
      try {
        const result = await apiFetch('/compile/vicsuc', {
          method: 'POST',
          body: JSON.stringify(message.payload),
        });
        sendResponse(result);
      } catch (err) {
        try {
          const auth = await getAuthHeader();
          const response = await fetch(`${API}/compile`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...auth },
            body: JSON.stringify(message.payload),
          });
          sendResponse(await response.json());
        } catch {
          sendResponse({ ok: false, error: err.message, code: err.code });
        }
      }
      return;
    }
    if (message.type === 'insert-prompt') {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id) throw new Error('No active destination tab');
      sendResponse(await chrome.tabs.sendMessage(tab.id, { type: 'insert-prompt', prompt: message.prompt }));
      return;
    }
    if (message.type === 'handoff') {
      const tab = message.tabId ? await chrome.tabs.get(message.tabId) : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
      if (!tab?.id) throw new Error('Open the destination AI chat before sending intent.');
      sendResponse(await chrome.tabs.sendMessage(tab.id, {
        type: 'handoff', prompt: message.prompt, attachments: message.attachments || [], submit: Boolean(message.submit),
        executionId: message.executionId, destinationFingerprint: message.destinationFingerprint, promptHash: message.promptHash
      }));
      return;
    }
    if (message.type === 'handoff-receipt') {
      const auth = await getAuthHeader();
      const response = await fetch(`${API}/handoff-receipt`, { method: 'POST', headers: { 'content-type': 'application/json', ...auth }, body: JSON.stringify(message.receipt) });
      sendResponse(await response.json());
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
  const url = tab.url || '';
  const platform = url.includes('gemini.google') ? 'Gemini' : url.includes('claude.ai') ? 'Claude' :
    url.includes('copilot.microsoft') ? 'Copilot' : url.includes('perplexity') ? 'Perplexity' :
    url.includes('grok.com') ? 'Grok' : 'ChatGPT';
  
  const parsed = new URL(url || 'https://chatgpt.com');
  let chatId = parsed.pathname;
  if (platform === 'ChatGPT' && parsed.pathname.includes('/c/')) chatId = parsed.pathname.split('/c/')[1];
  else if (platform === 'Gemini' && parsed.pathname.includes('/app/')) chatId = parsed.pathname.split('/app/')[1];
  else if (platform === 'Claude' && parsed.pathname.includes('/chat/')) chatId = parsed.pathname.split('/chat/')[1];
  
  return { platform, url, title: tab.title || platform, tabId: tab.id, chatId: `${platform}:${chatId}`, fingerprint: `${platform}:${parsed.pathname}` };
}
