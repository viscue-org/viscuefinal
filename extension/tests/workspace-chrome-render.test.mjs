import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  WorkspaceCommandDock,
  WorkspaceDestination,
  WorkspaceEmptyState,
  WorkspaceHistory,
  WorkspaceUtilities,
} from '../src/components/workspace/WorkspaceChrome.mjs';

const renderDock = overrides => renderToStaticMarkup(React.createElement(WorkspaceCommandDock, {
  mode: 'select',
  annotationTool: 'annotate',
  textTool: 'text',
  openMenu: null,
  canUndo: false,
  canRedo: false,
  busy: false,
  onCommand() {},
  onOption() {},
  onMenuChange() {},
  ...overrides,
}));

test('base dock uses one unique icon per tool and keeps Cue text-only', () => {
  const html = renderDock();
  for (const name of ['Select', 'Add assets', 'Annotate', 'Add text', 'Undo and redo', 'Cue']) {
    assert.match(html, new RegExp(`aria-label="${name}"`));
  }
  assert.doesNotMatch(html, /aria-label="Redo"/);
  const icons = [...html.matchAll(/data-icon="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(icons, ['hand', 'plus', 'annotation', 'text', 'undo']);
  assert.equal(new Set(icons).size, icons.length);
  assert.match(html, /aria-label="Cue"[^>]*><span>Cue<\/span>/);
  assert.match(html, /class="workspace-dock__frame" aria-hidden="true"/);
});

test('destination is a text-only pill without decorative icons', () => {
  const html = renderToStaticMarkup(React.createElement(WorkspaceDestination, { label: 'ChatGPT' }));
  assert.match(html, />ChatGPT<\/div>/);
  assert.doesNotMatch(html, /<svg/);
});

test('assets state exposes every supported source', () => {
  const html = renderDock({ openMenu: 'assets' });
  for (const name of ['Image', 'Video', 'Document', 'Current page', 'Web page']) {
    assert.match(html, new RegExp(`aria-label="${name}"`));
  }
});

test('undo and redo expose disabled state independently', () => {
  const html = renderDock({ openMenu: 'history', canUndo: true, canRedo: false });
  assert.match(html, /aria-label="Undo"/);
  assert.match(html, /aria-label="Redo"[^>]*disabled/);
});

test('empty state presents the Figma message and add affordance', () => {
  const html = renderToStaticMarkup(React.createElement(WorkspaceEmptyState, { onAdd() {} }));
  for (const word of ['Show', 'What', 'You', 'Mean', 'Click here']) assert.match(html, new RegExp(word));
  assert.doesNotMatch(html, /<svg/);
});

test('utility cluster contains only appearance history and close actions', () => {
  const html = renderToStaticMarkup(React.createElement(WorkspaceUtilities, {
    theme: 'light',
    onThemeToggle() {},
    onHistoryOpen() {},
    onClose() {},
  }));
  for (const name of ['Switch to dark mode', 'Open history', 'Clear workspace']) {
    assert.match(html, new RegExp(`aria-label="${name}"`));
  }
  assert.doesNotMatch(html, /Workspace options/);
  assert.equal((html.match(/<button/g) || []).length, 3);
  const icons = [...html.matchAll(/data-icon="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(icons, ['theme', 'history', 'close']);
});

test('history exposes every snapshot and retention action without a clipped popover', () => {
  const html = renderToStaticMarkup(React.createElement(WorkspaceHistory, {
    items: [{ id: 'one', title: 'Example 1', timestamp: Date.parse('2026-09-01T10:00:00.000Z'), nodes: [{ id: 'asset-1' }], edges: [] }],
    historyConfig: { autoDeleteHours: 48 },
    onHistoryConfigChange() {},
    onClose() {},
    onRestore() {},
    onExport() {},
    onDelete() {},
    onImport() {},
    onClearAll() {},
  }));
  assert.match(html, /Example 1/);
  assert.match(html, /Restore/);
  assert.match(html, /1 reference/);
  for (const name of ['Export Example 1', 'Delete Example 1', 'Import workspace', 'Clear all history', 'Close history']) {
    assert.match(html, new RegExp(`aria-label="${name}"`));
  }
  assert.match(html, /Auto-delete history older than/);
  assert.match(html, /<option value="48" selected="">48 hours<\/option>/);
  assert.doesNotMatch(html, /auto-delete-dropdown/);
});
