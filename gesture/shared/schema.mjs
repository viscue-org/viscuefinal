import {
  ABSTENTION_REASONS,
  ALTERNATIVE_KEYS,
  FORBIDDEN_FEATURE_KEYS,
  HIT_KEYS,
  MODIFIER_KEYS,
  NEARBY_NODE_KEYS,
  POINTER_TYPES,
  POINT_KEYS,
  RAW_GESTURE_KEYS,
  RESOLUTION_KEYS,
  RUNTIME_CONTEXT_KEYS,
  SCHEMA_VERSIONS,
  STROKE_KEYS,
} from './contracts.mjs';
import { FAMILIES, FAMILY_BY_INTENT, INTENTS } from './taxonomy.mjs';

const FAMILY_SET = new Set(FAMILIES);
const INTENT_SET = new Set(INTENTS);
const POINTER_SET = new Set(POINTER_TYPES);
const MODIFIER_SET = new Set(MODIFIER_KEYS);
const FORBIDDEN_SET = new Set(FORBIDDEN_FEATURE_KEYS);

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const isNonNegativeInteger = value => Number.isInteger(value) && value >= 0;
const hasExactKeys = (value, required, errors, path) => {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  const expected = new Set(required);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) errors.push(`${path}.${key} is not allowed`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) errors.push(`${path}.${key} is required`);
  }
  return true;
};
const result = errors => errors.length ? { ok: false, errors, error: errors[0] } : { ok: true, errors: [] };
const range = (value, minimum, maximum) => isFiniteNumber(value) && value >= minimum && value <= maximum;

function validateModifiers(modifiers, errors, path) {
  if (!hasExactKeys(modifiers, MODIFIER_KEYS, errors, path)) return;
  for (const key of MODIFIER_KEYS) {
    if (typeof modifiers[key] !== 'boolean') errors.push(`${path}.${key} must be boolean`);
  }
}

export function validateRawGesture(gesture) {
  const errors = [];
  if (!hasExactKeys(gesture, RAW_GESTURE_KEYS, errors, 'gesture')) return result(errors);
  if (typeof gesture.gesture_id !== 'string' || gesture.gesture_id.trim() === '') errors.push('gesture.gesture_id must be a non-empty string');
  if (gesture.schema_version !== SCHEMA_VERSIONS.rawGesture) errors.push('gesture.schema_version is unsupported');
  if (!Array.isArray(gesture.strokes) || gesture.strokes.length < 1 || gesture.strokes.length > 4) {
    errors.push('gesture.strokes must contain 1 to 4 strokes');
  }
  validateModifiers(gesture.modifiers, errors, 'gesture.modifiers');

  let previousTime = -Infinity;
  if (Array.isArray(gesture.strokes)) {
    gesture.strokes.forEach((stroke, strokeIndex) => {
      const path = `gesture.strokes[${strokeIndex}]`;
      if (!hasExactKeys(stroke, STROKE_KEYS, errors, path)) return;
      if (!isNonNegativeInteger(stroke.pointer_id)) errors.push(`${path}.pointer_id must be a non-negative integer`);
      if (!POINTER_SET.has(stroke.pointer_type)) errors.push(`${path}.pointer_type is unknown`);
      if (!Number.isInteger(stroke.button) || stroke.button < 0 || stroke.button > 5) errors.push(`${path}.button must be an integer from 0 to 5`);
      if (typeof stroke.cancelled !== 'boolean') errors.push(`${path}.cancelled must be boolean`);
      const points = stroke.points;
      const minimumPoints = stroke.cancelled === true ? 1 : 2;
      if (!Array.isArray(points) || points.length < minimumPoints || points.length > 128) {
        errors.push(`${path}.points must contain ${minimumPoints} to 128 points`);
        return;
      }
      points.forEach((point, pointIndex) => {
        const pointPath = `${path}.points[${pointIndex}]`;
        if (!hasExactKeys(point, POINT_KEYS, errors, pointPath)) return;
        if (!range(point.x, 0, 1) || !range(point.y, 0, 1)) errors.push(`${pointPath} coordinates must be finite and normalized to [0,1]`);
        if (!isFiniteNumber(point.time_ms) || point.time_ms < 0 || point.time_ms < previousTime) errors.push(`${pointPath}.time_ms must be nondecreasing and non-negative`);
        if (isFiniteNumber(point.time_ms)) previousTime = Math.max(previousTime, point.time_ms);
        if (point.pressure !== null && !range(point.pressure, 0, 1)) errors.push(`${pointPath}.pressure must be null or in [0,1]`);
      });
    });
  }
  return result(errors);
}

