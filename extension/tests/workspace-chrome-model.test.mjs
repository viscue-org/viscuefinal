import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNextOpenMenu,
  getSelectedTool,
  resolveDockCommand,
  resolvePageCapture,
  resolveToolbarOption,
} from '../src/components/workspace/workspaceChromeModel.mjs';

test('requesting an open menu closes it', () => {
  assert.equal(getNextOpenMenu('assets', 'assets'), null);
});

test('current-page capture rejects a preview response without image data', () => {
  assert.deepEqual(resolvePageCapture({ ok: true, preview: true }), {
    ok: false,
    error: 'Current page capture needs an active browser tab.',
  });
});

test('current-page capture accepts a real image payload', () => {
  assert.deepEqual(resolvePageCapture({
    ok: true,
    dataUrl: 'data:image/png;base64,AAAA',
    title: 'Example',
    url: 'https://example.com/',
  }), {
    ok: true,
    dataUrl: 'data:image/png;base64,AAAA',
    title: 'Example',
    url: 'https://example.com/',
  });
});

test('requesting another menu replaces the current menu', () => {
  assert.equal(getNextOpenMenu('assets', 'annotate'), 'annotate');
});

test('selected tool reports the active annotation variant', () => {
  assert.equal(getSelectedTool('annotate', 'area', 'text'), 'area');
});

test('selected tool reports the active text variant', () => {
  assert.equal(getSelectedTool('text', 'annotate', 'sticky'), 'sticky');
});

test('cue resolves to an action instead of a canvas mode', () => {
  assert.deepEqual(resolveDockCommand('cue'), { kind: 'action', value: 'cue' });
});

test('toolbar options preserve existing App action boundaries', () => {
  assert.deepEqual(resolveToolbarOption('assets', 'image'), { kind: 'file', value: 'image' });
  assert.deepEqual(resolveToolbarOption('assets', 'video'), { kind: 'file', value: 'video' });
  assert.deepEqual(resolveToolbarOption('assets', 'document'), { kind: 'file', value: 'document' });
  assert.deepEqual(resolveToolbarOption('assets', 'screen'), { kind: 'capture', value: 'screen' });
  assert.deepEqual(resolveToolbarOption('assets', 'web'), { kind: 'dialog', value: 'webpage' });
  assert.deepEqual(resolveToolbarOption('annotate', 'area'), { kind: 'annotation', value: 'area' });
  assert.deepEqual(resolveToolbarOption('text', 's-note'), { kind: 'text', value: 'sticky' });
});
