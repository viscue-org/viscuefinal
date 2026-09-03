import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceReferencePlan, rankReferences } from '../lib/policy.mjs';

function graphWithAssets(count, { required = [] } = {}) {
  const items = Array.from({ length: count }, (_, index) => ({
    id: `asset_${index}`,
    kind: 'image',
    name: `Reference ${index}`,
    intentional: true,
    role: required.includes(index) ? 'Preserve' : 'Reference',
  }));
  return { items, cues: required.map(index => ({ id: `cue_${index}`, assetId: `asset_${index}`, instruction: 'Keep this.' })), relations: [] };
}

test('blocks before provider work when required physical references exceed the plan', () => {
  const result = enforceReferencePlan(graphWithAssets(3, { required: [0, 1, 2] }), 'free');
  assert.equal(result.status, 'blocked');
  assert.deepEqual(result.selected, []);
  assert.deepEqual(result.requiredIds, ['asset_0', 'asset_1', 'asset_2']);
});

test('reserves required references before deterministically trimming optional references', () => {
  const graph = graphWithAssets(4, { required: [2] });
  const result = enforceReferencePlan(graph, 'free');
  assert.deepEqual(result.selected.map(item => item.id), ['asset_2', 'asset_0']);
  assert.deepEqual(result.trimmed.map(item => item.id), ['asset_1', 'asset_3']);
});

test('ranks equal references by explicit score then workspace order', () => {
  const ranked = rankReferences([
    { id: 'b', required: false, finalScore: 0.8, workspaceIndex: 1 },
    { id: 'a', required: true, finalScore: 0.1, workspaceIndex: 2 },
    { id: 'c', required: false, finalScore: 0.8, workspaceIndex: 0 },
  ]);
  assert.deepEqual(ranked.map(item => item.id), ['a', 'c', 'b']);
});
