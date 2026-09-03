# Figma Workspace Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the Viscue workspace to the approved MCPVIS Figma layout while retaining every working Viscue 3.3 feature and backend contract.

**Architecture:** Keep `App.jsx` as the owner of graph, history, persistence, compilation, and handoff behavior. Replace the oversized workspace chrome with focused controlled React components driven by a small pure UI-state model, while retaining the existing callbacks and dialogs. CSS tokens and responsive rules reproduce the Figma shell without changing React Flow or local-server code.

**Tech Stack:** React 19, Vite 7, React Flow 12, Phosphor/Lucide icons, CSS, Node built-in test runner

**Spec:** `docs/superpowers/specs/2026-09-01-figma-workspace-restoration-design.md`

## Global Constraints

- The MCPVIS Figma file `NfQ9Zmh2p69p5T2eBAfSg4` is the visual source of truth.
- Existing Viscue 3.3 graph, persistence, compilation, provider routing, handoff, and receipt schemas must not change.
- Preserve Chrome Manifest V3 compatibility and do not add a network-only runtime dependency.
- Use steel blue `#50697f`, white `#ffffff`, and light gray `#d9d9d9` as the reference palette.
- Every icon-only action requires an accessible name, focus treatment, and tooltip.
- Respect `prefers-reduced-motion` and constrained extension viewports.
- The workspace has no Git metadata; replace commit steps with `npm run checkpoint` source-manifest checkpoints and report this limitation.

## File Structure

- Create `extension/src/components/workspace/workspaceChromeModel.mjs`: pure menu/tool transition and feature-definition model.
- Create `extension/src/components/workspace/WorkspaceChrome.jsx`: controlled destination, utility, empty-state, command-dock, and history presentation.
- Create `extension/src/components/workspace/WorkspaceChrome.css`: Figma-aligned shell, dock, menus, history, themes, responsive rules, and focus/motion states.
- Create `extension/tests/workspace-chrome-model.test.mjs`: behavior tests for tool/menu transitions and command routing.
- Create `extension/tests/workspace-chrome-render.test.mjs`: server-rendered accessibility and state tests against the real React components.
- Modify `extension/src/App.jsx`: connect existing workspace actions to the new controlled presentation.
- Modify `extension/src/styles.css`: remove or neutralize conflicting legacy shell rules and expose shared Figma tokens.
- Modify `package.json`: include extension UI tests in `npm test`.

---

### Task 1: Define and test the workspace chrome state model

**Files:**
- Create: `extension/tests/workspace-chrome-model.test.mjs`
- Create: `extension/src/components/workspace/workspaceChromeModel.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `WORKSPACE_MENUS`, `WORKSPACE_TOOLS`, `getNextOpenMenu(openMenu, requestedMenu)`, `getSelectedTool(mode, annotationTool, textTool)`, `resolveDockCommand(command)`, and later `resolveToolbarOption(panel, option)`.
- `resolveDockCommand(command)` returns one of `{ kind: 'mode', value }`, `{ kind: 'action', value }`, or `{ kind: 'menu', value }`.

- [ ] **Step 1: Add extension tests to the test command and write the failing model tests**

Change the test script to:

```json
"test": "node --test local-server/tests/*.test.mjs gesture/tests/*.test.mjs extension/tests/*.test.mjs"
```

Create tests using literal expectations:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNextOpenMenu,
  getSelectedTool,
  resolveDockCommand,
} from '../src/components/workspace/workspaceChromeModel.mjs';

test('requesting an open menu closes it', () => {
  assert.equal(getNextOpenMenu('assets', 'assets'), null);
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
```

- [ ] **Step 2: Run the model test and verify RED**

Run: `node --test extension/tests/workspace-chrome-model.test.mjs`

Expected: FAIL because `workspaceChromeModel.mjs` does not exist.

- [ ] **Step 3: Implement the smallest pure model that satisfies the tests**

