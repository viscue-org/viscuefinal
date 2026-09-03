import { GEOMETRY_FEATURE_NAMES } from './geometry.mjs';
import { snapshotCanvasNodes } from './hit-testing.mjs';

const STROKE_CAP = 4;
const POINT_CAP = 128;
const NODE_CAP = 32;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const number = value => finite(value) ? value : 0;
const round = value => {
  const result = Number(number(value).toFixed(8));
  return Object.is(result, -0) ? 0 : result;
};
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const SEQUENCE_FEATURE_NAMES = Object.freeze([
  'x', 'y', 'dt', 'dx', 'dy', 'pressure_or_zero', 'pressure_present',
]);

export const NODE_FEATURE_NAMES = Object.freeze([
  'is_start_hit', 'is_end_hit', 'is_contained', 'is_selected', 'is_container',
  'relative_x', 'relative_y', 'relative_width', 'relative_height', 'z_index',
  'distance_to_start', 'distance_to_end', 'type_code', 'relationship_count',
]);

export const CONTEXT_FEATURE_NAMES = Object.freeze([
  'start_hit_type_code', 'start_node_type_code', 'start_relative_x', 'start_relative_y',
  'end_hit_type_code', 'end_node_type_code', 'end_relative_x', 'end_relative_y',
  'contained_node_count', 'selected_overlap_count', 'same_container', 'total_node_count',
  'pointer_count', 'selected_node_count', 'nearby_node_count', 'graph_edge_count',
  'object_order_count', 'instruction_binding_count', 'reference_binding_count',
  'active_tool_code', 'canvas_mode_code', 'pointer_type_code', 'modifier_count', 'endpoint_hit_count',
]);

export const FEATURE_NAMES = Object.freeze({
  sequence: SEQUENCE_FEATURE_NAMES,
  geometry: GEOMETRY_FEATURE_NAMES,
  node: NODE_FEATURE_NAMES,
  context: CONTEXT_FEATURE_NAMES,
});

function code(value) {
  const text = typeof value === 'string' ? value : '';
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return text === '' ? 0 : round((hash >>> 0) / 0xffffffff);
}

function pointsOf(stroke) {
  return Array.isArray(stroke?.points) ? stroke.points.filter(point => finite(point?.x) && finite(point?.y)) : [];
}

function interpolate(first, second, proportion) {
  if (proportion <= 0) return { ...first };
  if (proportion >= 1) return { ...second };
  return {
    x: first.x + (second.x - first.x) * proportion,
    y: first.y + (second.y - first.y) * proportion,
    time_ms: number(first.time_ms) + (number(second.time_ms) - number(first.time_ms)) * proportion,
    pressure: finite(first.pressure) && finite(second.pressure)
      ? first.pressure + (second.pressure - first.pressure) * proportion
      : (finite(second.pressure) ? second.pressure : first.pressure),
  };
}

/** Arc-length resampling preserves every real stroke's trajectory in its fixed tensor slot. */
export function resampleStroke(points, count = POINT_CAP) {
  if (!Array.isArray(points) || points.length === 0 || count < 1) return [];
  if (points.length === 1) return Array.from({ length: count }, () => ({ ...points[0] }));
  const lengths = [0];
  for (let index = 1; index < points.length; index++) {
    lengths.push(lengths[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y));
  }
  const total = lengths.at(-1);
  if (total === 0) return Array.from({ length: count }, () => ({ ...points[0] }));
  let segment = 1;
  return Array.from({ length: count }, (_, index) => {
    const target = total * index / Math.max(1, count - 1);
    while (segment < lengths.length - 1 && lengths[segment] < target) segment++;
    const before = segment - 1;
    const span = lengths[segment] - lengths[before];
    return span === 0 ? { ...points[segment] } : interpolate(points[before], points[segment], (target - lengths[before]) / span);
  });
}

