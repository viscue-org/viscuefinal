# Viscue Icon Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a validated 72-icon Viscue library as standalone SVG files, React components, metadata, previews, and migration documentation.

**Architecture:** A single declarative icon-definition module is the source of truth. A deterministic generator produces raw SVGs, React exports, metadata, and preview markup from those definitions; validators compare every generated surface to prevent drift.

**Tech Stack:** Node.js 20+, ES modules, React 19, `node:test`, server-side React rendering

**Spec:** `docs/superpowers/specs/2026-09-10-viscue-icon-font-system-design.md`

## Global Constraints

- Create everything under `viscue-brand-kit/`; do not replace production workspace icons in this phase.
- Use a `24 × 24` viewBox, `1.8` default stroke, round caps, and round joins.
- Utility icons use `currentColor`, remain fill-free by default, and contain no external resources or embedded text.
- Produce exactly 72 unique icons: the 44 existing workspace actions and 28 Viscue-specific additions listed in the spec.
- Preserve recognizable silhouettes at 16, 20, 24, and 32 CSS pixels.
- The open-eye/C and cue-dash motif appears only when it strengthens meaning.

---

## File map

- `viscue-brand-kit/package.json` — isolated scripts for icon building and validation.
- `viscue-brand-kit/icons/source/icon-definitions.js` — canonical icon names, geometry, categories, and keywords.
- `viscue-brand-kit/icons/source/render-icon.js` — serializes geometry to safe SVG and JSX.
- `viscue-brand-kit/icons/svg/*.svg` — generated standalone assets.
- `viscue-brand-kit/icons/react/ViscueIcon.jsx` — accessible generic React renderer.
- `viscue-brand-kit/icons/react/icons.js` — generated named exports.
- `viscue-brand-kit/icons/react/index.js` — package entry point.
- `viscue-brand-kit/icons/metadata/icons.json` — generated discovery metadata.
- `viscue-brand-kit/icons/preview/index.html` — generated size and theme inspection page.
- `viscue-brand-kit/scripts/build-icons.mjs` — atomic generator.
- `viscue-brand-kit/scripts/validate-icons.mjs` — structural validator.
- `viscue-brand-kit/tests/icon-source.test.mjs` — source-schema and count tests.
- `viscue-brand-kit/tests/icon-output.test.mjs` — generated-output and React-rendering tests.
- `viscue-brand-kit/README.md` — installation, accessibility, and migration map.

### Task 1: Establish the icon source schema and renderer

**Files:**
- Create: `viscue-brand-kit/package.json`
- Create: `viscue-brand-kit/icons/source/icon-definitions.js`
- Create: `viscue-brand-kit/icons/source/render-icon.js`
- Create: `viscue-brand-kit/tests/icon-source.test.mjs`

**Interfaces:**
- Produces: `ICON_DEFINITIONS: IconDefinition[]` where each item contains `name`, `category`, `keywords`, `brandSpecific`, and `elements`.
- Produces: `renderSvg(definition, options): string` and `renderJsxElements(definition): string`.
- Element types: `path`, `circle`, `ellipse`, `line`, `polyline`, and `rect`; attributes use SVG camelCase internally.

- [x] **Step 1: Write schema and renderer tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDefinition } from '../icons/source/render-icon.js';

test('accepts a bounded currentColor path icon', () => {
  assert.doesNotThrow(() => validateDefinition({
    name: 'cue', category: 'brand', keywords: ['action'], brandSpecific: true,
    elements: [{ type: 'path', d: 'M5 12h14' }]
  }));
});

test('rejects unsafe or unsupported attributes', () => {
  assert.throws(() => validateDefinition({
    name: 'unsafe', category: 'system', keywords: [], brandSpecific: false,
    elements: [{ type: 'path', d: 'M2 2h20', onclick: 'alert(1)' }]
  }), /unsupported attribute/);
});
```

- [x] **Step 2: Run the test and confirm the renderer is absent**

Run: `node --test viscue-brand-kit/tests/icon-source.test.mjs`  
Expected: FAIL with module-not-found for `render-icon.js`.

- [x] **Step 3: Implement the schema validator and serializers**

```js
const ELEMENT_ATTRIBUTES = {
  path: ['d', 'fill', 'stroke'], circle: ['cx', 'cy', 'r', 'fill', 'stroke'],
  ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke'],
  line: ['x1', 'y1', 'x2', 'y2'], polyline: ['points'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke']
};

export function validateDefinition(definition) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.name)) throw new Error('invalid icon name');
  if (!Array.isArray(definition.elements) || definition.elements.length === 0) throw new Error('empty icon');
  for (const element of definition.elements) {
    const allowed = ELEMENT_ATTRIBUTES[element.type];
    if (!allowed) throw new Error(`unsupported element: ${element.type}`);
    for (const key of Object.keys(element)) {
      if (key !== 'type' && !allowed.includes(key)) throw new Error(`unsupported attribute: ${key}`);
    }
  }
}
```

- [x] **Step 4: Add one test fixture definition and verify serialization**

Require exact output beginning with `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">` and ending with `</svg>`.

