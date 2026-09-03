import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModelInputs, FEATURE_NAMES } from '../shared/features.mjs';

const fixture = {
  strokes: [{
    pointer_id: 1,
    pointer_type: 'stylus',
    button: 0,
    cancelled: false,
    points: [
      { x: 0.1, y: 0.2, time_ms: 10, pressure: null },
      { x: 0.5, y: 0.4, time_ms: 30, pressure: 0.7 },
      { x: 0.9, y: 0.8, time_ms: 50, pressure: 0.5 },
    ],
  }],
  geometry: { start_x: 0.1, path_length: 1, closed: false },
  canvasContext: {
    start_hit: { hit_type: 'node', node_type: 'asset:image', relative_x: 0.2, relative_y: 0.3 },
    end_hit: { hit_type: 'empty', node_type: null, relative_x: null, relative_y: null },
    nearby_nodes: [{ node_type: 'asset:image', relative_x: 0.4, relative_y: -0.1, width: 0.3, height: 0.2, selected: true, same_container: false, incoming_edge_count: 1, outgoing_edge_count: 2 }],
    contained_node_count: 1,
    selected_overlap_count: 1,
    same_container: false,
    selected_node_count: 1,
    pointer_count: 1,
    graph_edge_count: 2,
    object_order_count: 3,
  },
  nodes: [{ id: 'node_A', type: 'asset:image', selected: true, position: { x: 0.2, y: 0.3 }, width: 0.4, height: 0.2 }],
  ground_truth: { intent: 'connect' },
};

test('model inputs have fixed documented dimensions and contain no IDs or ground truth', () => {

  const inputs = buildModelInputs(fixture);
  
  assert.deepEqual(inputs.shapes, { sequence: [4, 128, 7], geometry: [48], nodes: [32, 14], context: [24] });
  assert.equal(JSON.stringify(inputs).includes('node_A'), false);
  assert.equal(JSON.stringify(inputs).includes('ground_truth'), false);
  
  // Verify FEATURE_NAMES exists and has exact sizes
  assert.equal(FEATURE_NAMES.geometry.length, 48);
  assert.equal(FEATURE_NAMES.node.length, 14);
  assert.equal(FEATURE_NAMES.context.length, 24);
});

test('model inputs arc-resample real strokes and expose independent padding masks', () => {
  const inputs = buildModelInputs(fixture);
  assert.deepEqual(inputs.sequence[0][0], [0.1, 0.2, 0, 0, 0, 0, 0]);
  assert.deepEqual(inputs.sequence[0][127], [0.9, 0.8, 0.28197944, 0.00563959, 0.00563959, 0.5, 1]);
  assert.equal(inputs.sequence_mask[0][0], 1);
  assert.equal(inputs.sequence_mask[0][127], 1);
  assert.equal(inputs.stroke_mask[0], 1);
  assert.equal(inputs.stroke_mask[1], 0);
  assert.equal(inputs.sequence_mask[1][0], 0);
  assert.equal(inputs.geometry[0], 0.1);
  assert.equal(inputs.geometry[15], 1);
  assert.equal(inputs.nodes[0][3], 1);
  assert.equal(inputs.node_mask[0], 1);
  assert.equal(inputs.node_mask[1], 0);
  assert.equal(inputs.context.some(value => value !== 0), true);
});
