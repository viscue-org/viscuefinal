import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultOutputRoot = path.resolve(__dirname, '..');

const MIN_BOUND = -0.25;
const MAX_BOUND = 24.25;

function checkCoord(val, name, fileLabel) {
  if (val < MIN_BOUND || val > MAX_BOUND) {
    throw new Error(`[${fileLabel}] ${name} coordinate ${val} is out of allowable bounds [${MIN_BOUND}, ${MAX_BOUND}]`);
  }
}

export function validatePathCoordinates(d, fileLabel) {
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;

  const tokens = d.match(/[a-df-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/gi) || [];
  let i = 0;
  let cmd = '';

  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[a-z]$/i.test(token)) {
      cmd = token;
      i++;
    }

    const isRel = cmd === cmd.toLowerCase();
    const type = cmd.toUpperCase();

    if (type === 'M') {
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      curX = isRel ? curX + x : x;
      curY = isRel ? curY + y : y;
      startX = curX;
      startY = curY;
      checkCoord(curX, 'path X', fileLabel);
      checkCoord(curY, 'path Y', fileLabel);
      cmd = isRel ? 'l' : 'L';
    } else if (type === 'L') {
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      curX = isRel ? curX + x : x;
      curY = isRel ? curY + y : y;
      checkCoord(curX, 'path X', fileLabel);
      checkCoord(curY, 'path Y', fileLabel);
    } else if (type === 'H') {
      const x = parseFloat(tokens[i++]);
      curX = isRel ? curX + x : x;
      checkCoord(curX, 'path X', fileLabel);
    } else if (type === 'V') {
      const y = parseFloat(tokens[i++]);
      curY = isRel ? curY + y : y;
      checkCoord(curY, 'path Y', fileLabel);
    } else if (type === 'C') {
      const x1 = parseFloat(tokens[i++]);
      const y1 = parseFloat(tokens[i++]);
      const x2 = parseFloat(tokens[i++]);
      const y2 = parseFloat(tokens[i++]);
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      checkCoord(isRel ? curX + x1 : x1, 'control X1', fileLabel);
      checkCoord(isRel ? curY + y1 : y1, 'control Y1', fileLabel);
      checkCoord(isRel ? curX + x2 : x2, 'control X2', fileLabel);
      checkCoord(isRel ? curY + y2 : y2, 'control Y2', fileLabel);
      curX = isRel ? curX + x : x;
      curY = isRel ? curY + y : y;
      checkCoord(curX, 'path X', fileLabel);
      checkCoord(curY, 'path Y', fileLabel);
    } else if (type === 'S') {
      const x2 = parseFloat(tokens[i++]);
      const y2 = parseFloat(tokens[i++]);
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      checkCoord(isRel ? curX + x2 : x2, 'control X2', fileLabel);
      checkCoord(isRel ? curY + y2 : y2, 'control Y2', fileLabel);
      curX = isRel ? curX + x : x;
      curY = isRel ? curY + y : y;
      checkCoord(curX, 'path X', fileLabel);
      checkCoord(curY, 'path Y', fileLabel);
    } else if (type === 'Q') {
      const x1 = parseFloat(tokens[i++]);
      const y1 = parseFloat(tokens[i++]);
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      checkCoord(isRel ? curX + x1 : x1, 'control X1', fileLabel);
      checkCoord(isRel ? curY + y1 : y1, 'control Y1', fileLabel);
      curX = isRel ? curX + x : x;
      curY = isRel ? curY + y : y;
      checkCoord(curX, 'path X', fileLabel);
      checkCoord(curY, 'path Y', fileLabel);
    } else if (type === 'T') {
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      curX = isRel ? curX + x : x;
      curY = isRel ? curY + y : y;
      checkCoord(curX, 'path X', fileLabel);
      checkCoord(curY, 'path Y', fileLabel);
    } else if (type === 'A') {
      tokens[i++]; // rx
      tokens[i++]; // ry
      tokens[i++]; // rot
      tokens[i++]; // largeArc
      tokens[i++]; // sweep
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      curX = isRel ? curX + x : x;
      curY = isRel ? curY + y : y;
      checkCoord(curX, 'path X', fileLabel);
      checkCoord(curY, 'path Y', fileLabel);
    } else if (type === 'Z') {
      curX = startX;
      curY = startY;
    } else {
      break;
    }
  }
}

