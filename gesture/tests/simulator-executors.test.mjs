import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { deriveGeometry } from '../shared/geometry.mjs';
import { validateRawGesture } from '../shared/schema.mjs';
import { INTENTS } from '../shared/taxonomy.mjs';
import { FAMILY_BY_INTENT } from '../shared/taxonomy.mjs';
import { feasibleIntents } from '../simulator/feasibility.mjs';
import { executeGoal } from '../simulator/executors.mjs';
import { generatePersona } from '../simulator/personas.mjs';
import { createPrng } from '../simulator/prng.mjs';
import { generateWorld, sampleGoal } from '../simulator/worlds.mjs';

const richSemanticWorld = fixture(91);
const semanticSignature = gesture => {
  const strokes = gesture.strokes.map(stroke => {
    const first = stroke.points[0]; const last = stroke.points.at(-1);
    return { count: stroke.points.length, cancelled: stroke.cancelled, closed: Math.hypot(first.x - last.x, first.y - last.y) < 0.02, start: [first.x, first.y], end: [last.x, last.y] };
  });
  return JSON.stringify({ stroke_count: gesture.strokes.length, strokes });
};

function fixture(seed = 42) {
  const persona = generatePersona(seed);
  const world = generateWorld(seed, persona);
  return { persona, world, goal: sampleGoal(world, persona, createPrng(`goal:${seed}`)), seed };
}

test('every feasible taxonomy family emits deterministic schema-valid production-shaped strokes', () => {
  const familyStrokes = new Map();
  const input = fixture(91);
  for (const intent of feasibleIntents(input.world).filter(intent => intent !== 'unknown')) {
    const goal = { ...input.goal, intent, family: FAMILY_BY_INTENT[intent], accepted: true, reason: null };
    const first = executeGoal({ ...input, goal, seed: `family:${intent}` });
    const second = executeGoal({ ...input, goal, seed: `family:${intent}` });
    assert.deepEqual(first, second, `${intent} is seed deterministic`);
    assert.equal(validateRawGesture(first).ok, true, `${intent} obeys the Task 2 raw schema`);
    assert.ok(first.strokes.length >= 1 && first.strokes.length <= 4, `${intent} uses 1–4 strokes`);
    assert.equal(JSON.stringify(first).includes('persona_id'), false, `${intent} does not expose persona provenance`);
    const geometry = deriveGeometry(first);
    assert.ok(geometry.point_count >= 2, `${intent} has an executable path`);
    familyStrokes.set(goal.family, first.strokes.length);
  }
  for (const family of ['selection', 'relation', 'transform', 'navigation', 'markup', 'layout']) assert.ok(familyStrokes.has(family));
});

