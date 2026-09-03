import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FAMILIES,
  FAMILY_BY_INTENT,
  INTENTS,
  INTENTS_BY_FAMILY,
} from '../shared/taxonomy.mjs';
import {
  assertProductionFeatureKeys,
  validateRawGesture,
  validateResolution,
  validateRuntimeContext,
} from '../shared/schema.mjs';

const approvedIntents = [
  'select_region', 'lasso_select', 'apply_instruction', 'connect', 'move', 'resize', 'group', 'emphasize', 'remove', 'replace',
  'point_to', 'rough_layout', 'crop_region', 'reorder', 'insert_between', 'align', 'distribute', 'duplicate', 'rotate', 'zoom',
  'pan', 'approve', 'reject', 'compare', 'sequence', 'flow_direction', 'bracket_group', 'annotate', 'draw_layout', 'unknown',
];

const validMouseGesture = {
  gesture_id: 'gesture-1',
  schema_version: 'gesture-runtime/1.0',
  strokes: [{
    pointer_id: 1,
    pointer_type: 'mouse',
    button: 0,
    cancelled: false,
    points: [
      { x: 0.1, y: 0.2, time_ms: 0, pressure: null },
      { x: 0.4, y: 0.5, time_ms: 16, pressure: null },
    ],
  }],
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
};

const validRuntimeContext = {
  schema_version: 'gesture-context/1.0',
  active_tool: 'annotate',
  canvas_mode: 'edit',
  pointer_type: 'mouse',
  pointer_count: 1,
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  selected_node_count: 1,
  selected_node_types: ['asset:image'],
  nearby_nodes: [{
    node_type: 'asset:image',
    relative_x: 0.25,
    relative_y: -0.5,
    width: 0.3,
    height: 0.2,
    selected: true,
    same_container: true,
    incoming_edge_count: 0,
    outgoing_edge_count: 1,
  }],
  start_hit: { hit_type: 'node', node_type: 'asset:image', relative_x: 0, relative_y: 0 },
  end_hit: { hit_type: 'empty', node_type: null, relative_x: null, relative_y: null },
  instruction_binding_count: 0,
  reference_binding_count: 1,
  graph_edge_count: 2,
  object_order_count: 3,
};

test('taxonomy contains the approved 30 unique frozen intents and family mappings', () => {
  assert.deepEqual(INTENTS, approvedIntents);
  assert.equal(INTENTS.length, 30);
  assert.equal(new Set(INTENTS).size, 30);
  assert.equal(FAMILY_BY_INTENT.connect, 'relation');
  assert.equal(FAMILY_BY_INTENT.unknown, 'abstention');
  assert.deepEqual(FAMILIES, ['selection', 'relation', 'transform', 'navigation', 'markup', 'layout', 'abstention']);
  assert.equal(Object.isFrozen(INTENTS), true);
  assert.equal(Object.isFrozen(FAMILIES), true);
  assert.equal(Object.isFrozen(FAMILY_BY_INTENT), true);
  assert.equal(Object.isFrozen(INTENTS_BY_FAMILY), true);
  assert.equal(Object.isFrozen(INTENTS_BY_FAMILY.relation), true);
});

test('runtime feature allowlist accepts production facts and rejects simulator, labels, IDs, and unknown keys', () => {
  assert.doesNotThrow(() => assertProductionFeatureKeys(validRuntimeContext));
  assert.throws(
    () => assertProductionFeatureKeys({ active_tool: 'annotate', scenario_name: 'easy_connect' }),
    /scenario_name/,
  );
  assert.throws(() => assertProductionFeatureKeys({ is_connect: true }), /is_connect/);
  assert.throws(
    () => assertProductionFeatureKeys({ nearby_nodes: [{ node_type: 'asset:image', node_id: 'node-a' }] }),
    /node_id/,
  );
  assert.throws(
    () => assertProductionFeatureKeys({ active_tool: { raw_content: 'secret' } }),
    /active_tool|raw_content/,
  );
  assert.throws(
    () => assertProductionFeatureKeys({ selected_node_types: [{ user_text: 'hello' }] }),
    /selected_node_types|user_text/,
  );
  assert.throws(() => assertProductionFeatureKeys({ active_tool: 'annotate', surprise: 1 }), /surprise/);
});

test('production feature allowlist accepts structured nearby nodes and hit values', () => {
  assert.doesNotThrow(() => assertProductionFeatureKeys({
    nearby_nodes: [{
      node_type: 'asset:image',
      relative_x: 0.1,
      relative_y: -0.2,
      width: 0.3,
      height: 0.4,
      selected: false,
      same_container: true,
      incoming_edge_count: 0,
      outgoing_edge_count: 1,
    }],
    start_hit: { hit_type: 'node', node_type: 'asset:image', relative_x: 0, relative_y: 0 },
    end_hit: { hit_type: 'empty', node_type: null, relative_x: null, relative_y: null },
  }));
});