export function validateSvgString(svgContent, filename = 'icon.svg', { isBrandSpecific = false } = {}) {
  const fileLabel = filename;

  // 1. Basic XML structure
  const trimmed = svgContent.trim();
  if (!trimmed.startsWith('<svg') || !trimmed.endsWith('</svg>')) {
    throw new Error(`[${fileLabel}] Malformed XML: SVG must start with <svg and end with </svg>`);
  }

  const openSvgCount = (svgContent.match(/<svg\b/g) || []).length;
  const closeSvgCount = (svgContent.match(/<\/svg>/g) || []).length;
  if (openSvgCount !== 1 || closeSvgCount !== 1) {
    throw new Error(`[${fileLabel}] Malformed XML: mismatched <svg> tags`);
  }

  const brokenTagMatch = /<[a-zA-Z][^>]*<svg|<\/[^>]*<svg|<[a-zA-Z][^>]*<\/svg/.test(svgContent);
  if (brokenTagMatch) {
    throw new Error(`[${fileLabel}] Malformed XML: unclosed tag detected before </svg>`);
  }

  // 2. ViewBox check
  const viewBoxMatch = svgContent.match(/\bviewBox="([^"]+)"/);
  if (!viewBoxMatch || viewBoxMatch[1] !== '0 0 24 24') {
    throw new Error(`[${fileLabel}] Invalid viewBox: expected "0 0 24 24", got "${viewBoxMatch ? viewBoxMatch[1] : 'none'}"`);
  }

  // 3. Disallowed elements
  if (/<text\b/i.test(svgContent) || /<\/text>/i.test(svgContent)) {
    throw new Error(`[${fileLabel}] Disallowed embedded <text> element`);
  }
  if (/<image\b/i.test(svgContent)) {
    throw new Error(`[${fileLabel}] Disallowed embedded <image> element`);
  }
  if (/<script\b/i.test(svgContent)) {
    throw new Error(`[${fileLabel}] Disallowed embedded <script> element`);
  }

  // 4. External URLs and links
  if (/\b(?:href|xlink:href)\s*=\s*"[^"]*"/i.test(svgContent)) {
    throw new Error(`[${fileLabel}] Disallowed href/xlink:href attribute`);
  }
  if (/https?:\/\/|data:|javascript:/i.test(svgContent.replace('http://www.w3.org/2000/svg', ''))) {
    throw new Error(`[${fileLabel}] Disallowed external URL or script reference`);
  }

  // 5. Hardcoded colors in non-brand utility icons
  if (!isBrandSpecific) {
    const hardcodedColors = /#(?:000|000000|fff|ffffff)\b|(?<![a-zA-Z])(?:black|white)(?![a-zA-Z])/i;
    if (hardcodedColors.test(svgContent)) {
      throw new Error(`[${fileLabel}] Hardcoded black/white color in utility icon. Use currentColor.`);
    }
  }

  // 6. Coordinates validation across all elements
  // Paths
  const pathMatches = svgContent.matchAll(/<path\b[^>]*\bd="([^"]+)"/g);
  for (const match of pathMatches) {
    validatePathCoordinates(match[1], fileLabel);
  }

  // Circles
  const circleMatches = svgContent.matchAll(/<circle\b[^>]*\bcx="([^"]+)"[^>]*\bcy="([^"]+)"[^>]*\br="([^"]+)"/g);
  for (const match of circleMatches) {
    const cx = parseFloat(match[1]);
    const cy = parseFloat(match[2]);
    const r = parseFloat(match[3]);
    checkCoord(cx, 'circle cx', fileLabel);
    checkCoord(cy, 'circle cy', fileLabel);
    checkCoord(cx - r, 'circle left', fileLabel);
    checkCoord(cx + r, 'circle right', fileLabel);
    checkCoord(cy - r, 'circle top', fileLabel);
    checkCoord(cy + r, 'circle bottom', fileLabel);
  }

  // Ellipses
  const ellipseMatches = svgContent.matchAll(/<ellipse\b[^>]*\bcx="([^"]+)"[^>]*\bcy="([^"]+)"[^>]*\brx="([^"]+)"[^>]*\bry="([^"]+)"/g);
  for (const match of ellipseMatches) {
    const cx = parseFloat(match[1]);
    const cy = parseFloat(match[2]);
    const rx = parseFloat(match[3]);
    const ry = parseFloat(match[4]);
    checkCoord(cx, 'ellipse cx', fileLabel);
    checkCoord(cy, 'ellipse cy', fileLabel);
    checkCoord(cx - rx, 'ellipse left', fileLabel);
    checkCoord(cx + rx, 'ellipse right', fileLabel);
    checkCoord(cy - ry, 'ellipse top', fileLabel);
    checkCoord(cy + ry, 'ellipse bottom', fileLabel);
  }

  // Rects
  const rectMatches = svgContent.matchAll(/<rect\b[^>]*\bx="([^"]+)"[^>]*\by="([^"]+)"[^>]*\bwidth="([^"]+)"[^>]*\bheight="([^"]+)"/g);
  for (const match of rectMatches) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const width = parseFloat(match[3]);
    const height = parseFloat(match[4]);
    checkCoord(x, 'rect x', fileLabel);
    checkCoord(y, 'rect y', fileLabel);
    checkCoord(x + width, 'rect x+width', fileLabel);
    checkCoord(y + height, 'rect y+height', fileLabel);
  }

  // Lines
  const lineMatches = svgContent.matchAll(/<line\b[^>]*\bx1="([^"]+)"[^>]*\by1="([^"]+)"[^>]*\bx2="([^"]+)"[^>]*\by2="([^"]+)"/g);
  for (const match of lineMatches) {
    const x1 = parseFloat(match[1]);
    const y1 = parseFloat(match[2]);
    const x2 = parseFloat(match[3]);
    const y2 = parseFloat(match[4]);
    checkCoord(x1, 'line x1', fileLabel);
    checkCoord(y1, 'line y1', fileLabel);
    checkCoord(x2, 'line x2', fileLabel);
    checkCoord(y2, 'line y2', fileLabel);
  }

  // Polylines
  const polylineMatches = svgContent.matchAll(/<polyline\b[^>]*\bpoints="([^"]+)"/g);
  for (const match of polylineMatches) {
    const nums = match[1].match(/-?(?:\d*\.\d+|\d+)/g) || [];
    for (let j = 0; j < nums.length; j += 2) {
      const px = parseFloat(nums[j]);
      const py = parseFloat(nums[j + 1]);
      checkCoord(px, 'polyline X', fileLabel);
      checkCoord(py, 'polyline Y', fileLabel);
    }
  }

  return { valid: true };
}

