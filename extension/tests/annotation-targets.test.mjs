import test from 'node:test';
import assert from 'node:assert/strict';
import { annotationSourcePoint, resolveAnnotationTarget } from '../src/utils/annotationTargets.mjs';

test('whole-image annotation stores the source as the entire image', () => {
  assert.deepEqual(annotationSourcePoint('whole', { x: 0.14, y: 0.83, timeMs: 1200 }), {
    x: 0.5,
    y: 0.5,
    timeMs: 1200,
    isWholeAsset: true,
  });
});
test('whole-image source can point to a precise location on another asset', () => {
  const target = resolveAnnotationTarget([
    { id: 'source', type: 'asset', position: { x: 0, y: 0 }, measured: { width: 200, height: 100 } },
    { id: 'target', type: 'asset', position: { x: 300, y: 200 }, measured: { width: 400, height: 200 } },
  ], 'source', { x: 620, y: 250 }, { preciseTarget: true });

  assert.equal(target.node.id, 'target');
  assert.deepEqual(target.anchor, { x: 0.8, y: 0.25, isWholeAsset: false });
});

test('ordinary point linking preserves whole-asset border targeting', () => {
  const target = resolveAnnotationTarget([
    { id: 'source', type: 'asset', position: { x: 0, y: 0 } },
    { id: 'target', type: 'asset', position: { x: 300, y: 200 }, measured: { width: 400, height: 200 } },
  ], 'source', { x: 305, y: 250 });

  assert.equal(target.node.id, 'target');
  assert.equal(target.anchor.isWholeAsset, true);
});
