import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GestureCapture, pointerPoint } from '../runtime/capture.mjs';
import { acceptRawGesture, releasePointerCapture } from '../runtime/acceptance.mjs';
import { validateRawGesture } from '../shared/schema.mjs';

const rect = { left: 10, top: 20, width: 200, height: 100 };

const pointer = ({
  pointerId = 7,
  pointerType = 'mouse',
  pressure,
  x = 10,
  y = 20,
  timeStamp = 100,
  button = 0,
  altKey = false,
  ctrlKey = false,
  metaKey = false,
  shiftKey = false,
} = {}) => ({
  pointerId,
  pointerType,
  pressure,
  clientX: x,
  clientY: y,
  timeStamp,
  button,
  altKey,
  ctrlKey,
  metaKey,
  shiftKey,
});

test('capture returns a schema-valid pen stroke with relative time and pressure', () => {
  const capture = new GestureCapture({ idFactory: () => 'g1' });
  capture.down(pointer({ pointerType: 'pen', pressure: 0.4, x: 20, y: 30, timeStamp: 100 }), rect);
  capture.move(pointer({ pointerType: 'pen', pressure: 0.6, x: 40, y: 50, timeStamp: 116 }), rect);
  const result = capture.up(pointer({ pointerType: 'pen', pressure: 0.2, x: 60, y: 70, timeStamp: 132 }), rect);

  assert.equal(result.strokes[0].pointer_type, 'stylus');
  assert.deepEqual(result.strokes[0].points, [
    { x: 0.05, y: 0.1, time_ms: 0, pressure: 0.4 },
    { x: 0.15, y: 0.3, time_ms: 16, pressure: 0.6 },
    { x: 0.25, y: 0.5, time_ms: 32, pressure: 0.2 },
  ]);
  assert.equal(validateRawGesture(result).ok, true);
});

test('capture uses the injected clock when a plain event has no timestamp', () => {
  const times = [100, 116, 132];
  const capture = new GestureCapture({ idFactory: () => 'clocked', now: () => times.shift() });
  capture.down(pointer({ timeStamp: null }), rect);
  capture.move(pointer({ timeStamp: null, x: 40, y: 50 }), rect);
  const result = capture.up(pointer({ timeStamp: null, x: 60, y: 70 }), rect);

  assert.deepEqual(result.strokes[0].points.map(point => point.time_ms), [0, 16, 32]);
  assert.equal(validateRawGesture(result).ok, true);
});

test('capture samples moves by time or normalized distance and always keeps the endpoint', () => {
  const capture = new GestureCapture({ idFactory: () => 'g2' });
  capture.down(pointer({ x: 10, y: 20, timeStamp: 100 }), rect);
  capture.move(pointer({ x: 10.1, y: 20.1, timeStamp: 104 }), rect);
  capture.move(pointer({ x: 11, y: 20, timeStamp: 105 }), rect);
  capture.move(pointer({ x: 11.1, y: 20, timeStamp: 109 }), rect);
  capture.move(pointer({ x: 11.1, y: 20, timeStamp: 113 }), rect);
  const result = capture.up(pointer({ x: 11.1, y: 20, timeStamp: 114 }), rect);

  assert.deepEqual(result.strokes[0].points.map(point => point.time_ms), [0, 5, 13, 14]);
  assert.equal(result.strokes[0].points[1].x, 0.005);
  assert.equal(validateRawGesture(result).ok, true);
});

test('capture marks a cancelled touch stroke and ignores a different pointer', () => {
  const capture = new GestureCapture({ idFactory: () => 'g3' });
  capture.down(pointer({ pointerId: 4, pointerType: 'touch', pressure: undefined, timeStamp: 10, altKey: true }), rect);
  capture.move(pointer({ pointerId: 5, pointerType: 'touch', timeStamp: 20, x: 190, y: 110 }), rect);
  const result = capture.cancel(pointer({ pointerId: 4, pointerType: 'touch', timeStamp: 21, x: 10, y: 20 }), rect);

  assert.equal(result.strokes[0].cancelled, true);
  assert.equal(result.strokes[0].pointer_type, 'touch');
  assert.equal(result.strokes[0].points.length, 1);
  assert.equal(result.strokes[0].points[0].pressure, null);
  assert.deepEqual(result.modifiers, { alt: true, ctrl: false, meta: false, shift: false });
  assert.equal(validateRawGesture(result).ok, true);
});

test('pointerPoint clamps geometry to schema bounds', () => {
  assert.deepEqual(
    pointerPoint(pointer({ pointerType: 'trackpad', x: -20, y: 220, timeStamp: 140, pressure: 2 }), rect, 100),
    { x: 0, y: 1, time_ms: 40, pressure: 1 },
  );
});

test('capture maps trackpad-like pointer types to mouse in the emitted stroke', () => {
  const capture = new GestureCapture({ idFactory: () => 'trackpad' });
  capture.down(pointer({ pointerType: 'trackpad', timeStamp: 100 }), rect);
  const result = capture.up(pointer({ pointerType: 'trackpad', x: 30, timeStamp: 116 }), rect);

  assert.equal(result.strokes[0].pointer_type, 'mouse');
  assert.equal(validateRawGesture(result).ok, true);
});

test('capture reserves the 128th point for a terminal endpoint after 127 sampled points', () => {
  const wideRect = { left: 0, top: 0, width: 10_000, height: 100 };
  const capture = new GestureCapture({ idFactory: () => 'point-limit' });
  capture.down(pointer({ x: 0, y: 0, timeStamp: 0 }), wideRect);
  for (let index = 1; index <= 127; index++) {
    capture.move(pointer({ x: index * 10, y: 0, timeStamp: index * 10 }), wideRect);
  }
  const result = capture.up(pointer({ x: 2_000, y: 0, timeStamp: 1_300 }), wideRect);

  assert.equal(result.strokes[0].points.length, 128);
  assert.deepEqual(result.strokes[0].points.at(-1), { x: 0.2, y: 0, time_ms: 1_300, pressure: null });
  assert.equal(validateRawGesture(result).ok, true);
});