function sequenceTensor(strokes) {
  const sequence = Array.from({ length: STROKE_CAP }, () => Array.from({ length: POINT_CAP }, () => Array(7).fill(0)));
  const sequence_mask = Array.from({ length: STROKE_CAP }, () => Array(POINT_CAP).fill(0));
  const stroke_mask = Array(STROKE_CAP).fill(0);
  for (let strokeIndex = 0; strokeIndex < STROKE_CAP; strokeIndex++) {
    const points = pointsOf(strokes[strokeIndex]);
    if (points.length === 0) continue;
    const samples = resampleStroke(points);
    stroke_mask[strokeIndex] = 1;
    samples.forEach((point, pointIndex) => {
      const previous = samples[pointIndex - 1] ?? point;
      const pressurePresent = finite(point.pressure) ? 1 : 0;
      sequence[strokeIndex][pointIndex] = [
        round(point.x), round(point.y), round(Math.max(0, number(point.time_ms) - number(previous.time_ms))),
        round(point.x - previous.x), round(point.y - previous.y),
        pressurePresent ? round(clamp(point.pressure, 0, 1)) : 0, pressurePresent,
      ];
      sequence_mask[strokeIndex][pointIndex] = 1;
    });
  }
  return { sequence, sequence_mask, stroke_mask };
}

function contains(bounds, point) {
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

function nodeTensor(nodes, geometry, canvasContext) {
  const tensor = Array.from({ length: NODE_CAP }, () => Array(NODE_FEATURE_NAMES.length).fill(0));
  const node_mask = Array(NODE_CAP).fill(0);
  const start = { x: number(geometry.start_x), y: number(geometry.start_y) };
  const end = { x: number(geometry.end_x), y: number(geometry.end_y) };
  const containedTypes = new Set(Array.isArray(canvasContext?.contained_node_types) ? canvasContext.contained_node_types : []);
  const snapshots = snapshotCanvasNodes(nodes)
    .sort((first, second) => first.bounds.y - second.bounds.y || first.bounds.x - second.bounds.x || second.z - first.z || first.type.localeCompare(second.type) || first.id.localeCompare(second.id))
    .slice(0, NODE_CAP);
  snapshots.forEach((node, index) => {
    const centerX = node.bounds.x + node.bounds.width / 2;
    const centerY = node.bounds.y + node.bounds.height / 2;
    const nearby = (canvasContext?.nearby_nodes || []).find(candidate => candidate?.node_type === node.type) ?? {};
    tensor[index] = [
      Number(contains(node.bounds, start)), Number(contains(node.bounds, end)), Number(containedTypes.has(node.type)), Number(node.selected), Number(node.is_container),
      round(centerX - start.x), round(centerY - start.y), round(node.bounds.width), round(node.bounds.height), round(node.z),
      round(Math.hypot(centerX - start.x, centerY - start.y)), round(Math.hypot(centerX - end.x, centerY - end.y)), code(node.type),
      number(nearby.incoming_edge_count) + number(nearby.outgoing_edge_count),
    ];
    node_mask[index] = 1;
  });
  return { nodes: tensor, node_mask };
}

function hitFeatures(hit = {}) {
  return [code(hit.hit_type), code(hit.node_type), round(hit.relative_x), round(hit.relative_y)];
}

function contextTensor(canvasContext, nodeCount) {
  const context = canvasContext && typeof canvasContext === 'object' ? canvasContext : {};
  const start = context.start_hit ?? {};
  const end = context.end_hit ?? {};
  const modifiers = context.modifiers && typeof context.modifiers === 'object' ? context.modifiers : {};
  const endpointHitCount = Number(start.hit_type && start.hit_type !== 'empty') + Number(end.hit_type && end.hit_type !== 'empty');
  return [
    ...hitFeatures(start), ...hitFeatures(end), number(context.contained_node_count), number(context.selected_overlap_count), Number(context.same_container === true), nodeCount,
    number(context.pointer_count), number(context.selected_node_count), Array.isArray(context.nearby_nodes) ? context.nearby_nodes.length : 0, number(context.graph_edge_count),
    number(context.object_order_count), number(context.instruction_binding_count), number(context.reference_binding_count), code(context.active_tool), code(context.canvas_mode),
    code(context.pointer_type), Object.values(modifiers).filter(value => value === true).length, endpointHitCount,
  ].map(round);
}

/** Builds ID-free, fixed-shape tensors and explicit masks from pre-prediction runtime facts. */
export function buildModelInputs({ strokes = [], geometry = {}, canvasContext = {}, nodes = [] } = {}) {
  const sequence = sequenceTensor(strokes);
  const node = nodeTensor(nodes, geometry, canvasContext);
  return {
    ...sequence,
    geometry: GEOMETRY_FEATURE_NAMES.map(name => round(geometry[name] === true ? 1 : geometry[name] === false ? 0 : geometry[name])),
    ...node,
    context: contextTensor(canvasContext, node.node_mask.reduce((sum, present) => sum + present, 0)),
    shapes: { sequence: [4, 128, 7], geometry: [48], nodes: [32, 14], context: [24] },
  };
}
