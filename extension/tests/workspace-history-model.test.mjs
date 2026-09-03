import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryExport } from '../src/components/workspace/workspaceHistoryModel.mjs';

test('history export produces a portable named JSON snapshot', () => {
  const result = createHistoryExport({
    id: 'snapshot-1',
    timestamp: Date.parse('2026-09-01T10:00:00.000Z'),
    nodes: [{ id: 'asset-1' }],
    edges: [],
    gestureOperations: [],
  });

  assert.equal(result.filename, 'viscue-workspace-2026-09-01T10-00-00-000Z.json');
  assert.equal(result.mimeType, 'application/json');
  assert.deepEqual(JSON.parse(result.contents), {
    id: 'snapshot-1',
    timestamp: 1788256800000,
    nodes: [{ id: 'asset-1' }],
    edges: [],
    gestureOperations: [],
  });
});
