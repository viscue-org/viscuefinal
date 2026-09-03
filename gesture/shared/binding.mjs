import { validateResolution } from './schema.mjs';

const endpointId = hit => typeof hit?.node_id === 'string' && hit.node_id.trim() !== '' ? hit.node_id : null;
const hasHandle = hit => hit?.hit_type === 'handle';
const coordinates = hit => ({
  relative_x: Number.isFinite(hit?.relative_x) ? hit.relative_x : null,
  relative_y: Number.isFinite(hit?.relative_y) ? hit.relative_y : null,
});

function conflict(message) {
  throw new Error(`binding conflict: ${message}`);
}

function validateStructure(resolution, start, end) {
  const source = endpointId(start);
  const target = endpointId(end);
  const touchesHandle = hasHandle(start) || hasHandle(end);
  if (touchesHandle && resolution.intent !== 'resize' && resolution.intent !== 'connect') {
    conflict(`explicit handle is incompatible with ${resolution.intent}`);
  }
  if (resolution.intent === 'resize') {
    if (!touchesHandle || ![start, end].some(hit => hit?.handle_type === 'resize')) conflict('resize requires a resize handle');
    if (source && target && source !== target) conflict('resize cannot span two nodes');
  }
  if (resolution.intent === 'connect') {
    if (!source || !target || source === target) conflict('connect requires distinct authoritative source and target nodes');
    if ([start, end].some(hit => hasHandle(hit) && hit.handle_type === 'resize')) conflict('connect cannot use a resize handle');
  }
  return { source, target };
}

/** Adds authoritative post-prediction targets and coordinates to an accepted resolution. */
export function bindResolvedGesture(resolution, binding = {}) {
  const validation = validateResolution(resolution);
  if (!validation.ok || resolution.accepted !== true || resolution.intent === 'unknown') {
    throw new TypeError(`invalid resolution: ${validation.error ?? 'accepted known intent required'}`);
  }
  const start = binding.start ?? {};
  const end = binding.end ?? {};
  const { source, target } = validateStructure(resolution, start, end);
  return Object.freeze({
    intent: resolution.intent,
    family: resolution.family,
    confidence: resolution.confidence,
    model_version: resolution.model_version,
    resolution: Object.freeze({ ...resolution, alternatives: Object.freeze([...resolution.alternatives]) }),
    source,
    target,
    coordinates: Object.freeze({ start: Object.freeze(coordinates(start)), end: Object.freeze(coordinates(end)) }),
    contained: Object.freeze([...(Array.isArray(binding.contained_node_ids) ? binding.contained_node_ids : [])]),
  });
}