- [x] **Step 5: Run source tests**

Run: `node --test viscue-brand-kit/tests/icon-source.test.mjs`  
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add viscue-brand-kit/package.json viscue-brand-kit/icons/source viscue-brand-kit/tests/icon-source.test.mjs
git commit -m "feat(brand-kit): add icon definition pipeline"
```

### Task 2: Draw the 44 existing workspace-action replacements

**Files:**
- Modify: `viscue-brand-kit/icons/source/icon-definitions.js`
- Modify: `viscue-brand-kit/tests/icon-source.test.mjs`

**Interfaces:**
- Consumes: `IconDefinition` schema from Task 1.
- Produces: 44 definitions in the `system`, `canvas`, `format`, `media`, and `action` categories.

- [x] **Step 1: Add the exact expected-name test**

```js
const existingNames = [
  'moon','more-stack','grid','database','close','plus','check','chevron-down',
  'search','settings','sliders','copy','download','upload','share','save','link','lock',
  'eye-off','trash','bold','italic','underline','align-left','align-center','image',
  'file-text','globe','sticky-note','reset','wand','history','video','collapse',
  'annotate','area','pencil','eraser','text','cursor','annotation-tool','text-tool',
  'undo','redo'
];
assert.deepEqual(
  ICON_DEFINITIONS.filter(icon => !icon.brandSpecific).map(icon => icon.name).sort(),
  existingNames.sort()
);
```

- [x] **Step 2: Run the focused source test**

Run: `node --test viscue-brand-kit/tests/icon-source.test.mjs`  
Expected: FAIL because the 44 names are absent.

- [x] **Step 3: Add all 44 Humanist Flow definitions**

Draw every symbol on the 24-unit grid. Preserve conventional action recognition, but replace rigid right angles with small-radius corners and use open rounded terminals. Use the logo-derived cue dash for `annotate`, `area`, `cursor`, and `wand`; do not add it to formatting glyphs. Give each definition 2–5 discovery keywords and one of the five categories named above.

- [x] **Step 4: Add shape-safety assertions**

Assert every non-brand icon has no element-level color other than `currentColor` or `none`, contains no empty `d` or `points`, and has at most 12 primitive elements.

- [x] **Step 5: Run source tests**

Run: `node --test viscue-brand-kit/tests/icon-source.test.mjs`  
Expected: PASS with 44 definitions.

- [x] **Step 6: Commit**

```bash
git add viscue-brand-kit/icons/source/icon-definitions.js viscue-brand-kit/tests/icon-source.test.mjs
git commit -m "feat(brand-kit): draw workspace action icons"
```

### Task 3: Draw the 28 Viscue-specific icons

**Files:**
- Modify: `viscue-brand-kit/icons/source/icon-definitions.js`
- Modify: `viscue-brand-kit/tests/icon-source.test.mjs`

**Interfaces:**
- Consumes: the Task 1 schema and Task 2 icon vocabulary.
- Produces: exactly 72 definitions total.

- [x] **Step 1: Add the exact product-icon test**

```js
const productNames = [
  'brand-mark','cue','vision','vision-region','vision-bypass','prompt','prompt-synthesis',
  'semantic-graph','importance','gesture','reference-engine','execute','relation',
  'one-to-many','many-to-one','branch','merge','flow','decision','group','ungroup',
  'crop','frame','hand-pan','camera','duplicate','unlock','eye'
];
assert.deepEqual(
  ICON_DEFINITIONS.filter(icon => icon.brandSpecific).map(icon => icon.name).sort(),
  productNames.sort()
);
assert.equal(ICON_DEFINITIONS.length, 72);
```

- [x] **Step 2: Run the test and confirm the product set is missing**

Run: `node --test viscue-brand-kit/tests/icon-source.test.mjs`  
Expected: FAIL on product names and total count.

- [x] **Step 3: Add the 28 product definitions**

Use these visual semantics: `vision-region` combines an open eye with four crop corners; `vision-bypass` combines the cue dash with a clean skip arc; `prompt-synthesis` narrows three short input strokes into one output stroke; `semantic-graph` uses three connected open nodes; `importance` uses an optically weighted central node; `gesture` uses one continuous motion path; `reference-engine` uses two stacked frames converging on one chosen frame; `one-to-many` and `many-to-one` mirror a single branching junction; `decision` uses a rounded diamond with two exits; `flow` uses one soft S-curve with an arrow terminal. Keep all remaining symbols equally literal and compact.

- [x] **Step 4: Verify name uniqueness and motif restraint**

Add assertions for 72 unique names and require `brandSpecific: true` only on the 28 names above.

- [x] **Step 5: Run source tests**

Run: `node --test viscue-brand-kit/tests/icon-source.test.mjs`  
Expected: PASS with 72 definitions.

- [x] **Step 6: Commit**

```bash
git add viscue-brand-kit/icons/source/icon-definitions.js viscue-brand-kit/tests/icon-source.test.mjs
git commit -m "feat(brand-kit): add Viscue product icons"
```

### Task 4: Generate SVG, metadata, and React outputs atomically

**Files:**
- Create: `viscue-brand-kit/scripts/build-icons.mjs`
- Create: `viscue-brand-kit/icons/react/ViscueIcon.jsx`
- Create: `viscue-brand-kit/icons/react/index.js`
- Generate: `viscue-brand-kit/icons/react/icons.js`
- Generate: `viscue-brand-kit/icons/svg/*.svg`
- Generate: `viscue-brand-kit/icons/metadata/icons.json`
- Create: `viscue-brand-kit/tests/icon-output.test.mjs`

**Interfaces:**
- Produces: `buildIcons({ outputRoot }): Promise<{ count: number }>`.
- Produces: `<ViscueIcon name size strokeWidth title ...svgProps />`.
- Produces: one named `PascalCaseIcon` React export per definition.

- [x] **Step 1: Write output-count and accessibility tests**

```js
test('generated surfaces stay in sync', async () => {
  assert.equal(svgFiles.length, 72);
  assert.equal(metadata.length, 72);
  assert.equal(namedExports.length, 72);
});

test('title makes an icon an accessible image', () => {
  const html = renderToStaticMarkup(<ViscueIcon name="vision" title="Vision" />);
  assert.match(html, /role="img"/);
  assert.match(html, /<title>Vision<\/title>/);
  assert.doesNotMatch(html, /aria-hidden/);
});
```

- [x] **Step 2: Run output tests before generation**

Run: `node --test viscue-brand-kit/tests/icon-output.test.mjs`  
Expected: FAIL because generated files and the wrapper do not exist.

- [x] **Step 3: Implement the generic React wrapper**

Use a generated lookup of primitive React elements. Default `size=24`, `strokeWidth=1.8`, and `aria-hidden=true`; when `title` is present, emit a `<title>` and `role="img"`.

- [x] **Step 4: Implement atomic generation**

Write SVG, React, and JSON outputs to `viscue-brand-kit/.build-icons`, validate counts there, then replace only the three generated output locations. Sort all files and exports by icon name for stable diffs.

- [x] **Step 5: Run the generator and tests**

Run: `node viscue-brand-kit/scripts/build-icons.mjs`  
Expected: `Generated 72 Viscue icons.`

Run: `node --test viscue-brand-kit/tests/icon-output.test.mjs`  
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add viscue-brand-kit/scripts/build-icons.mjs viscue-brand-kit/icons viscue-brand-kit/tests/icon-output.test.mjs
git commit -m "build(brand-kit): generate SVG and React icons"
```

### Task 5: Add full validation, preview, and migration documentation

**Files:**
- Create: `viscue-brand-kit/scripts/validate-icons.mjs`
- Create: `viscue-brand-kit/icons/preview/index.html`
- Create: `viscue-brand-kit/README.md`
- Modify: `viscue-brand-kit/package.json`

**Interfaces:**
- Produces: `npm run build:icons`, `npm run validate:icons`, and `npm test`.
- Produces: a searchable preview showing all 72 icons in four sizes and two themes.

- [x] **Step 1: Write validator failure fixtures**

Test malformed XML, a non-24 viewBox, embedded `<text>`, embedded `<image>`, external URL, `<script>`, hardcoded `#000`, duplicate names, and mismatched output counts. Each fixture must produce a nonzero result and a message naming the offending file.

- [x] **Step 2: Run the validator tests before implementation**

Run: `node --test viscue-brand-kit/tests/icon-output.test.mjs`  
Expected: FAIL on missing validator exports.

- [x] **Step 3: Implement the validator**

Check all 72 SVGs, metadata, and React exports. Parse numeric path tokens conservatively and reject coordinates outside `-0.25–24.25`; allow the tolerance only for rounded stroke extents.

- [x] **Step 4: Build the preview and README**

The preview renders category sections and each icon at 16, 20, 24, and 32 pixels on light and dark samples. The README documents raw SVG use, React use, accessibility, color inheritance, generation commands, and a 44-row migration table mapping current `Icon*` exports to new names.

- [x] **Step 5: Run final icon verification**

Run: `npm --prefix viscue-brand-kit run build:icons`  
Expected: `Generated 72 Viscue icons.`

Run: `npm --prefix viscue-brand-kit run validate:icons`  
Expected: `Validated 72 SVGs, 72 React exports, and 72 metadata entries.`

Run: `npm --prefix viscue-brand-kit test`  
Expected: all icon tests pass with zero failures.

- [x] **Step 6: Commit**

```bash
git add viscue-brand-kit/package.json viscue-brand-kit/scripts/validate-icons.mjs viscue-brand-kit/icons/preview viscue-brand-kit/README.md viscue-brand-kit/tests
git commit -m "docs(brand-kit): add icon preview and migration guide"
```
