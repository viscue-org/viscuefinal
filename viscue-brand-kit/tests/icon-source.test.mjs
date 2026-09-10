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
