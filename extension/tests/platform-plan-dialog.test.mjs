import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlatformPlanDialog } from '../src/components/dialogs/PlatformPlanDialog.mjs';

test('first-time dialog is platform scoped, explains the effective limit, and cannot be dismissed', () => {
  const html = renderToStaticMarkup(React.createElement(PlatformPlanDialog, {
    platformName: 'Claude',
    initialCapability: { platform: 'claude', plan: 'free' },
    viscuePlan: 'plus',
    onSave() {},
  }));
  assert.match(html, /Choose your Claude plan/);
  assert.match(html, /Free/);
  assert.match(html, /Pro/);
  assert.match(html, /Max/);
  assert.match(html, /2 visual references/);
  assert.match(html, /Continue to Workspace/);
  assert.doesNotMatch(html, /Close dialog|Cancel/);
});
