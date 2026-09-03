import { SCHEMA_VERSIONS } from './contracts.mjs';
import { assertProductionFeatureKeys } from './schema.mjs';
import { pointToBoundsDistance, snapshotCanvasNodes } from './hit-testing.mjs';

const MAX_NEARBY_NODES = 32;
const MODIFIER_KEYS = ['alt', 'ctrl', 'meta', 'shift'];

const finite = value => typeof value === 'number' && Number.isFinite(value);
const nonNegativeInteger = value => Number.isInteger(value) && value >= 0 ? value : 0;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = value => {
  const result = Number((finite(value) ? value : 0).toFixed(8));
  return Object.is(result, -0) ? 0 : result;
};
const stringOr = (value, fallback) => typeof value === 'string' && value.trim() !== '' ? value : fallback;
const listCount = (value, fallback = 0) => Array.isArray(value) ? value.length : nonNegativeInteger(value ?? fallback);

function gestureFromState(appState) {
  return appState.raw_gesture ?? appState.rawGesture ?? appState.gesture ?? null;
}

function geometryFromState(appState, hits) {
  const geometry = appState.geometry ?? appState.derived_geometry ?? appState.derivedGeometry;
  if (geometry && finite(geometry.start_x) && finite(geometry.end_x)) return geometry;
  const fallback = hits?.binding?.geometry;
  return fallback && finite(fallback.start_x) && finite(fallback.end_x) ? fallback : {
    start_x: 0, start_y: 0, end_x: 0, end_y: 0,
  };
}

function safeHit(value) {
  return {
    hit_type: stringOr(value?.hit_type, 'empty'),
    node_type: typeof value?.node_type === 'string' && value.node_type.trim() !== '' ? value.node_type : null,
    relative_x: finite(value?.relative_x) ? round(value.relative_x) : null,
    relative_y: finite(value?.relative_y) ? round(value.relative_y) : null,
  };
}

function countEdges(edges, nodeId, direction) {
  if (!Array.isArray(edges)) return 0;
  return edges.reduce((count, edge) => count + Number(String(edge?.[direction] ?? '') === nodeId), 0);
}

function containingId(node) {
  return node?.is_container ? node.id : node?.parent_id ?? null;
}

function hitContainerId(bindingHit, byId) {
  if (!bindingHit || typeof bindingHit.node_id !== 'string') return null;
  return containingId(byId.get(bindingHit.node_id));
}

function proximity(node, start, end) {
  return Math.min(pointToBoundsDistance(start, node.bounds), pointToBoundsDistance(end, node.bounds));
}

function stableNearbyNodes(appState, hits, geometry) {
  const snapshots = snapshotCanvasNodes(appState.nodes ?? appState.canvas_nodes ?? []);
  const candidates = snapshots.filter(node => !node.is_container);
  const edges = appState.edges ?? appState.graph_edges ?? [];
  const start = { x: geometry.start_x, y: geometry.start_y };
  const end = { x: geometry.end_x, y: geometry.end_y };
  const byId = new Map(snapshots.map(node => [node.id, node]));
  const binding = hits?.binding ?? hits ?? {};
  const referenceContainer = hitContainerId(binding.start, byId) ?? hitContainerId(binding.end, byId);

  return candidates
    .map(node => ({ node, proximity: proximity(node, start, end) }))
    .sort((first, second) => first.proximity - second.proximity
      || second.node.z - first.node.z
      || first.node.id.localeCompare(second.node.id))
    .slice(0, MAX_NEARBY_NODES)
    .map(({ node }) => ({
      node_type: node.type,
      relative_x: round(node.bounds.x + node.bounds.width / 2 - start.x),
      relative_y: round(node.bounds.y + node.bounds.height / 2 - start.y),
      width: round(clamp(node.bounds.width, 0, 1)),
      height: round(clamp(node.bounds.height, 0, 1)),
      selected: node.selected,
      same_container: containingId(node) === referenceContainer,
      incoming_edge_count: countEdges(edges, node.id, 'target'),
      outgoing_edge_count: countEdges(edges, node.id, 'source'),
    }));
}

function modifiersFrom(appState, gesture) {
  const source = appState.modifiers ?? gesture?.modifiers ?? {};
  return Object.fromEntries(MODIFIER_KEYS.map(key => [key, source[key] === true]));
}

export function projectRuntimeContext(appState = {}, hits = {}) {
  if (!appState || typeof appState !== 'object' || Array.isArray(appState)) throw new TypeError('App state must be a plain object');
  const rawGesture = gestureFromState(appState);
  const strokes = Array.isArray(rawGesture?.strokes) ? rawGesture.strokes : [];
  const snapshots = snapshotCanvasNodes(appState.nodes ?? appState.canvas_nodes ?? []);
  const selected = snapshots.filter(node => node.selected && !node.is_container).sort((first, second) => first.id.localeCompare(second.id));
  const directSelectedTypes = Array.isArray(appState.selected_node_types)
    ? appState.selected_node_types.filter(type => typeof type === 'string' && type.trim() !== '').slice(0, MAX_NEARBY_NODES)
    : [];
  const geometry = geometryFromState(appState, hits);
  const modelHits = hits?.model_view ?? hits?.modelView ?? {};
  const pointerIds = new Set(strokes.map(stroke => stroke?.pointer_id).filter(value => value !== undefined));
  const pointerType = appState.pointer_type ?? appState.pointerType ?? strokes[0]?.pointer_type;
  const edges = appState.edges ?? appState.graph_edges;
  const objectOrder = appState.object_order ?? appState.objectOrder;

  const context = {
    schema_version: SCHEMA_VERSIONS.runtimeContext,
    active_tool: stringOr(appState.active_tool ?? appState.activeTool, 'unknown'),
    canvas_mode: stringOr(appState.canvas_mode ?? appState.canvasMode, 'unknown'),
    pointer_type: ['mouse', 'touch', 'stylus'].includes(pointerType) ? pointerType : 'mouse',
    pointer_count: clamp(nonNegativeInteger(appState.pointer_count ?? appState.pointerCount) || pointerIds.size || 1, 1, 10),
    modifiers: modifiersFrom(appState, rawGesture),
    selected_node_count: snapshots.length > 0 ? selected.length : nonNegativeInteger(appState.selected_node_count),
    selected_node_types: snapshots.length > 0 ? selected.slice(0, MAX_NEARBY_NODES).map(node => node.type) : directSelectedTypes,
    nearby_nodes: stableNearbyNodes(appState, hits, geometry),
    start_hit: safeHit(modelHits.start ?? modelHits.start_hit),
    end_hit: safeHit(modelHits.end ?? modelHits.end_hit),
    instruction_binding_count: listCount(appState.instruction_bindings ?? appState.instructionBindings, appState.instruction_binding_count),
    reference_binding_count: listCount(appState.reference_bindings ?? appState.referenceBindings, appState.reference_binding_count),
    graph_edge_count: Array.isArray(edges) ? edges.length : nonNegativeInteger(appState.graph_edge_count),
    object_order_count: listCount(objectOrder, appState.object_order_count),
  };

  assertProductionFeatureKeys(context);
  return context;
}
