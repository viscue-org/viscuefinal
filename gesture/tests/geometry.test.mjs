import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { deriveGeometry, GEOMETRY_FEATURE_NAMES } from '../shared/geometry.mjs';

const golden = JSON.parse(await readFile(new URL('./fixtures/geometry-golden.json', import.meta.url), 'utf8'));

const point = (x, y, time_ms, pressure = null) => ({ x, y, time_ms, pressure });
const gesture = strokes => ({
  gesture_id: 'geometry-fixture',
  schema_version: 'gesture-runtime/1.0',
  strokes: strokes.map((points, index) => ({
    pointer_id: index + 1,
    pointer_type: 'mouse',
    button: 0,
    cancelled: false,
    points,
  })),
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
});

test('open line geometry matches the exact 48-value golden summary', () => {
  const result = deriveGeometry(gesture([[
    point(0.1, 0.2, 0),
    point(0.5, 0.2, 50),
    point(0.9, 0.2, 100),
  ]]));

  assert.equal(GEOMETRY_FEATURE_NAMES.length, 48);
  assert.deepEqual(Object.fromEntries(GEOMETRY_FEATURE_NAMES.map(name => [name, result[name]])), golden.open_line);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), golden.open_line);
});

test('closed square has stable closure, curvature, and turning summaries', () => {
  const result = deriveGeometry(gesture([[
    point(0.2, 0.2, 0),
    point(0.8, 0.2, 100),
    point(0.8, 0.8, 200),
    point(0.2, 0.8, 300),
    point(0.2, 0.2, 400),
  ]]));

  assert.deepEqual({
    path_length: result.path_length,
    displacement: result.displacement,
    straightness: result.straightness,
    closure_distance: result.closure_distance,
    closure_ratio: result.closure_ratio,
    closed: result.closed,
    mean_abs_curvature: result.mean_abs_curvature,
    total_abs_turn: result.total_abs_turn,
  }, {
    path_length: 2.4,
    displacement: 0,
    straightness: 0,
    closure_distance: 0,
    closure_ratio: 0,
    closed: true,
    mean_abs_curvature: 2.61799388,
    total_abs_turn: 4.71238898,
  });
});

test('self-intersection count detects a proper bow-tie crossing', () => {
  const result = deriveGeometry(gesture([[
    point(0.1, 0.1, 0),
    point(0.9, 0.9, 10),
    point(0.1, 0.9, 20),
    point(0.9, 0.1, 30),
  ]]));

  assert.equal(result.self_intersection_count, 1);
});

test('multi-stroke summaries do not invent a path segment across the stroke gap', () => {
  const result = deriveGeometry(gesture([
    [point(0, 0, 0), point(0.1, 0, 10)],
    [point(0.2, 0, 30), point(0.3, 0, 40)],
  ]));

  assert.deepEqual({
    path_length: result.path_length,
    displacement: result.displacement,
    duration_ms: result.duration_ms,
    stroke_count: result.stroke_count,
    inter_stroke_distance: result.inter_stroke_distance,
    inter_stroke_time_ms: result.inter_stroke_time_ms,
  }, {
    path_length: 0.2,
    displacement: 0.3,
    duration_ms: 40,
    stroke_count: 2,
    inter_stroke_distance: 0.1,
    inter_stroke_time_ms: 20,
  });
});

test('acceleration summaries exclude transitions between separate strokes', () => {
  const result = deriveGeometry(gesture([
    [point(0, 0, 0), point(0.1, 0, 10), point(0.2, 0, 20)],
    [point(0.3, 0, 40), point(0.5, 0, 50), point(0.7, 0, 60)],
  ]));

  assert.deepEqual({
    mean_acceleration: result.mean_acceleration,
    acceleration_q25: result.acceleration_q25,
    acceleration_q50: result.acceleration_q50,
    acceleration_q75: result.acceleration_q75,
    max_abs_acceleration: result.max_abs_acceleration,
  }, {
    mean_acceleration: 0,
    acceleration_q25: 0,
    acceleration_q50: 0,
    acceleration_q75: 0,
    max_abs_acceleration: 0,
  });
});

test('duplicate points and zero elapsed time produce finite deterministic features', () => {
  const result = deriveGeometry(gesture([[
    point(0.4, 0.4, 0, 0),
    point(0.4, 0.4, 0, 1),
  ]]));

  for (const name of GEOMETRY_FEATURE_NAMES) {
    if (typeof result[name] === 'number') assert.equal(Number.isFinite(result[name]), true, name);
  }
  assert.deepEqual({
    duration_ms: result.duration_ms,
    path_length: result.path_length,
    displacement: result.displacement,
    straightness: result.straightness,
    mean_speed: result.mean_speed,
    mean_abs_curvature: result.mean_abs_curvature,
    closed: result.closed,
    pressure_mean: result.pressure_mean,
    pressure_present_ratio: result.pressure_present_ratio,
  }, {
    duration_ms: 0,
    path_length: 0,
    displacement: 0,
    straightness: 0,
    mean_speed: 0,
    mean_abs_curvature: 0,
    closed: false,
    pressure_mean: 0.5,
    pressure_present_ratio: 1,
  });
});

test('a micro-jitter loop is not promoted to a closed lasso', () => {
  const result = deriveGeometry(gesture([[
    point(0.1, 0.1, 0), point(0.105, 0.105, 10), point(0.1, 0.1, 20),
  ]]));

  assert.equal(result.closed, false);
});

test('a zero-area backtrack is not classified as a closed path', () => {
  const result = deriveGeometry(gesture([[
    point(0.1, 0.1, 0), point(0.8, 0.1, 10), point(0.1, 0.1, 20),
  ]]));

  assert.equal(result.closed, false);
});

test('a nonzero-area loop remains classified as a closed path', () => {
  const result = deriveGeometry(gesture([[
    point(0.2, 0.2, 0), point(0.8, 0.2, 10), point(0.5, 0.8, 20), point(0.2, 0.2, 30),
  ]]));

  assert.equal(result.closed, true);
});

test('separate strokes are never joined into one closed path', () => {
  const result = deriveGeometry(gesture([
    [point(0.1, 0.1, 0), point(0.5, 0.1, 10)],
    [point(0.5, 0.5, 20), point(0.1, 0.1, 30)],
  ]));

  assert.equal(result.closed, false);
});

test('invalid raw gesture input is rejected at the geometry boundary', () => {
  assert.throws(() => deriveGeometry({ strokes: [] }), /invalid raw gesture/i);
});
