import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('current extension replaces an unowned legacy composer entry', () => {
  const legacy = { dataset: {}, removed: false, remove() { this.removed = true; } };
  const composerChildren = [];
  const bodyChildren = [];
  const parent = { append(node) { composerChildren.push(node); } };
  const composer = { closest() { return parent; }, parentElement: parent };
  const document = {
    documentElement: {},
    body: { innerText: '', append(node) { bodyChildren.push(node); } },
    getElementById(id) { return id === 'viscue-composer-entry' && !legacy.removed ? legacy : null; },
    querySelector() { return composer; },
    createElement() {
      return {
        dataset: {},
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
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
  const window = { addEventListener() {} };

  vm.runInNewContext(fs.readFileSync(new URL('../content.js', import.meta.url), 'utf8'), {
    chrome,
    console,
    document,
    location: { hostname: 'chatgpt.com', pathname: '/c/test' },
    MutationObserver,
    window,
    globalThis: {},
  });

  assert.equal(legacy.removed, true);
  assert.equal(composerChildren.length, 0);
  assert.equal(bodyChildren.length, 1);
  assert.equal(bodyChildren[0].dataset.viscueExtensionId, 'current-extension-id');
  assert.equal(bodyChildren[0].dataset.viscueVersion, '3.3.0');
  assert.equal(bodyChildren[0].attributes['aria-label'], 'Open Viscue visual workspace');
});