test('pressure remains nullable but coordinates and nondecreasing timestamps are required', () => {
  assert.equal(validateRawGesture(validMouseGesture).ok, true);
  assert.equal(validateRawGesture({
    ...validMouseGesture,
    strokes: [{
      ...validMouseGesture.strokes[0],
      points: [
        { x: 0.1, y: 0.2, time_ms: 10, pressure: null },
        { x: 0.2, y: 0.3, time_ms: 9, pressure: null },
      ],
    }],
  }).ok, false);
  assert.equal(validateRawGesture({
    ...validMouseGesture,
    strokes: [{
      ...validMouseGesture.strokes[0],
      points: [
        { x: 0.1, y: 0.2, time_ms: 0, pressure: 0 },
        { x: 1, y: 1, time_ms: 0, pressure: 1 },
      ],
    }],
  }).ok, true);
  assert.equal(validateRawGesture({
    ...validMouseGesture,
    strokes: [{
      ...validMouseGesture.strokes[0],
      points: [
        { x: -0.01, y: 0.2, time_ms: 0, pressure: null },
        { x: 0.2, y: 0.3, time_ms: 1, pressure: null },
      ],
    }],
  }).ok, false);
  assert.equal(validateRawGesture({
    ...validMouseGesture,
    strokes: [
      validMouseGesture.strokes[0],
      {
        ...validMouseGesture.strokes[0],
        points: [
          { x: 0.5, y: 0.5, time_ms: 15, pressure: null },
          { x: 0.6, y: 0.6, time_ms: 14, pressure: null },
        ],
      },
    ],
  }).ok, false);
});

test('raw gesture validation enforces stroke, point, pointer, pressure, and modifier boundaries', () => {
  const cases = [
    { ...validMouseGesture, strokes: [] },
    { ...validMouseGesture, strokes: Array.from({ length: 5 }, () => validMouseGesture.strokes[0]) },
    { ...validMouseGesture, strokes: [{ ...validMouseGesture.strokes[0], points: validMouseGesture.strokes[0].points.slice(0, 1) }] },
    { ...validMouseGesture, strokes: [{ ...validMouseGesture.strokes[0], points: Array.from({ length: 129 }, (_, index) => ({ x: 0.5, y: 0.5, time_ms: index, pressure: null })) }] },
    { ...validMouseGesture, strokes: [{ ...validMouseGesture.strokes[0], pointer_type: 'trackball' }] },
    { ...validMouseGesture, strokes: [{ ...validMouseGesture.strokes[0], points: [{ x: 0, y: 0, time_ms: 0, pressure: 1.01 }, { x: 1, y: 1, time_ms: 1, pressure: 1 }] }] },
    { ...validMouseGesture, modifiers: { ...validMouseGesture.modifiers, shift: 1 } },
    { ...validMouseGesture, extra: true },
  ];

  for (const candidate of cases) assert.equal(validateRawGesture(candidate).ok, false);
});

test('runtime context validation enforces the bounded production schema', () => {
  assert.equal(validateRuntimeContext(validRuntimeContext).ok, true);
  assert.equal(validateRuntimeContext({ ...validRuntimeContext, selected_node_count: -1 }).ok, false);
  assert.equal(validateRuntimeContext({ ...validRuntimeContext, nearby_nodes: Array.from({ length: 33 }, () => validRuntimeContext.nearby_nodes[0]) }).ok, false);
  assert.equal(validateRuntimeContext({ ...validRuntimeContext, ground_truth: 'connect' }).ok, false);
});

test('resolution validation separates accepted intents from abstention and rejects binding identifiers', () => {
  const accepted = {
    schema_version: 'gesture-resolution/1.0',
    family: 'relation',
    intent: 'connect',
    confidence: 0.982,
    accepted: true,
    reason: null,
    alternatives: [{ intent: 'sequence', confidence: 0.011 }],
    model_version: 'gesture-resolver/1.0.0',
  };
  const abstained = {
    schema_version: 'gesture-resolution/1.0',
    family: null,
    intent: null,
    confidence: 0,
    accepted: false,
    reason: 'low_confidence',
    alternatives: [],
    model_version: 'gesture-resolver/1.0.0',
  };

  assert.equal(validateResolution(accepted).ok, true);
  assert.equal(validateResolution(abstained).ok, true);
  assert.equal(validateResolution({ ...accepted, intent: 'unknown', family: 'abstention' }).ok, false);
  assert.equal(validateResolution({ ...accepted, family: 'selection' }).ok, false);
  assert.equal(validateResolution({ ...accepted, source: 'node-a' }).ok, false);
  assert.equal(validateResolution({ ...accepted, alternatives: [{ intent: 'sequence', confidence: 0.01, region_id: 'r1' }] }).ok, false);
  assert.equal(validateResolution({ ...abstained, intent: 'connect' }).ok, false);
  assert.equal(validateResolution({ ...abstained, reason: 'model_unavailable', model_version: null }).ok, true);
  assert.equal(validateResolution({ ...abstained, model_version: null }).ok, false);
  assert.equal(validateResolution({ ...abstained, reason: 'model_unavailable', model_version: '' }).ok, false);
});
