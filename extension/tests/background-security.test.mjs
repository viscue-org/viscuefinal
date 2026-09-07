import test from 'node:test';
import assert from 'node:assert/strict';

test('cloud quota denial never falls back to an unmetered local compilation', async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  let listener;
  const urls = [];
  globalThis.chrome = {
    runtime: { onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: { async get() { return { viscue_oauth_session: { accessToken: 'test', expiresAt: Date.now() + 100000 } }; } } },
  };
  globalThis.fetch = async url => {
    urls.push(String(url));
    if (String(url).includes('127.0.0.1')) return Response.json({ ok: true, final_prompt: 'bypassed quota' });
    return Response.json({ error: 'quota exhausted' }, { status: 429 });
  };
  try {
    await import('../background.js');
    const result = await new Promise(resolve => listener({ type: 'compile', payload: { graph: { items: [] } } }, {}, resolve));
    assert.equal(result.ok, false);
    assert.equal(result.code, 'quota_exhausted');
    assert.equal(urls.some(url => url.includes('127.0.0.1')), false);
  } finally { globalThis.chrome = originalChrome; globalThis.fetch = originalFetch; }
});