function validateHit(hit, errors, path) {
  if (!hasExactKeys(hit, HIT_KEYS, errors, path)) return;
  if (typeof hit.hit_type !== 'string' || hit.hit_type.trim() === '') errors.push(`${path}.hit_type must be a non-empty string`);
  if (hit.node_type !== null && (typeof hit.node_type !== 'string' || hit.node_type.trim() === '')) errors.push(`${path}.node_type must be null or a non-empty string`);
  for (const key of ['relative_x', 'relative_y']) {
    if (hit[key] !== null && !isFiniteNumber(hit[key])) errors.push(`${path}.${key} must be null or finite`);
  }
}

function validateNearbyNode(node, errors, path) {
  if (!hasExactKeys(node, NEARBY_NODE_KEYS, errors, path)) return;
  if (typeof node.node_type !== 'string' || node.node_type.trim() === '') errors.push(`${path}.node_type must be a non-empty string`);
  for (const key of ['relative_x', 'relative_y']) if (!isFiniteNumber(node[key])) errors.push(`${path}.${key} must be finite`);
  for (const key of ['width', 'height']) if (!range(node[key], 0, 1)) errors.push(`${path}.${key} must be in [0,1]`);
  for (const key of ['selected', 'same_container']) if (typeof node[key] !== 'boolean') errors.push(`${path}.${key} must be boolean`);
  for (const key of ['incoming_edge_count', 'outgoing_edge_count']) if (!isNonNegativeInteger(node[key])) errors.push(`${path}.${key} must be a non-negative integer`);
}

function validateProductionContextShape(context, { requireAll }) {
  const errors = [];
  const path = 'context';
  if (!isRecord(context)) return [`${path} must be an object`];
  const allowed = new Set(RUNTIME_CONTEXT_KEYS);
  for (const key of Object.keys(context)) {
    if (FORBIDDEN_SET.has(key)) errors.push(`${path}.${key} is forbidden in production features`);
    else if (!allowed.has(key)) errors.push(`${path}.${key} is not an allowed production feature`);
  }
  if (requireAll) for (const key of RUNTIME_CONTEXT_KEYS) if (!Object.hasOwn(context, key)) errors.push(`${path}.${key} is required`);

  if (Object.hasOwn(context, 'schema_version') && context.schema_version !== SCHEMA_VERSIONS.runtimeContext) errors.push(`${path}.schema_version is unsupported`);
  for (const key of ['active_tool', 'canvas_mode']) if (Object.hasOwn(context, key) && (typeof context[key] !== 'string' || context[key].trim() === '')) errors.push(`${path}.${key} must be a non-empty string`);
  if (Object.hasOwn(context, 'pointer_type') && !POINTER_SET.has(context.pointer_type)) errors.push(`${path}.pointer_type is unknown`);
  if (Object.hasOwn(context, 'pointer_count') && (!Number.isInteger(context.pointer_count) || context.pointer_count < 1 || context.pointer_count > 10)) errors.push(`${path}.pointer_count must be an integer from 1 to 10`);
  if (Object.hasOwn(context, 'modifiers')) validateModifiers(context.modifiers, errors, `${path}.modifiers`);
  if (Object.hasOwn(context, 'selected_node_count') && !isNonNegativeInteger(context.selected_node_count)) errors.push(`${path}.selected_node_count must be non-negative`);
  if (Object.hasOwn(context, 'selected_node_types') && (!Array.isArray(context.selected_node_types) || context.selected_node_types.length > 32 || context.selected_node_types.some(type => typeof type !== 'string' || type.trim() === ''))) errors.push(`${path}.selected_node_types must contain at most 32 non-empty strings`);
  if (Object.hasOwn(context, 'nearby_nodes')) {
    if (!Array.isArray(context.nearby_nodes) || context.nearby_nodes.length > 32) errors.push(`${path}.nearby_nodes must contain at most 32 nodes`);
    else context.nearby_nodes.forEach((node, index) => validateNearbyNode(node, errors, `${path}.nearby_nodes[${index}]`));
  }
  if (Object.hasOwn(context, 'start_hit')) validateHit(context.start_hit, errors, `${path}.start_hit`);
  if (Object.hasOwn(context, 'end_hit')) validateHit(context.end_hit, errors, `${path}.end_hit`);
  for (const key of ['instruction_binding_count', 'reference_binding_count', 'graph_edge_count', 'object_order_count']) if (Object.hasOwn(context, key) && !isNonNegativeInteger(context[key])) errors.push(`${path}.${key} must be non-negative`);
  return errors;
}

