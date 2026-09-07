import test from 'node:test';
import assert from 'node:assert/strict';
import { isWorkspaceUrl, shouldCloseWorkspace } from '../api/workspaceCompletion.mjs';

test('workspace closes only after verified handoff and cached receipt', () => {
  assert.equal(shouldCloseWorkspace(
    { ok: true, prompt_verified: true, submitted: true },
    { ok: true, cached: true },
  ), true);
});

test('workspace remains open for failed or unverified completion', () => {
  assert.equal(shouldCloseWorkspace({ ok: false }, { ok: true, cached: true }), false);
  assert.equal(shouldCloseWorkspace({ ok: true, prompt_verified: false }, { ok: true, cached: true }), false);
  assert.equal(shouldCloseWorkspace({ ok: true, prompt_verified: true }, { ok: true, cached: false }), false);
});

test('only the extension workspace page is eligible for automatic removal', () => {
  const root = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/';
  assert.equal(isWorkspaceUrl(`${root}index.html?sourceTab=8`, root), true);
  assert.equal(isWorkspaceUrl(`${root}popup.html`, root), false);
  assert.equal(isWorkspaceUrl('chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba/index.html', root), false);
  assert.equal(isWorkspaceUrl('https://chatgpt.com/', root), false);
});
