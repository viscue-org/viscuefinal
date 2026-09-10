import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const brandKitDir = path.resolve(__dirname, '..');
const svgDir = path.join(brandKitDir, 'icons', 'svg');
const metadataPath = path.join(brandKitDir, 'icons', 'metadata', 'icons.json');
const reactIndexPath = path.join(brandKitDir, 'icons', 'react', 'index.js');

test('generated surfaces stay in sync', async () => {
  assert.ok(fs.existsSync(svgDir), 'icons/svg directory must exist');
  const svgFiles = fs.readdirSync(svgDir).filter(f => f.endsWith('.svg'));
  assert.equal(svgFiles.length, 72, 'Must have exactly 72 SVG files');

  assert.ok(fs.existsSync(metadataPath), 'icons/metadata/icons.json must exist');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  assert.equal(metadata.length, 72, 'Must have exactly 72 metadata entries');

  const reactExports = await import('../icons/react/index.js');
  const namedIcons = Object.keys(reactExports).filter(k => k.endsWith('Icon') && k !== 'ViscueIcon');
  assert.equal(namedIcons.length, 72, 'Must have exactly 72 named icon exports');
});

test('title makes an icon an accessible image', async () => {
  const { ViscueIcon } = await import('../icons/react/index.js');
  const html = renderToStaticMarkup(React.createElement(ViscueIcon, { name: 'vision', title: 'Vision' }));
  assert.match(html, /role="img"/);
  assert.match(html, /<title>Vision<\/title>/);
  assert.doesNotMatch(html, /aria-hidden/);
});

test('icon defaults to aria-hidden without title', async () => {
  const { ViscueIcon } = await import('../icons/react/index.js');
  const html = renderToStaticMarkup(React.createElement(ViscueIcon, { name: 'vision' }));
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /role="img"/);
  assert.doesNotMatch(html, /<title>/);
});

test('named React export renders identical geometry to ViscueIcon', async () => {
  const { ViscueIcon, VisionIcon } = await import('../icons/react/index.js');
  const genericHtml = renderToStaticMarkup(React.createElement(ViscueIcon, { name: 'vision', title: 'Vision' }));
  const namedHtml = renderToStaticMarkup(React.createElement(VisionIcon, { title: 'Vision' }));
  assert.equal(namedHtml, genericHtml);
});

test('accepts custom size and strokeWidth', async () => {
  const { ViscueIcon } = await import('../icons/react/index.js');
  const html = renderToStaticMarkup(React.createElement(ViscueIcon, { name: 'cue', size: 32, strokeWidth: 2.5 }));
  assert.match(html, /width="32"/);
  assert.match(html, /height="32"/);
  assert.match(html, /stroke-width="2\.5"/);
});

test('validator catches malformed XML', async () => {
  const { validateSvgString } = await import('../scripts/validate-icons.mjs');
  assert.throws(
    () => validateSvgString('<svg viewBox="0 0 24 24"><path d="M0 0"</svg>', 'bad-xml.svg'),
    /bad-xml\.svg/
  );
});

test('validator catches non-24 viewBox', async () => {
  const { validateSvgString } = await import('../scripts/validate-icons.mjs');
  assert.throws(
    () => validateSvgString('<svg viewBox="0 0 32 32"><path d="M0 0" /></svg>', 'bad-viewbox.svg'),
    /bad-viewbox\.svg/
  );
});

test('validator catches embedded text', async () => {
  const { validateSvgString } = await import('../scripts/validate-icons.mjs');
  assert.throws(
    () => validateSvgString('<svg viewBox="0 0 24 24"><text>A</text></svg>', 'embedded-text.svg'),
    /embedded-text\.svg/
  );
});

test('validator catches embedded image', async () => {
  const { validateSvgString } = await import('../scripts/validate-icons.mjs');
  assert.throws(
    () => validateSvgString('<svg viewBox="0 0 24 24"><image href="foo.png" /></svg>', 'embedded-image.svg'),
    /embedded-image\.svg/
  );
});

test('validator catches script tags', async () => {
  const { validateSvgString } = await import('../scripts/validate-icons.mjs');
  assert.throws(
    () => validateSvgString('<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>', 'has-script.svg'),
    /has-script\.svg/
  );
});

test('validator catches external URLs', async () => {
  const { validateSvgString } = await import('../scripts/validate-icons.mjs');
  assert.throws(
    () => validateSvgString('<svg viewBox="0 0 24 24"><path d="M0 0" href="https://example.com" /></svg>', 'external-url.svg'),
    /external-url\.svg/
  );
});

test('validator catches hardcoded #000 in utility icons', async () => {
  const { validateSvgString } = await import('../scripts/validate-icons.mjs');
  assert.throws(
    () => validateSvgString('<svg viewBox="0 0 24 24"><path d="M0 0" stroke="#000" /></svg>', 'hardcoded-black.svg'),
    /hardcoded-black\.svg/
  );
});

test('validator catches out-of-bound coordinates', async () => {
  const { validateSvgString } = await import('../scripts/validate-icons.mjs');
  assert.throws(
    () => validateSvgString('<svg viewBox="0 0 24 24"><circle cx="28" cy="12" r="3" /></svg>', 'out-of-bounds.svg'),
    /out-of-bounds\.svg/
  );
});

test('validator passes on all generated icons in package', async () => {
  const { validateIconPackage } = await import('../scripts/validate-icons.mjs');
  const result = validateIconPackage({ rootDir: brandKitDir });
  assert.equal(result.count, 72);
  assert.equal(result.errors.length, 0);
});