export function assertProductionFeatureKeys(value) {
  const errors = validateProductionContextShape(value, { requireAll: false });
  if (errors.length) throw new TypeError(errors[0]);
  return true;
}

export function validateRuntimeContext(context) {
  return result(validateProductionContextShape(context, { requireAll: true }));
}

export function validateResolution(resolution) {
  const errors = [];
  if (!hasExactKeys(resolution, RESOLUTION_KEYS, errors, 'resolution')) return result(errors);
  if (resolution.schema_version !== SCHEMA_VERSIONS.resolution) errors.push('resolution.schema_version is unsupported');
  const unavailableFallback = resolution.accepted === false
    && resolution.family === null
    && resolution.intent === null
    && resolution.reason === 'model_unavailable';
  if (unavailableFallback ? resolution.model_version !== null : (typeof resolution.model_version !== 'string' || resolution.model_version.trim() === '')) {
    errors.push(unavailableFallback
      ? 'model_unavailable abstention model_version must be null'
      : 'resolution.model_version must be a non-empty string');
  }
  if (!range(resolution.confidence, 0, 1)) errors.push('resolution.confidence must be in [0,1]');
  if (!Array.isArray(resolution.alternatives) || resolution.alternatives.length > 5) errors.push('resolution.alternatives must contain at most 5 entries');
  else resolution.alternatives.forEach((alternative, index) => {
    const path = `resolution.alternatives[${index}]`;
    if (!hasExactKeys(alternative, ALTERNATIVE_KEYS, errors, path)) return;
    if (!INTENT_SET.has(alternative.intent) || alternative.intent === 'unknown') errors.push(`${path}.intent must be a known non-abstention intent`);
    if (!range(alternative.confidence, 0, 1)) errors.push(`${path}.confidence must be in [0,1]`);
  });
  if (resolution.accepted === true) {
    if (!INTENT_SET.has(resolution.intent) || resolution.intent === 'unknown') errors.push('accepted resolution intent must not be unknown');
    if (!FAMILY_SET.has(resolution.family) || resolution.family === 'abstention') errors.push('accepted resolution family must be semantic');
    if (INTENT_SET.has(resolution.intent) && resolution.intent !== 'unknown' && resolution.family !== FAMILY_BY_INTENT[resolution.intent]) errors.push('resolution family does not match intent');
    if (resolution.reason !== null) errors.push('accepted resolution reason must be null');
  } else if (resolution.accepted === false) {
    if (resolution.intent !== null || resolution.family !== null) errors.push('abstention must have null intent and family');
    if (!ABSTENTION_REASONS.includes(resolution.reason)) errors.push('abstention reason is unsupported');
  } else errors.push('resolution.accepted must be boolean');
  return result(errors);
}
