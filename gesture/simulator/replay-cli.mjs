import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { executeGoal } from './executors.mjs';
import { createPrng } from './prng.mjs';
import { generatePersona } from './personas.mjs';
import { generateWorld, sampleGoal } from './worlds.mjs';

const finiteSeed = value => {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError('--seed requires a finite integer');
  const seed = Number(value);
  if (!Number.isSafeInteger(seed)) throw new TypeError('--seed requires a finite integer');
  return seed;
};

export function parseReplayArgs(argv = []) {
  let seed;
  let out;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--seed') {
      if (seed !== undefined || index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new TypeError('--seed requires one value');
      seed = finiteSeed(argv[++index]);
    } else if (flag === '--out') {
      if (out !== undefined || index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new TypeError('--out requires one path');
      out = argv[++index];
    } else {
      throw new TypeError(`unknown argument: ${flag}`);
    }
  }
  if (seed === undefined) throw new TypeError('--seed is required');
  if (typeof out !== 'string' || out.trim() === '') throw new TypeError('--out is required');
  return Object.freeze({ seed, out: resolve(out) });
}

function syntheticReplay(seed) {
  const persona = generatePersona(seed);
  const world = generateWorld(seed, persona);
  const goal = sampleGoal(world, persona, createPrng(`replay-goal:${seed}`));
  const rawGesture = executeGoal({ persona, world, goal, seed: `replay:${seed}` });
  return Object.freeze({
    seed,
    labels: Object.freeze([goal.intent]),
    strokes: Object.freeze(rawGesture.strokes.map(stroke => Object.freeze({
      pointer_type: stroke.pointer_type,
      cancelled: stroke.cancelled,
      points: Object.freeze(stroke.points.map(point => Object.freeze({
        x: point.x, y: point.y, time_ms: point.time_ms, pressure: point.pressure,
      }))),
    }))),
  });
}

const htmlEscape = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

// JSON is placed in a raw-text script element, so escape characters that could
// terminate the element instead of relying on HTML entity decoding.
const safeJson = value => JSON.stringify(value)
  .replaceAll('&', '\\u0026')
  .replaceAll('<', '\\u003c')
  .replaceAll('>', '\\u003e')
  .replaceAll('\u2028', '\\u2028')
  .replaceAll('\u2029', '\\u2029');

export function renderReplay(data) {
  const polylines = data.strokes.map(stroke => {
    const points = stroke.points.map(point => `${point.x},${point.y}`).join(' ');
    const color = stroke.cancelled ? '#b91c1c' : '#2563eb';
    return `<polyline points="${htmlEscape(points)}" stroke="${color}" />`;
  }).join('');
  const label = htmlEscape(data.labels[0] ?? 'unknown');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Gesture replay ${htmlEscape(data.seed)}</title>
<style>body{margin:2rem;background:#f8fafc;color:#0f172a;font:16px system-ui,sans-serif}svg{display:block;width:min(100%,1000px);height:auto;aspect-ratio:10/7;background:#fff;border:1px solid #cbd5e1}polyline{fill:none;stroke-width:.006;stroke-linecap:round;stroke-linejoin:round}p{margin:.5rem 0}</style></head>
<body><h1>Deterministic synthetic gesture replay</h1><p>Label: <span>${label}</span></p>
<svg viewBox="0 0 1 0.7" role="img" aria-label="Synthetic gesture labelled ${label}">${polylines}</svg>
<script type="application/json" id="gesture-data">${safeJson(data)}</script></body></html>
`;
}

export function main(argv = process.argv.slice(2)) {
  const { seed, out } = parseReplayArgs(argv);
  const html = renderReplay(syntheticReplay(seed));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html, 'utf8');
  return out;
}

if (process.argv[1] && resolve(fileURLToPath(pathToFileURL(process.argv[1]))) === resolve(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
