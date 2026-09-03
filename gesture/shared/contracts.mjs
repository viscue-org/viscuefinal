/** Shared, versioned key and value contracts for the gesture runtime. */

export const SCHEMA_VERSIONS = Object.freeze({
  rawGesture: 'gesture-runtime/1.0',
  runtimeContext: 'gesture-context/1.0',
  resolution: 'gesture-resolution/1.0',
});

export const POINTER_TYPES = Object.freeze(['mouse', 'touch', 'stylus']);
export const MODIFIER_KEYS = Object.freeze(['alt', 'ctrl', 'meta', 'shift']);

export const RAW_GESTURE_KEYS = Object.freeze([
  'gesture_id', 'schema_version', 'strokes', 'modifiers',
]);
export const STROKE_KEYS = Object.freeze([
  'pointer_id', 'pointer_type', 'button', 'cancelled', 'points',
]);
export const POINT_KEYS = Object.freeze(['x', 'y', 'time_ms', 'pressure']);

export const RUNTIME_CONTEXT_KEYS = Object.freeze([
  'schema_version', 'active_tool', 'canvas_mode', 'pointer_type',
  'pointer_count', 'modifiers', 'selected_node_count', 'selected_node_types',
  'nearby_nodes', 'start_hit', 'end_hit', 'instruction_binding_count',
  'reference_binding_count', 'graph_edge_count', 'object_order_count',
]);
export const NEARBY_NODE_KEYS = Object.freeze([
  'node_type', 'relative_x', 'relative_y', 'width', 'height', 'selected',
  'same_container', 'incoming_edge_count', 'outgoing_edge_count',
]);
export const HIT_KEYS = Object.freeze([
  'hit_type', 'node_type', 'relative_x', 'relative_y',
]);

export const RESOLUTION_KEYS = Object.freeze([
  'schema_version', 'family', 'intent', 'confidence', 'accepted', 'reason',
  'alternatives', 'model_version',
]);
export const ALTERNATIVE_KEYS = Object.freeze(['intent', 'confidence']);

// These are the only facts allowed to reach a production resolver. The
// nested maps are intentionally explicit so simulator metadata cannot sneak
// in under an otherwise valid object.
export const PRODUCTION_FEATURE_KEYS = Object.freeze({
  root: RUNTIME_CONTEXT_KEYS,
  modifiers: MODIFIER_KEYS,
  nearby_nodes: NEARBY_NODE_KEYS,
  hit: HIT_KEYS,
});
export const ALLOWED_PRODUCTION_FEATURE_KEYS = PRODUCTION_FEATURE_KEYS;

export const FORBIDDEN_FEATURE_KEYS = Object.freeze([
  'source', 'target', 'node_id', 'region_id',
  'scenario_name', 'scenario_id', 'template_id', 'generator_parameters',
  'persona_id', 'ground_truth', 'label', 'intent', 'feasibility',
  'is_connect', 'is_sequence', 'is_flow_direction',
]);

export const ABSTENTION_REASONS = Object.freeze([
  'ambiguous_intent', 'low_confidence', 'ood', 'invalid_input',
  'model_unavailable',
]);