test('capture coalesces many sampled moves while preserving the final endpoint', () => {
  const wideRect = { left: 0, top: 0, width: 20_000, height: 100 };
  const capture = new GestureCapture({ idFactory: () => 'many-points' });
  capture.down(pointer({ x: 0, y: 0, timeStamp: 0 }), wideRect);
  for (let index = 1; index <= 1_000; index++) {
    capture.move(pointer({ x: index * 10, y: 0, timeStamp: index * 10 }), wideRect);
  }
  const result = capture.up(pointer({ x: 15_000, y: 0, timeStamp: 10_010 }), wideRect);

  assert.equal(result.strokes[0].points.length, 128);
  assert.deepEqual(result.strokes[0].points.at(-1), { x: 0.75, y: 0, time_ms: 10_010, pressure: null });
  assert.equal(validateRawGesture(result).ok, true);
});

test('capture omits an exact duplicate endpoint but keeps two points for a tap', () => {
  const duplicate = new GestureCapture({ idFactory: () => 'duplicate-endpoint' });
  duplicate.down(pointer({ x: 10, y: 20, timeStamp: 100, pressure: 0.5 }), rect);
  duplicate.move(pointer({ x: 40, y: 50, timeStamp: 116, pressure: 0.7 }), rect);
  const duplicateResult = duplicate.up(pointer({ x: 40, y: 50, timeStamp: 116, pressure: 0.7 }), rect);

  const tap = new GestureCapture({ idFactory: () => 'tap' });
  tap.down(pointer({ x: 10, y: 20, timeStamp: 100 }), rect);
  const tapResult = tap.up(pointer({ x: 10, y: 20, timeStamp: 100 }), rect);

  assert.equal(duplicateResult.strokes[0].points.length, 2);
  assert.equal(tapResult.strokes[0].points.length, 2);
  assert.equal(validateRawGesture(duplicateResult).ok, true);
  assert.equal(validateRawGesture(tapResult).ok, true);
});

test('capture retains two sequential stroke boundaries with gesture-relative monotonic time', () => {
  const capture = new GestureCapture({ idFactory: () => 'sequential' });
  capture.down(pointer({ pointerId: 1, x: 10, y: 20, timeStamp: 100 }), rect);
  const firstResult = capture.up(pointer({ pointerId: 1, x: 30, y: 20, timeStamp: 116 }), rect);
  capture.down(pointer({ pointerId: 2, x: 10, y: 30, timeStamp: 124 }), rect);
  const result = capture.up(pointer({ pointerId: 2, x: 30, y: 30, timeStamp: 132 }), rect);

  assert.strictEqual(result, firstResult);
  assert.equal(result.strokes.length, 2);
  assert.deepEqual(result.strokes.map(stroke => stroke.points.map(point => point.time_ms)), [[0, 16], [24, 32]]);
  assert.equal(validateRawGesture(result).ok, true);
});

test('capture refuses a fifth sequential stroke', () => {
  const capture = new GestureCapture({ idFactory: () => 'four-strokes' });
  let result;
  for (let index = 0; index < 4; index++) {
    capture.down(pointer({ pointerId: index + 1, x: 10, timeStamp: index * 20 }), rect);
    result = capture.up(pointer({ pointerId: index + 1, x: 30, timeStamp: index * 20 + 10 }), rect);
  }

  assert.equal(capture.down(pointer({ pointerId: 5, timeStamp: 100 }), rect), null);
  assert.equal(result.strokes.length, 4);
  assert.equal(validateRawGesture(result).ok, true);
});

test('capture ignores mismatched pointer termination without clearing the active pointer', () => {
  const capture = new GestureCapture({ idFactory: () => 'pointer-identity' });
  capture.down(pointer({ pointerId: 4, timeStamp: 100 }), rect);

  assert.equal(capture.up(pointer({ pointerId: 5, timeStamp: 116 }), rect), null);
  assert.equal(capture.cancel(pointer({ pointerId: 5, timeStamp: 116 }), rect), null);
  const result = capture.up(pointer({ pointerId: 4, x: 30, timeStamp: 132 }), rect);

  assert.equal(result.strokes[0].cancelled, false);
  assert.equal(validateRawGesture(result).ok, true);
});

test('acceptance gate rejects cancelled and schema-invalid raw gestures', () => {
  const capture = new GestureCapture({ idFactory: () => 'accepted' });
  capture.down(pointer({ timeStamp: 100 }), rect);
  const valid = capture.up(pointer({ x: 30, timeStamp: 116 }), rect);
  const cancelled = structuredClone(valid);
  cancelled.strokes[0].cancelled = true;
  const invalid = structuredClone(valid);
  invalid.strokes[0].points = invalid.strokes[0].points.slice(0, 1);

  assert.strictEqual(acceptRawGesture(valid), valid);
  assert.equal(acceptRawGesture(cancelled), null);
  assert.equal(acceptRawGesture(invalid), null);
});

test('pointer release only invokes the platform release method when capture is held', () => {
  const releases = [];
  const target = {
    hasPointerCapture: pointerId => pointerId === 4,
    releasePointerCapture: pointerId => releases.push(pointerId),
  };

  assert.equal(releasePointerCapture(target, 5), false);
  assert.equal(releasePointerCapture(target, 4), true);
  assert.deepEqual(releases, [4]);
});
