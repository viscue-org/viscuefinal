import test from 'node:test';
import assert from 'node:assert/strict';
import { processGestureCandidate } from '../runtime/pipeline.mjs';
import { resolveAnnotationCandidate } from '../runtime/annotation-policy.mjs';

const asyncCandidate = {
  rawGesture: {
    gesture_id: 'async', schema_version: 'gesture-runtime/1.0', modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    strokes: [{ pointer_id: 1, pointer_type: 'mouse', button: 0, cancelled: false, points: [{ x: 0.1, y: 0.1, time_ms: 0, pressure: null }, { x: 0.9, y: 0.9, time_ms: 16, pressure: null }] }],
  },
  nodes: [
    { id: 'A', type: 'asset:image', position: { x: 0, y: 0 }, width: 0.3, height: 0.3 },
    { id: 'B', type: 'asset:image', position: { x: 0.7, y: 0.7 }, width: 0.3, height: 0.3 },
  ],
  model: async () => ({ schema_version: 'gesture-resolution/1.0', family: 'relation', intent: 'connect', confidence: 0.92, accepted: true, reason: null, alternatives: [], model_version: 'test/1' }),
};

test('async model output reaches annotation binding as a resolved value, never a Promise', async () => {
  const result = await resolveAnnotationCandidate(asyncCandidate);
  assert.equal(result.operation.intent, 'connect');
  assert.equal(result.operation.source, 'A');
  assert.equal(result.operation.target, 'B');
  assert.equal(result.operation.resolution.accepted, true);
});

test('failed inference preserves drawing with a serializable abstention', async () => {
  const result = await resolveAnnotationCandidate({ ...asyncCandidate, model: async () => { throw new Error('WASM failed'); } });
  assert.equal(result.operation.unresolved, true);
  assert.equal(result.operation.resolution.reason, 'model_unavailable');
  assert.doesNotThrow(() => structuredClone(result.operation));
});

test('runtime pipeline runs capture data through geometry, features, resolver, binding, and graph in order', () => {
  const rawGesture = {
    gesture_id: 'g1', schema_version: 'gesture-runtime/1.0', modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    strokes: [{ pointer_id: 1, pointer_type: 'mouse', button: 0, cancelled: false, points: [{ x: 0.1, y: 0.1, time_ms: 0, pressure: null }, { x: 0.9, y: 0.9, time_ms: 16, pressure: null }] }],
  };
  const result = processGestureCandidate({
    rawGesture,
    nodes: [{ id: 'node_A', type: 'asset:image', position: { x: 0, y: 0 }, width: 1, height: 1 }],
    edges: [], activeTool: 'annotate', canvasMode: 'edit',
    graph: { operations: [] },
  });
  assert.deepEqual(result.order, ['capture', 'geometry', 'features', 'resolve', 'bind', 'graph']);
  assert.equal(result.resolution.reason, 'model_unavailable');
  assert.equal(result.graph.operations.length, 1);
  assert.equal(result.graph.operations[0].unresolved, true);
});

test('runtime pipeline resolves and binds operation when active model is supplied', () => {
  const rawGesture = {
    gesture_id: 'g2', schema_version: 'gesture-runtime/1.0', modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    strokes: [{ pointer_id: 1, pointer_type: 'mouse', button: 0, cancelled: false, points: [{ x: 0.1, y: 0.1, time_ms: 0, pressure: null }, { x: 0.9, y: 0.9, time_ms: 16, pressure: null }] }],
  };
  const mockModel = () => ({
    schema_version: 'gesture-resolution/1.0',
    family: 'relation',
    intent: 'connect',
    confidence: 0.92,
    accepted: true,
    reason: null,
    alternatives: [],
    model_version: 'gesture-fusion-v1',
  });
  const result = processGestureCandidate({
    rawGesture,
    nodes: [
      { id: 'node_A', type: 'asset:image', position: { x: 0, y: 0 }, width: 0.3, height: 0.3 },
      { id: 'node_B', type: 'asset:image', position: { x: 0.7, y: 0.7 }, width: 0.3, height: 0.3 },
    ],
    edges: [], activeTool: 'connect', canvasMode: 'edit',
    graph: { operations: [] },
    model: mockModel,
  });
  assert.deepEqual(result.order, ['capture', 'geometry', 'features', 'resolve', 'bind', 'graph']);
  assert.equal(result.resolution.accepted, true);
  assert.equal(result.resolution.intent, 'connect');
  assert.equal(result.graph.operations.length, 1);
});

test('cancelled gestures abstain without executing a model prediction', () => {
  let calls = 0;
  const result = processGestureCandidate({
    rawGesture: {
      gesture_id: 'cancelled', schema_version: 'gesture-runtime/1.0', modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      strokes: [{ pointer_id: 1, pointer_type: 'touch', button: 0, cancelled: true, points: [{ x: 0.1, y: 0.1, time_ms: 0, pressure: null }] }],
    },
    model: () => {
      calls += 1;
      return { schema_version: 'gesture-resolution/1.0', family: 'navigation', intent: 'zoom', confidence: 0.99, accepted: true, reason: null, alternatives: [], model_version: 'unsafe/1' };
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.resolution.accepted, false);
  assert.equal(result.resolution.reason, 'invalid_input');
  assert.equal(result.operation.unresolved, true);
});

test('accidental micro-strokes abstain instead of executing high-confidence layout predictions', () => {
  let calls = 0;
  const result = processGestureCandidate({
    rawGesture: {
      gesture_id: 'noise', schema_version: 'gesture-runtime/1.0', modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      strokes: [{ pointer_id: 1, pointer_type: 'mouse', button: 0, cancelled: false, points: [
        { x: 0.5, y: 0.5, time_ms: 0, pressure: null },
        { x: 0.501, y: 0.501, time_ms: 5, pressure: null },
      ] }],
    },
    model: () => {
      calls += 1;
      return { schema_version: 'gesture-resolution/1.0', family: 'layout', intent: 'rough_layout', confidence: 0.99, accepted: true, reason: null, alternatives: [], model_version: 'unsafe/1' };
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.resolution.accepted, false);
  assert.equal(result.resolution.reason, 'invalid_input');
});

test('annotation-only UI rejects navigation predictions as out of context', () => {
  const result = processGestureCandidate({
    rawGesture: {
      gesture_id: 'annotation', schema_version: 'gesture-runtime/1.0', modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      strokes: [{ pointer_id: 1, pointer_type: 'stylus', button: 0, cancelled: false, points: [
        { x: 0.2, y: 0.4, time_ms: 0, pressure: 0.6 },
        { x: 0.8, y: 0.5, time_ms: 120, pressure: 0.6 },
      ] }],
    },
    activeTool: 'annotate',
    model: () => ({ schema_version: 'gesture-resolution/1.0', family: 'navigation', intent: 'zoom', confidence: 0.98, accepted: true, reason: null, alternatives: [], model_version: 'gesture-fusion-v1' }),
  });

  assert.equal(result.resolution.accepted, false);
  assert.equal(result.resolution.reason, 'ood');
  assert.equal(result.operation.unresolved, true);
});