```js
export const WORKSPACE_MENUS = Object.freeze(['assets', 'annotate', 'text']);
export const WORKSPACE_TOOLS = Object.freeze(['select', 'assets', 'annotate', 'text']);

export function getNextOpenMenu(openMenu, requestedMenu) {
  return openMenu === requestedMenu ? null : requestedMenu;
}

export function getSelectedTool(mode, annotationTool, textTool) {
  if (mode === 'annotate') return annotationTool;
  if (mode === 'text') return textTool === 'sticky' ? 'sticky' : 'text';
  return mode || 'select';
}

export function resolveDockCommand(command) {
  if (WORKSPACE_MENUS.includes(command)) return { kind: 'menu', value: command };
  if (['undo', 'redo', 'cue'].includes(command)) return { kind: 'action', value: command };
  return { kind: 'mode', value: command };
}
```

- [ ] **Step 4: Run the model test and full regression suite**

Run: `node --test extension/tests/workspace-chrome-model.test.mjs`

Expected: PASS with 5 tests.

Run: `npm test`

Expected: the existing 148 tests plus the new model tests pass.

- [ ] **Step 5: Save a source checkpoint**

Run: `npm run checkpoint`

Expected: `artifacts/manifests/source-current.json` is regenerated successfully.

---

### Task 2: Build the controlled Figma command dock and verify its rendered contract

**Files:**
- Create: `extension/tests/workspace-chrome-render.test.mjs`
- Create: `extension/src/components/workspace/WorkspaceChrome.jsx`
- Create: `extension/src/components/workspace/WorkspaceChrome.css`

**Interfaces:**
- `WorkspaceCommandDock({ mode, annotationTool, textTool, openMenu, canUndo, canRedo, busy, onCommand, onOption, onMenuChange })`.
- `onCommand(command)` receives `select`, `undo`, `redo`, or `cue`.
- `onOption(panel, option)` receives existing App values: Assets `image|video|document|screen|web`; Annotate `annotate|area|draw|erase`; Text `text|s-note`.
- `onMenuChange(menuOrNull)` owns mutually exclusive menu visibility in `App.jsx`.

- [ ] **Step 1: Write failing render tests against the real component**

Use `renderToStaticMarkup` so the test exercises the shipped component without mocks:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceCommandDock } from '../src/components/workspace/WorkspaceChrome.jsx';

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

test('base dock renders accessible icon actions and a visible Cue label', () => {
  const html = renderDock();
  for (const name of ['Select', 'Add assets', 'Annotate', 'Add text', 'Undo', 'Cue']) {
    assert.match(html, new RegExp(`aria-label="${name}"`));
  }
  assert.match(html, />Cue</);
});

test('assets state exposes every supported source', () => {
  const html = renderDock({ openMenu: 'assets' });
  for (const name of ['Image', 'Video', 'Document', 'Current page', 'Web page']) {
    assert.match(html, new RegExp(`>${name}<`));
  }
});

test('undo and redo expose disabled state independently', () => {
  const html = renderDock({ canUndo: true, canRedo: false });
  assert.match(html, /aria-label="Undo"/);
  assert.match(html, /aria-label="Redo"[^>]*disabled/);
});
```

- [ ] **Step 2: Run the render test and verify RED**

Run: `node --test extension/tests/workspace-chrome-render.test.mjs`

Expected: FAIL because `WorkspaceChrome.jsx` does not exist.

- [ ] **Step 3: Implement the controlled command dock**

Build semantic `<nav>` and `<button>` elements using existing local icon packages. Use the pure model to derive selected states. Render one menu at a time with `role="menu"`; route all values through the exact interfaces above. Put the visible label only on `Cue`; keep main tool labels in `aria-label` and `title`.

The base markup must follow this shape:

```jsx
<nav className="workspace-dock" aria-label="Workspace tools">
  <div className="workspace-dock__menu" data-open={Boolean(openMenu)}>{menu}</div>
  <div className="workspace-dock__rail">{toolButtons}{historyButtons}</div>
  <button className="workspace-dock__cue" aria-label="Cue" disabled={busy}>Cue</button>
</nav>
```

Use `aria-pressed` for selected tools, `aria-expanded` and `aria-controls` for menus, and native `disabled` for unavailable Undo, Redo, and Cue states.

- [ ] **Step 4: Add Figma-aligned dock CSS without changing global canvas behavior**

Define component-scoped tokens and dimensions in `WorkspaceChrome.css`:

```css
.workspace-chrome {
  --workspace-steel: #50697f;
  --workspace-white: #ffffff;
  --workspace-soft: #d9d9d9;
  --workspace-ink: #17222d;
}

