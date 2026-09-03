import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssetMotionControls } from '../src/components/nodes/AssetMotionControls.mjs';

const renderControls = motion => renderToStaticMarkup(React.createElement(AssetMotionControls, {
  motion,
  onStart() {},
  onFinish() {},
  onCancel() {},
  onRemove() {},
}));

test('selected visual exposes one clear Motion action before recording', () => {
  const html = renderControls(null);
  assert.match(html, /aria-label="Motion"/);
  assert.doesNotMatch(html, /Finish motion|Motion saved/);
});

test('active recording exposes Finish motion and Cancel actions', () => {
  const html = renderControls({ active: true, path: [] });
  assert.match(html, /Recording motion/);
  assert.match(html, /aria-label="Finish motion"/);
  assert.match(html, /aria-label="Cancel motion"/);
});

test('saved motion can be recorded again or removed', () => {
  const html = renderControls({ active: false, path: [{}, {}] });
  assert.match(html, /Motion saved/);
  assert.match(html, /aria-label="Record motion again"/);
  assert.match(html, /aria-label="Remove motion"/);
});