test('relation arrows have a shaft and arrowhead while selection/crop paths close with bounded coordinates', () => {
  const input = fixture(23);
  const arrow = executeGoal({ ...input, goal: { ...input.goal, intent: 'connect', family: 'relation', accepted: true, reason: null } });
  assert.ok(arrow.strokes.length >= 2);
  assert.ok(arrow.strokes[0].points.length >= 8);
  assert.ok(arrow.strokes[1].points.length >= 3);
  for (const intent of ['select_region', 'lasso_select', 'crop_region']) {
    const gesture = executeGoal({ ...input, goal: { ...input.goal, intent, family: 'selection', accepted: true, reason: null }, seed: `closed:${intent}` });
    assert.equal(deriveGeometry(gesture).closed, true, `${intent} is a selection enclosure`);
    for (const point of gesture.strokes.flatMap(stroke => stroke.points)) assert.ok(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
  }
});

test('motor generation includes monotonic timing, dwell, correction, cancellation, and device pressure without latent leakage', () => {
  const input = fixture(7);
  const persona = { ...input.persona, hesitation: 0.35, overshoot: 0.16, correction: 0.18, jitter: 0.06, device: 'stylus' };
  const deliberate = executeGoal({ ...input, persona, goal: { ...input.goal, intent: 'move', family: 'transform', accepted: true, reason: null }, seed: 'motor' });
  const points = deliberate.strokes.flatMap(stroke => stroke.points);
  assert.ok(points.every((point, index) => index === 0 || point.time_ms >= points[index - 1].time_ms));
  assert.ok(points.some(point => point.pressure !== null && point.pressure >= 0 && point.pressure <= 1));
  assert.ok(new Set(points.map(point => point.time_ms)).size > 4, 'trajectory has a time profile rather than fixed cadence');
  assert.ok(deliberate.strokes[0].points.length >= 10, 'dwell and correction are sampled into the raw trajectory');
  const cancelled = executeGoal({ ...input, goal: { ...input.goal, intent: 'unknown', family: 'abstention', accepted: false, reason: 'ambiguous_intent', outcome: 'cancelled' }, seed: 'cancel' });
  assert.equal(validateRawGesture(cancelled).ok, true);
  assert.ok(cancelled.strokes.some(stroke => stroke.cancelled));
  assert.equal(JSON.stringify(deliberate).includes('persona_id'), false);
});

test('motor executor represents missed acquisition and release failure as valid failure gestures', () => {
  const input = fixture(12);
  const missed = executeGoal({ ...input, goal: { ...input.goal, intent: 'connect', family: 'relation', accepted: true, reason: null, outcome: 'missed' }, seed: 'missed' });
  const released = executeGoal({ ...input, goal: { ...input.goal, intent: 'connect', family: 'relation', accepted: false, reason: 'invalid_input', outcome: 'release_failed' }, seed: 'released' });
  assert.equal(validateRawGesture(missed).ok, true);
  assert.equal(validateRawGesture(released).ok, true);
  assert.equal(released.strokes[0].cancelled, true);
});

test('executor rejects infeasible semantic goals instead of silently emitting a label-shaped path', () => {
  const input = fixture(19);
  const impossible = structuredClone(input.world);
  impossible.simulation.authority.handles = [];
  assert.throws(() => executeGoal({ ...input, world: impossible, goal: { ...input.goal, intent: 'resize', family: 'transform', accepted: true, reason: null } }), /feasible/i);
});

test('executor rejects a family label that does not match the requested intent', () => {
  const input = fixture(91);
  assert.throws(() => executeGoal({ ...input, goal: { ...input.goal, intent: 'connect', family: 'selection', accepted: true, reason: null } }), /family/i);
});

test('each semantic intent has an independent world-grounded trajectory signature', () => {
  const signatures = new Map();
  for (const intent of INTENTS.filter(candidate => candidate !== 'unknown')) {
    const goal = { ...richSemanticWorld.goal, intent, family: FAMILY_BY_INTENT[intent], accepted: true, reason: null };
    const gesture = executeGoal({ ...richSemanticWorld, goal, seed: `semantic:${intent}` });
    signatures.set(intent, semanticSignature(gesture));
  }
  assert.equal(JSON.parse(signatures.get('select_region')).strokes[0].closed, true);
  assert.equal(JSON.parse(signatures.get('lasso_select')).strokes[0].count >= 9, true);
  assert.equal(JSON.parse(signatures.get('zoom')).stroke_count, 2);
  assert.equal(JSON.parse(signatures.get('pan')).stroke_count, 1);
  assert.equal(JSON.parse(signatures.get('rough_layout')).stroke_count, 3);
  assert.equal(JSON.parse(signatures.get('draw_layout')).stroke_count, 2);
  for (const intents of [
    ['apply_instruction', 'connect', 'point_to', 'replace', 'insert_between', 'sequence', 'flow_direction'],
    ['move', 'resize', 'reorder', 'align', 'distribute', 'duplicate', 'rotate'],
    ['emphasize', 'remove', 'approve', 'reject', 'annotate'],
    ['rough_layout', 'draw_layout', 'compare', 'bracket_group', 'group'],
  ]) {
    assert.equal(new Set(intents.map(intent => signatures.get(intent))).size, intents.length, `semantic programs differ: ${intents.join(', ')}`);
  }
});

test('insert_between consumes and validates the authoritative adjacent reference pair', () => {
  const input = fixture(91);
  assert.throws(() => executeGoal({ ...input, goal: { ...input.goal, intent: 'insert_between', family: 'relation', accepted: true, references: { pair: ['not-a-node', 'also-not-a-node'] } } }), /pair|adjacent|reference/i);
});

test('offline replay CLI runs the real deterministic simulator, escapes content, and rejects malformed arguments', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gesture-replay-'));
  const out = join(directory, 'nested', 'seed.html');
  const cli = join(process.cwd(), 'gesture', 'simulator', 'replay-cli.mjs');
  execFileSync(process.execPath, [cli, '--seed', '42', '--out', out], { encoding: 'utf8' });
  assert.equal(existsSync(out), true);
  const html = readFileSync(out, 'utf8');
  assert.match(html, /"strokes"/);
  assert.match(html, /"labels"/);
  assert.equal(html.includes('persona_id'), false);
  assert.equal(html.includes('synthetic instruction'), false);
  assert.equal(/https?:|<script\s+src/i.test(html), false);
  assert.throws(() => execFileSync(process.execPath, [cli, '--seed', 'not-a-number', '--out', out], { encoding: 'pipe' }));
  assert.throws(() => execFileSync(process.execPath, [cli, '--seed', '1', '--out'], { encoding: 'pipe' }));
});