.workspace-dock {
  position: fixed;
  inset-inline-start: 50%;
  inset-block-end: 12px;
  transform: translateX(-50%);
  display: flex;
  align-items: flex-end;
  gap: 10px;
  z-index: 40;
}
```

Use a rounded, sculpted rail, 36–40px hit targets, a separate steel `Cue` pill, and a menu positioned above the rail. Add focus-visible outlines, `[aria-pressed="true"]` structure changes, dark theme tokens, narrow-viewport wrapping, and reduced-motion rules.

- [ ] **Step 5: Run the component tests and build**

Run: `node --test extension/tests/workspace-chrome-render.test.mjs`

Expected: PASS with 3 tests.

Run: `npm run build`

Expected: Vite build succeeds with no new errors.

- [ ] **Step 6: Save a source checkpoint**

Run: `npm run checkpoint`

Expected: the manifest captures the new component files.

---

### Task 3: Build the remaining Figma workspace chrome states

**Files:**
- Modify: `extension/tests/workspace-chrome-render.test.mjs`
- Modify: `extension/src/components/workspace/WorkspaceChrome.jsx`
- Modify: `extension/src/components/workspace/WorkspaceChrome.css`

**Interfaces:**
- `WorkspaceDestination({ label = 'ChatGPT' })` renders the upper-left destination pill.
- `WorkspaceUtilities({ theme, onThemeToggle, onHistoryOpen, onClose })` renders upper-right appearance, history, and close controls.
- `WorkspaceEmptyState({ onAdd })` renders `Show What You Mean` and routes `Click here` to the Assets menu.
- `WorkspaceHistory({ items, onClose, onRestore, onDelete })` renders the centered history surface; `onDelete` is optional until App exposes a delete callback.

- [ ] **Step 1: Add failing render tests for all Figma shell states**

Append literal behavior checks:

```js
test('empty state presents the Figma message and add affordance', () => {
  const html = renderToStaticMarkup(React.createElement(WorkspaceEmptyState, { onAdd() {} }));
  assert.match(html, /Show/);
  assert.match(html, /What/);
  assert.match(html, /You/);
  assert.match(html, /Mean/);
  assert.match(html, /Click here/);
});

test('utility cluster exposes appearance history and close actions', () => {
  const html = renderToStaticMarkup(React.createElement(WorkspaceUtilities, {
    theme: 'light', onThemeToggle() {}, onHistoryOpen() {}, onClose() {},
  }));
  for (const name of ['Switch to dark mode', 'Open history', 'Clear workspace']) {
    assert.match(html, new RegExp(`aria-label="${name}"`));
  }
});

