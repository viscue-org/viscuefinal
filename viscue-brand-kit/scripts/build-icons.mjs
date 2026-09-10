import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_DEFINITIONS } from '../icons/source/icon-definitions.js';
import { renderSvg, toPascalCase, validateDefinition } from '../icons/source/render-icon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultOutputRoot = path.resolve(__dirname, '..');

export async function buildIcons({ outputRoot = defaultOutputRoot } = {}) {
  // Sort definitions by name for deterministic builds
  const sortedDefs = [...ICON_DEFINITIONS].sort((a, b) => a.name.localeCompare(b.name));

  // Validate all definitions before generation
  for (const def of sortedDefs) {
    validateDefinition(def);
  }

  const scratchDir = path.join(outputRoot, '.build-icons');
  const scratchSvgDir = path.join(scratchDir, 'svg');
  const scratchMetaDir = path.join(scratchDir, 'metadata');
  const scratchReactDir = path.join(scratchDir, 'react');

  // Clean scratch
  fs.rmSync(scratchDir, { recursive: true, force: true });
  fs.mkdirSync(scratchSvgDir, { recursive: true });
  fs.mkdirSync(scratchMetaDir, { recursive: true });
  fs.mkdirSync(scratchReactDir, { recursive: true });

  // 1. Generate SVGs
  for (const def of sortedDefs) {
    const svgContent = renderSvg(def);
    fs.writeFileSync(path.join(scratchSvgDir, `${def.name}.svg`), svgContent, 'utf8');
  }

  // 2. Generate Discovery Metadata
  const metadata = sortedDefs.map(def => ({
    name: def.name,
    category: def.category,
    keywords: def.keywords,
    brandSpecific: Boolean(def.brandSpecific),
    elementCount: def.elements.length
  }));
  fs.writeFileSync(
    path.join(scratchMetaDir, 'icons.json'),
    JSON.stringify(metadata, null, 2) + '\n',
    'utf8'
  );

  // 3. Generate Named React Components (icons.js)
  const iconExports = sortedDefs.map(def => {
    const componentName = `${toPascalCase(def.name)}Icon`;
    return `export function ${componentName}(props) {
  return React.createElement(ViscueIcon, { name: '${def.name}', ...props });
}
${componentName}.displayName = '${componentName}';`;
  }).join('\n\n');

  const iconsJsContent = `// Generated automatically by build-icons.mjs. Do not edit manually.
import React from 'react';
import { ViscueIcon } from './ViscueIcon.js';

${iconExports}
`;
  fs.writeFileSync(path.join(scratchReactDir, 'icons.js'), iconsJsContent, 'utf8');

  // 4. Generate React Entry Point (index.js)
  const indexJsContent = `// Generated entry point for Viscue React icons.
export { ViscueIcon, default } from './ViscueIcon.js';
export * from './icons.js';
`;
  fs.writeFileSync(path.join(scratchReactDir, 'index.js'), indexJsContent, 'utf8');

  // Pre-commit validation of scratch directory
  const generatedSvgs = fs.readdirSync(scratchSvgDir).filter(f => f.endsWith('.svg'));
  if (generatedSvgs.length !== sortedDefs.length) {
    throw new Error(`Scratch SVG count (${generatedSvgs.length}) did not match definition count (${sortedDefs.length})`);
  }

  const generatedMeta = JSON.parse(fs.readFileSync(path.join(scratchMetaDir, 'icons.json'), 'utf8'));
  if (generatedMeta.length !== sortedDefs.length) {
    throw new Error(`Scratch metadata count (${generatedMeta.length}) did not match definition count (${sortedDefs.length})`);
  }

  // Atomically copy to targets
  const targetSvgDir = path.join(outputRoot, 'icons', 'svg');
  const targetMetaDir = path.join(outputRoot, 'icons', 'metadata');
  const targetReactDir = path.join(outputRoot, 'icons', 'react');

  fs.mkdirSync(targetSvgDir, { recursive: true });
  fs.mkdirSync(targetMetaDir, { recursive: true });
  fs.mkdirSync(targetReactDir, { recursive: true });

  // Clean old target SVGs and copy new
  for (const f of fs.readdirSync(targetSvgDir)) {
    if (f.endsWith('.svg')) fs.unlinkSync(path.join(targetSvgDir, f));
  }
  for (const f of generatedSvgs) {
    fs.copyFileSync(path.join(scratchSvgDir, f), path.join(targetSvgDir, f));
  }

  fs.copyFileSync(path.join(scratchMetaDir, 'icons.json'), path.join(targetMetaDir, 'icons.json'));
  fs.copyFileSync(path.join(scratchReactDir, 'icons.js'), path.join(targetReactDir, 'icons.js'));
  fs.copyFileSync(path.join(scratchReactDir, 'index.js'), path.join(targetReactDir, 'index.js'));

  // Clean scratch
  fs.rmSync(scratchDir, { recursive: true, force: true });

  return { count: sortedDefs.length };
}

// Execute if run from CLI
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  buildIcons()
    .then(({ count }) => {
      console.log(`Generated ${count} Viscue icons.`);
    })
    .catch(err => {
      console.error('Failed to generate icons:', err);
      process.exit(1);
    });
}
