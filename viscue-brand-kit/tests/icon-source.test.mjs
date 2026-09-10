import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDefinition, renderSvg, renderJsxElements, toPascalCase } from '../icons/source/render-icon.js';

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

test('rejects invalid names', () => {
  assert.throws(() => validateDefinition({
    name: 'Invalid_Name', category: 'system', keywords: [], brandSpecific: false,
    elements: [{ type: 'path', d: 'M2 2h20' }]
  }), /invalid icon name/);
});

test('serializes SVG with exact root wrapper attributes', () => {
  const svg = renderSvg({
    name: 'test-icon', category: 'system', keywords: [], brandSpecific: false,
    elements: [{ type: 'path', d: 'M5 12h14' }]
  });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1\.8" stroke-linecap="round" stroke-linejoin="round">/);
  assert.match(svg, /<path d="M5 12h14" \/>/);
  assert.match(svg, /<\/svg>$/);
});

test('renders JSX elements string', () => {
  const jsx = renderJsxElements({
    name: 'test-icon', category: 'system', keywords: [], brandSpecific: false,
    elements: [
      { type: 'path', d: 'M5 12h14' },
      { type: 'circle', cx: 12, cy: 12, r: 4 }
    ]
  });
  assert.match(jsx, /<path d="M5 12h14" \/>/);
  assert.match(jsx, /<circle cx=\{12\} cy=\{12\} r=\{4\} \/>/);
});

test('toPascalCase converts kebab-case to PascalCase', () => {
  assert.equal(toPascalCase('cue'), 'Cue');
  assert.equal(toPascalCase('more-stack'), 'MoreStack');
  assert.equal(toPascalCase('one-to-many'), 'OneToMany');
});

const existingNames = [
  'moon', 'more-stack', 'grid', 'database', 'close', 'plus', 'check', 'chevron-down',
  'search', 'settings', 'sliders', 'copy', 'download', 'upload', 'share', 'save', 'link', 'lock',
  'eye-off', 'trash', 'bold', 'italic', 'underline', 'align-left', 'align-center', 'image',
  'file-text', 'globe', 'sticky-note', 'reset', 'wand', 'history', 'video', 'collapse',
  'annotate', 'area', 'pencil', 'eraser', 'text', 'cursor', 'annotation-tool', 'text-tool',
  'undo', 'redo'
];

test('all 44 non-brand workspace actions exist and match expected list', async () => {
  const { ICON_DEFINITIONS } = await import('../icons/source/icon-definitions.js');
  const nonBrandNames = ICON_DEFINITIONS
    .filter(icon => !icon.brandSpecific)
    .map(icon => icon.name)
    .sort();
  assert.deepEqual(nonBrandNames, [...existingNames].sort());
});

test('every workspace action complies with category, keyword, and shape-safety constraints', async () => {
  const { ICON_DEFINITIONS } = await import('../icons/source/icon-definitions.js');
  const validCategories = new Set(['system', 'canvas', 'format', 'media', 'action']);

  for (const icon of ICON_DEFINITIONS.filter(i => !i.brandSpecific)) {
    validateDefinition(icon);
    assert.ok(validCategories.has(icon.category), `Icon ${icon.name} has invalid category: ${icon.category}`);
    assert.ok(Array.isArray(icon.keywords) && icon.keywords.length >= 2 && icon.keywords.length <= 5,
      `Icon ${icon.name} must have 2-5 keywords, found ${icon.keywords?.length}`);
    assert.ok(icon.elements.length <= 12, `Icon ${icon.name} has too many elements: ${icon.elements.length}`);

    for (const el of icon.elements) {
      if (el.fill && el.fill !== 'none' && el.fill !== 'currentColor') {
        assert.fail(`Icon ${icon.name} has invalid fill: ${el.fill}`);
      }
      if (el.stroke && el.stroke !== 'currentColor' && el.stroke !== 'none') {
        assert.fail(`Icon ${icon.name} has invalid stroke: ${el.stroke}`);
      }
      if (el.d !== undefined) {
        assert.ok(typeof el.d === 'string' && el.d.trim().length > 0, `Icon ${icon.name} has empty path d`);
      }
      if (el.points !== undefined) {
        assert.ok(typeof el.points === 'string' && el.points.trim().length > 0, `Icon ${icon.name} has empty points`);
      }
    }
  }
});

const productNames = [
  'brand-mark', 'cue', 'vision', 'vision-region', 'vision-bypass', 'prompt', 'prompt-synthesis',
  'semantic-graph', 'importance', 'gesture', 'reference-engine', 'execute', 'relation',
  'one-to-many', 'many-to-one', 'branch', 'merge', 'flow', 'decision', 'group', 'ungroup',
  'crop', 'frame', 'hand-pan', 'camera', 'duplicate', 'unlock', 'eye'
];

test('all 28 brand-specific product icons exist and match expected list', async () => {
  const { ICON_DEFINITIONS } = await import('../icons/source/icon-definitions.js');
  const brandNames = ICON_DEFINITIONS
    .filter(icon => icon.brandSpecific)
    .map(icon => icon.name)
    .sort();
  assert.deepEqual(brandNames, [...productNames].sort());
  assert.equal(ICON_DEFINITIONS.length, 72);
});

test('exactly 72 unique names and brandSpecific is set only on the 28 product icons', async () => {
  const { ICON_DEFINITIONS } = await import('../icons/source/icon-definitions.js');
  const names = ICON_DEFINITIONS.map(i => i.name);
  assert.equal(new Set(names).size, 72, 'Icon names must be unique');

  const expectedBrandSet = new Set(productNames);
  for (const icon of ICON_DEFINITIONS) {
    if (icon.brandSpecific) {
      assert.ok(expectedBrandSet.has(icon.name), `${icon.name} should not be brandSpecific`);
    } else {
      assert.ok(!expectedBrandSet.has(icon.name), `${icon.name} should be brandSpecific`);
    }
  }
});

test('all 72 icons pass schema validation and shape safety checks', async () => {
  const { ICON_DEFINITIONS } = await import('../icons/source/icon-definitions.js');
  const allCategories = new Set(['brand', 'system', 'canvas', 'format', 'media', 'action']);

  for (const icon of ICON_DEFINITIONS) {
    validateDefinition(icon);
    assert.ok(allCategories.has(icon.category), `Icon ${icon.name} has invalid category: ${icon.category}`);
    assert.ok(Array.isArray(icon.keywords) && icon.keywords.length >= 2 && icon.keywords.length <= 5,
      `Icon ${icon.name} must have 2-5 keywords, found ${icon.keywords?.length}`);
    assert.ok(icon.elements.length <= 12, `Icon ${icon.name} has too many elements: ${icon.elements.length}`);

    for (const el of icon.elements) {
      if (el.d !== undefined) {
        assert.ok(typeof el.d === 'string' && el.d.trim().length > 0, `Icon ${icon.name} has empty path d`);
      }
      if (el.points !== undefined) {
        assert.ok(typeof el.points === 'string' && el.points.trim().length > 0, `Icon ${icon.name} has empty points`);
      }
    }
  }
});



