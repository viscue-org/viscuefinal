import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlatformPlanSettings } from '../src/components/ui/PlatformPlanSettings.mjs';

test('Settings exposes the detected AI platform plan and resulting visual limit', () => {
  const html = renderToStaticMarkup(React.createElement(PlatformPlanSettings, {
    platformName: 'Gemini',
    capability: { platform: 'gemini', plan: 'pro' },
    viscuePlan: 'plus',
    onChange() {},
  }));
  assert.match(html, /AI platform plan/);
  assert.match(html, /Gemini/);
  assert.match(html, /Google AI Pro/);
  assert.match(html, /10 visual references/);
});