test('history renders a restore action for a persisted snapshot', () => {
  const html = renderToStaticMarkup(React.createElement(WorkspaceHistory, {
    items: [{ id: 'one', title: 'Example 1', createdAt: '2026-09-01T10:00:00.000Z' }],
    onClose() {}, onRestore() {},
  }));
  assert.match(html, /Example 1/);
  assert.match(html, /Restore/);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test extension/tests/workspace-chrome-render.test.mjs`

Expected: FAIL because the named exports are missing.

- [ ] **Step 3: Implement the destination, utilities, empty, and history components**

Use semantic buttons and headings. Keep history controlled and render `items.length === 0` as a friendly empty message. Derive the appearance accessible name from `theme`; do not keep duplicate internal theme state.

- [ ] **Step 4: Complete the Figma state styling**

Match these captured states in component-scoped CSS:

- light empty shell;
- selected/populated canvas with the chrome receding behind content;
- centered steel-blue history card;
- dark steel-blue-gray canvas;
- compact Assets, Annotate, Text, and Undo/Redo menus.

At widths below 520px, keep utilities in the upper-right and allow dock menus to use `max-width: calc(100vw - 24px)`. At heights below 420px, reduce empty-state typography and dock bottom offset without shrinking hit targets below 36px.

- [ ] **Step 5: Run tests, regression suite, and build**

Run: `node --test extension/tests/workspace-chrome-render.test.mjs`

Expected: all render tests pass.

Run: `npm test`

Expected: all backend, gesture, model, and render tests pass.

Run: `npm run build`

Expected: production build succeeds.

- [ ] **Step 6: Save a source checkpoint**

Run: `npm run checkpoint`

Expected: manifest regeneration succeeds.

---

### Task 4: Connect the new chrome to existing Viscue behavior

**Files:**
- Modify: `extension/src/App.jsx:23`
- Modify: `extension/src/App.jsx:1095-1106`
- Modify: `extension/src/App.jsx:1120-1177`
- Modify: `extension/src/App.jsx:1252-1268`
- Modify: `extension/src/styles.css:128-145`
- Modify: `extension/src/styles.css:420-499`

**Interfaces:**
- App owns `openChromeMenu` and closes it on Escape, outside canvas action, or after an option is chosen.
- Existing callbacks remain the source of behavior: `pickFile`, `capturePage`, `setDialog`, `setAnnotationTool`, `setTextTool`, `setNodeMode`, `undo`, `redo`, `openSend`, `toggleTheme`, `clearAll`, and persistent-history restore.
- `resolveToolbarOption(panel, option)` returns `{ kind, value }` with `kind` equal to `file`, `capture`, `dialog`, `annotation`, or `text`, so App routes menu values without duplicating the menu definition.

- [ ] **Step 1: Add failing model tests for App option mappings**

Import `resolveToolbarOption` from the model and add literal expectations for every App option branch:

```js
test('toolbar options preserve existing App action boundaries', () => {
  assert.deepEqual(resolveToolbarOption('assets', 'image'), { kind: 'file', value: 'image' });
  assert.deepEqual(resolveToolbarOption('assets', 'video'), { kind: 'file', value: 'video' });
  assert.deepEqual(resolveToolbarOption('assets', 'document'), { kind: 'file', value: 'document' });
  assert.deepEqual(resolveToolbarOption('assets', 'screen'), { kind: 'capture', value: 'screen' });
  assert.deepEqual(resolveToolbarOption('assets', 'web'), { kind: 'dialog', value: 'webpage' });
  assert.deepEqual(resolveToolbarOption('annotate', 'area'), { kind: 'annotation', value: 'area' });
  assert.deepEqual(resolveToolbarOption('text', 's-note'), { kind: 'text', value: 'sticky' });
});
```

- [ ] **Step 2: Run the focused model test and verify RED**

Run: `node --test extension/tests/workspace-chrome-model.test.mjs`

Expected: FAIL because `resolveToolbarOption` is not exported.

- [ ] **Step 3: Implement the minimal option resolver and rerun the focused test**

```js
export function resolveToolbarOption(panel, option) {
  if (panel === 'assets' && ['image', 'video', 'document'].includes(option)) return { kind: 'file', value: option };
  if (panel === 'assets' && option === 'screen') return { kind: 'capture', value: 'screen' };
  if (panel === 'assets' && option === 'web') return { kind: 'dialog', value: 'webpage' };
  if (panel === 'annotate') return { kind: 'annotation', value: option };
  if (panel === 'text') return { kind: 'text', value: option === 's-note' ? 'sticky' : 'text' };
  return null;
}
```

Run: `node --test extension/tests/workspace-chrome-model.test.mjs`

Expected: PASS.

- [ ] **Step 4: Integrate the new components into App**

Replace the `ViewSwitcher`/`CenterFloatingBar`/`UtilityMenu`/`CloseButton` three-section shell and web-component empty/history UI with:

```jsx
<WorkspaceDestination label="ChatGPT" />
{!nodes.length && mode === 'select' && (
  <WorkspaceEmptyState onAdd={() => setOpenChromeMenu('assets')} />
)}
<WorkspaceCommandDock
  mode={mode}
  annotationTool={annotationTool}
  textTool={textTool}
  openMenu={openChromeMenu}
  canUndo={history.length > 0}
  canRedo={future.length > 0}
  busy={busy}
  onCommand={handleChromeCommand}
  onOption={handleChromeOption}
  onMenuChange={setOpenChromeMenu}
/>
<WorkspaceUtilities
  theme={theme}
  onThemeToggle={toggleTheme}
  onHistoryOpen={() => setDialog({ type: 'history' })}
  onClose={clearAll}
/>
```

Map each option to the existing callbacks exactly as the old toolbar did. Retain `CanvasInventoryPanel` and grid capabilities through contextual utility access rather than deleting their state or handlers.

- [ ] **Step 5: Connect history without changing persistence data**

Render `WorkspaceHistory` inside the existing backdrop and pass `persistentHistory` directly. Restore with `hydrateWorkspace(snapshot)` and the existing `setNodes`, `setEdges`, and `setGestureOperations` calls. Do not reshape saved history records.

- [ ] **Step 6: Remove conflicting shell CSS and preserve node/dialog styling**

Delete or neutralize only legacy rules for `.bottom-bar-layout`, `.bottom-bar-left`, `.bottom-bar-center`, `.bottom-bar-right`, `.canvas-empty-state`, and the old empty hero. Keep React Flow nodes, node toolbars, dialogs, toast, busy chip, crop, video, document, and inventory rules intact.

Set the shared tokens to the Figma references while retaining aliases used by nodes:

```css
--viscue-signal: #50697f;
--viscue-canvas: #ffffff;
--viscue-paper: #ffffff;
--viscue-hairline: #d9d9d9;
```

Dark mode may use the Figma steel overlay reference while maintaining WCAG-readable text and controls.

- [ ] **Step 7: Run focused tests, all tests, and build**

Run: `node --test extension/tests/*.test.mjs`

Expected: all workspace chrome tests pass.

Run: `npm test`

Expected: all tests pass with no failures.

Run: `npm run build`

Expected: Vite production build succeeds.

- [ ] **Step 8: Save a source checkpoint**

Run: `npm run checkpoint`

Expected: source manifest regeneration succeeds.

---

### Task 5: Verify the complete feature story and visual fidelity

**Files:**
- Modify only if verification reveals a reproducible failure: the component or test that owns that behavior.

**Interfaces:**
- Browser flow consumes the built/dev extension UI and the existing local server.
- Visual references are `scratch/figma-mcpvis/10-124.png`, `10-198.png`, `11-387.png`, `10-281.png`, `10-248.png`, `4-25.png`, `10-34.png`, `10-64.png`, `10-89.png`, and `10-106.png`.

- [ ] **Step 1: Start the local server and Vite workspace for verification**

Run local server: `npm run server`

Run UI: `npm run dev -- --host 127.0.0.1`

Expected: both processes remain healthy and the workspace loads without console errors.

- [ ] **Step 2: Verify the visual states at desktop and constrained extension sizes**

Capture and compare:

- empty light workspace;
- Assets, Annotate, Text, and Undo/Redo menu states;
- selected image asset;
- History surface;
- dark appearance.

Check hierarchy, placement, steel palette, icon-only base dock, selected-state structure, menu proximity, and content clearance against the referenced Figma images.

- [ ] **Step 3: Smoke-test every preserved use case**

Perform this real interaction sequence:

1. Add an image, video, document, webpage URL, and current-page capture.
2. Create point, area, draw/highlight, and erase annotations.
3. Add plain text and a sticky note.
4. Undo, redo, save/restore History, and toggle appearance.
5. Open crop, video frame/range, document extraction, motion, Preserve, copy, and delete actions on applicable nodes.
6. Run Cue through validation, compilation, verification, handoff, and receipt status using the configured local test destination.

Expected: each action reaches its existing handler, displays an actionable result, and does not lose graph state.

- [ ] **Step 4: Turn every discovered failure into a failing automated test before fixing it**

For a model/render failure, add the smallest failing case to `extension/tests`. For a backend or gesture regression, add the case to the owning existing suite. Watch it fail for the expected reason, implement the minimal correction, and rerun the focused test.

- [ ] **Step 5: Run final verification**

Run: `npm test`

Expected: existing 148 tests plus all new workspace tests pass.

Run: `npm run build`

Expected: Vite build succeeds; pre-existing chunk-size warnings may remain, but no new warnings or errors are introduced.

Run: `npm run checkpoint`

Expected: final source manifest is written successfully.