export function validateIconPackage({ rootDir = defaultOutputRoot } = {}) {
  const errors = [];
  const svgDir = path.join(rootDir, 'icons', 'svg');
  const metadataPath = path.join(rootDir, 'icons', 'metadata', 'icons.json');
  const reactIconsPath = path.join(rootDir, 'icons', 'react', 'icons.js');

  // Check metadata
  if (!fs.existsSync(metadataPath)) {
    errors.push('Metadata file missing: icons/metadata/icons.json');
    return { count: 0, errors };
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  if (metadata.length !== 72) {
    errors.push(`Expected 72 metadata entries, found ${metadata.length}`);
  }

  const metaMap = new Map(metadata.map(m => [m.name, m]));
  if (metaMap.size !== metadata.length) {
    errors.push('Duplicate names found in metadata');
  }

  // Check SVGs
  if (!fs.existsSync(svgDir)) {
    errors.push('SVG directory missing: icons/svg');
    return { count: 0, errors };
  }
  const svgFiles = fs.readdirSync(svgDir).filter(f => f.endsWith('.svg'));
  if (svgFiles.length !== 72) {
    errors.push(`Expected 72 SVG files, found ${svgFiles.length}`);
  }

  for (const svgFile of svgFiles) {
    const iconName = svgFile.replace(/\.svg$/, '');
    const meta = metaMap.get(iconName);
    if (!meta) {
      errors.push(`SVG ${svgFile} has no matching metadata entry`);
      continue;
    }
    const svgPath = path.join(svgDir, svgFile);
    const content = fs.readFileSync(svgPath, 'utf8');
    try {
      validateSvgString(content, svgFile, { isBrandSpecific: meta.brandSpecific });
    } catch (err) {
      errors.push(err.message);
    }
  }

  // Check React icons.js
  if (!fs.existsSync(reactIconsPath)) {
    errors.push('React icons file missing: icons/react/icons.js');
  } else {
    const reactContent = fs.readFileSync(reactIconsPath, 'utf8');
    const namedMatches = reactContent.match(/export function (\w+Icon)/g) || [];
    if (namedMatches.length !== 72) {
      errors.push(`Expected 72 React exports, found ${namedMatches.length}`);
    }
  }

  if (errors.length > 0) {
    const err = new Error(`Validation failed with ${errors.length} errors:\n${errors.join('\n')}`);
    err.errors = errors;
    throw err;
  }

  return { count: metadata.length, errors: [] };
}

// Execute if run from CLI
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  try {
    const result = validateIconPackage();
    console.log(`Validated ${result.count} SVGs, ${result.count} React exports, and ${result.count} metadata entries.`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
