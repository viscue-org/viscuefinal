import test from 'node:test';
import assert from 'node:assert/strict';
import { appendGestureOperation, createWorkspaceSnapshot, hydrateWorkspace, resetWorkspace } from '../shared/operation-lifecycle.mjs';

test('workspace snapshots retain operation history independently from source arrays', () => {
  const operations = [{ unresolved: true, resolution: { reason: 'model_unavailable' } }];
  const snapshot = createWorkspaceSnapshot([{ id: 'node_1' }], [{ id: 'edge_1' }], operations);
  operations[0].resolution.reason = 'mutated';
  const hydrated = hydrateWorkspace(snapshot);
  assert.equal(hydrated.gestureOperations[0].resolution.reason, 'model_unavailable');
  assert.deepEqual(hydrated.nodes, [{ id: 'node_1' }]);
  assert.deepEqual(hydrated.edges, [{ id: 'edge_1' }]);
});

test('workspace reset removes operations as well as nodes and edges', () => {
  assert.deepEqual(resetWorkspace(), { nodes: [], edges: [], gestureOperations: [] });
  assert.deepEqual(hydrateWorkspace({ nodes: [], edges: [] }), { nodes: [], edges: [], gestureOperations: [] });
});

test('appending an operation returns a detached list without leaking later mutations', () => {
  const existing = [{ intent: 'resize', source: 'node_1' }];
  const operation = { unresolved: true, resolution: { reason: 'model_unavailable' } };
  const next = appendGestureOperation(existing, operation);

  operation.resolution.reason = 'mutated';
  existing.push({ intent: 'connect', source: 'node_1', target: 'node_2' });

  assert.deepEqual(next, [
    { intent: 'resize', source: 'node_1' },
    { unresolved: true, resolution: { reason: 'model_unavailable' } },
  ]);
  assert.notEqual(next, existing);
});
