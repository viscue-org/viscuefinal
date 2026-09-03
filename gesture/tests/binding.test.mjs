import test from 'node:test';
import assert from 'node:assert/strict';
import { bindResolvedGesture } from '../shared/binding.mjs';

const acceptedConnect = {
  schema_version: 'gesture-resolution/1.0', family: 'relation', intent: 'connect',
  confidence: 0.99, accepted: true, reason: null, alternatives: [], model_version: 'test-model/1',
};

test('accepted intent binds deterministic targets and a conflict abstains', () => {
  const authoritativeBinding = {
    start: { hit_type: 'node', node_id: 'node_A', relative_x: 0.1, relative_y: 0.2 },
    end: { hit_type: 'node', node_id: 'node_B', relative_x: 0.8, relative_y: 0.9 },
    contained_node_ids: []
  };

  const event = bindResolvedGesture(acceptedConnect, authoritativeBinding);
  assert.deepEqual([event.source, event.target], ['node_A', 'node_B']);
  assert.deepEqual(event.coordinates, { start: { relative_x: 0.1, relative_y: 0.2 }, end: { relative_x: 0.8, relative_y: 0.9 } });
  assert.notEqual(event.contained, authoritativeBinding.contained_node_ids);
  
  const explicitResizeHandle = {
    start: { hit_type: 'handle', handle_id: 'handle_1', handle_type: 'resize' },
    end: { hit_type: 'empty' }
  };
  assert.throws(() => bindResolvedGesture({ ...acceptedConnect, intent: 'pan', family: 'navigation' }, explicitResizeHandle), /conflict/);
});

test('binding rejects unknown, schema-invalid, unaccepted, and structurally invalid resolutions', () => {
  const pair = {
    start: { hit_type: 'node', node_id: 'node_A', relative_x: 0, relative_y: 0 },
    end: { hit_type: 'node', node_id: 'node_B', relative_x: 1, relative_y: 1 },
    contained_node_ids: ['node_A'],
  };
  assert.throws(() => bindResolvedGesture({ ...acceptedConnect, intent: 'unknown', family: 'abstention' }, pair), /invalid resolution/);
  assert.throws(() => bindResolvedGesture({ accepted: true, intent: 'connect' }, pair), /invalid resolution/);
  assert.throws(() => bindResolvedGesture({ ...acceptedConnect, accepted: false, intent: null, family: null, reason: 'low_confidence' }, pair), /invalid resolution/);
  assert.throws(() => bindResolvedGesture(acceptedConnect, { ...pair, end: { hit_type: 'empty' } }), /conflict/);
});
