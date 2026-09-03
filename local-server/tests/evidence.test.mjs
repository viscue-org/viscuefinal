import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSpatialRelations, normalizeEvidence, validateCompositePanels } from '../lib/evidence.mjs';

const validGrid = [
  { id: 'a', bbox: [0, 0, 0.5, 0.5] },
  { id: 'b', bbox: [0.5, 0, 1, 0.5] },
  { id: 'c', bbox: [0, 0.5, 0.5, 1] },
  { id: 'd', bbox: [0.5, 0.5, 1, 1] },
];

test('accepts a covered 2x2 composite and rejects excessive panel overlap', () => {
  assert.equal(validateCompositePanels(validGrid).ok, true);
  assert.equal(validateCompositePanels([
    { id: 'a', bbox: [0, 0, 0.8, 0.8] },
    { id: 'b', bbox: [0.1, 0.1, 0.9, 0.9] },
  ]).ok, false);
});

test('marks semantic model claims as inferred evidence with bounded confidence', () => {
  const evidence = normalizeEvidence(
    { type: 'relation', value: 'owns', confidence: 7 },
    { provider: 'qwen', model: 'qwen3-vl', assetId: 'asset_1' },
  );
  assert.equal(evidence.observation_kind, 'inferred');
  assert.equal(evidence.confidence, 1);
  assert.equal(evidence.provenance.asset_id, 'asset_1');
});

test('derives spatial relations from geometry instead of model wording', () => {
  const relations = deriveSpatialRelations([
    { id: 'left', bbox: [0.1, 0.3, 0.3, 0.6] },
    { id: 'right', bbox: [0.7, 0.3, 0.9, 0.6] },
  ]);
  assert.deepEqual(relations, [{ source_id: 'left', relation: 'left_of', target_id: 'right', observation_kind: 'derived' }]);
});
