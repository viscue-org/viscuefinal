import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAnnotationCandidate } from '../runtime/annotation-policy.mjs';

const rawGesture = {
  gesture_id: 'annotation-1', schema_version: 'gesture-runtime/1.0',
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  strokes: [{ pointer_id: 1, pointer_type: 'mouse', button: 0, cancelled: false, points: [
    { x: 0.1, y: 0.2, time_ms: 0, pressure: null },
    { x: 0.8, y: 0.7, time_ms: 16, pressure: null },
  ] }],
};
const node = { id: 'asset_1', type: 'asset:image', position: { x: 0, y: 0 }, width: 1, height: 1 };

test('ordinary annotation bypasses semantic pipeline when no resolver is configured', () => {
  const result = resolveAnnotationCandidate({ rawGesture, nodes: [node], activeTool: 'annotate', canvasMode: 'annotate' });
  assert.equal(result.pipeline, null);
  assert.equal(result.operation, null);
});

test('an explicit local resolver creates an operation through the real pipeline', () => {
  const result = resolveAnnotationCandidate({
    rawGesture, nodes: [node], activeTool: 'annotate', canvasMode: 'annotate',
    model: () => ({
      schema_version: 'gesture-resolution/1.0', family: 'navigation', intent: 'pan', confidence: 0.9,
      accepted: true, reason: null, alternatives: [], model_version: 'test-local/1',
    }),
  });
  assert.deepEqual(result.pipeline.order, ['capture', 'geometry', 'features', 'resolve', 'bind', 'graph']);
  assert.equal(result.operation.intent, 'pan');
});
