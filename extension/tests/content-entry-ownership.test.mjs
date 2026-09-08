import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('current extension replaces an unowned legacy composer entry', () => {
  const legacy = { dataset: {}, removed: false, remove() { this.removed = true; } };
  const appended = [];
  const parent = { append(node) { appended.push(node); } };
  const composer = { closest() { return parent; }, parentElement: parent };
  const document = {
    documentElement: {},
    body: { innerText: '' },
    getElementById(id) { return id === 'viscue-composer-entry' && !legacy.removed ? legacy : null; },
    querySelector() { return composer; },
    createElement() {
      return {
        dataset: {},
        addEventListener() {},
      };
    },
  };
  const chrome = {
    runtime: {
      id: 'current-extension-id',
      getManifest: () => ({ version: '3.3.0' }),
      sendMessage() {},
      onMessage: { addListener() {} },
    },
  };
  class MutationObserver { observe() {} }

  vm.runInNewContext(fs.readFileSync(new URL('../content.js', import.meta.url), 'utf8'), {
    chrome,
    console,
    document,
    location: { hostname: 'chatgpt.com', pathname: '/c/test' },
    MutationObserver,
    globalThis: {},
  });

  assert.equal(legacy.removed, true);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].dataset.viscueExtensionId, 'current-extension-id');
  assert.equal(appended[0].dataset.viscueVersion, '3.3.0');
});
