import { getFullPrecisionGeometry } from './geometry.mjs';

const EPSILON = 1e-12;
const DEFAULT_EDGE_HIT_RADIUS = 0.015;

const finite = value => typeof value === 'number' && Number.isFinite(value);
const numberOr = (value, fallback = 0) => finite(value) ? value : fallback;
const round = value => {
  if (!finite(value)) return null;
  const result = Number(value.toFixed(8));
  return Object.is(result, -0) ? 0 : result;
};
const stableId = value => typeof value === 'string' ? value : String(value ?? '');
const nodeType = node => {
  const value = node?.node_type ?? node?.type;
  return typeof value === 'string' && value.trim() !== '' ? value : 'unknown';
};
const nodeZ = node => numberOr(node?.z_index ?? node?.zIndex ?? node?.style?.zIndex, 0);
const parentId = node => node?.parent_id ?? node?.parentId ?? null;
const isContainerNode = node => node?.is_container === true
  || node?.isContainer === true
  || node?.container === true
  || ['group', 'container'].includes(nodeType(node));

function rawBounds(node) {
  const direct = node?.bounds ?? node?.rect ?? node?.computedBounds;
  if (direct && typeof direct === 'object') {
    return {
      x: numberOr(direct.x ?? direct.left),
      y: numberOr(direct.y ?? direct.top),
      width: Math.max(0, numberOr(direct.width, numberOr(direct.right) - numberOr(direct.left))),
      height: Math.max(0, numberOr(direct.height, numberOr(direct.bottom) - numberOr(direct.top))),
    };
  }
  const position = node?.positionAbsolute ?? node?.computedPosition ?? node?.position ?? {};
  const dimensions = node?.measured ?? node?.dimensions ?? {};
  return {
    x: numberOr(position.x ?? node?.x),
    y: numberOr(position.y ?? node?.y),
    width: Math.max(0, numberOr(node?.width ?? dimensions.width ?? node?.style?.width)),
    height: Math.max(0, numberOr(node?.height ?? dimensions.height ?? node?.style?.height)),
  };
}

function resolveBounds(node, byId, visiting = new Set()) {
  const bounds = rawBounds(node);
  if (node?.bounds || node?.rect || node?.computedBounds || node?.positionAbsolute || node?.computedPosition) return bounds;
  const parent = byId.get(stableId(parentId(node)));
  const id = stableId(node?.id);
  if (!parent || visiting.has(id)) return bounds;
  visiting.add(id);
  const parentBounds = resolveBounds(parent, byId, visiting);
  return { ...bounds, x: bounds.x + parentBounds.x, y: bounds.y + parentBounds.y };
}

export function snapshotCanvasNodes(nodes = []) {
  const safeNodes = Array.isArray(nodes) ? nodes.filter(node => node && stableId(node.id) !== '') : [];
  const byId = new Map(safeNodes.map(node => [stableId(node.id), node]));
  return safeNodes.map(node => ({
    source: node,
    id: stableId(node.id),
    type: nodeType(node),
    selected: node.selected === true,
    z: nodeZ(node),
    parent_id: parentId(node) === null ? null : stableId(parentId(node)),
    is_container: isContainerNode(node),
    bounds: resolveBounds(node, byId),
  }));
}

export function pointToBoundsDistance(point, bounds) {
  const dx = Math.max(bounds.x - point.x, 0, point.x - (bounds.x + bounds.width));
  const dy = Math.max(bounds.y - point.y, 0, point.y - (bounds.y + bounds.height));
  return Math.hypot(dx, dy);
}

function containsPoint(bounds, point) {
  return point.x >= bounds.x - EPSILON && point.x <= bounds.x + bounds.width + EPSILON
    && point.y >= bounds.y - EPSILON && point.y <= bounds.y + bounds.height + EPSILON;
}

function relativePoint(point, bounds) {
  return {
    relative_x: bounds.width > EPSILON ? round((point.x - bounds.x) / bounds.width) : 0,
    relative_y: bounds.height > EPSILON ? round((point.y - bounds.y) / bounds.height) : 0,
  };
}

function compareNodes(first, second) {
  return Number(second.selected) - Number(first.selected)
    || second.z - first.z
    || first.id.localeCompare(second.id);
}

function flattenHandles(node) {
  if (Array.isArray(node.source?.handles)) return node.source.handles;
  const handleBounds = node.source?.handleBounds ?? node.source?.handle_bounds;
  if (!handleBounds || typeof handleBounds !== 'object') return [];
  return ['source', 'target'].flatMap(type => (
    Array.isArray(handleBounds[type]) ? handleBounds[type].map(handle => ({ ...handle, type: handle.type ?? type })) : []
  ));
}

function handleBox(node, handle) {
  const box = handle?.bounds ?? handle;
  const width = Math.max(0, numberOr(box?.width, 0));
  const height = Math.max(0, numberOr(box?.height, 0));
  const absoluteX = box?.absolute_x ?? box?.absoluteX;
  const absoluteY = box?.absolute_y ?? box?.absoluteY;
  const isAbsolute = finite(absoluteX) || finite(absoluteY) || box?.absolute === true;
  return {
    x: isAbsolute ? numberOr(absoluteX ?? box?.x) : node.bounds.x + numberOr(box?.x),
    y: isAbsolute ? numberOr(absoluteY ?? box?.y) : node.bounds.y + numberOr(box?.y),
    width,
    height,
  };
}

function emptyBindingHit() {
  return {
    hit_type: 'empty', node_id: null, edge_id: null, handle_id: null,
    handle_type: null, node_type: null, relative_x: null, relative_y: null,
  };
}

function modelHit(bindingHit) {
  return {
    hit_type: bindingHit.hit_type,
    node_type: bindingHit.node_type,
    relative_x: bindingHit.relative_x,
    relative_y: bindingHit.relative_y,
  };
}

function nodeBindingHit(point, node, hitType = 'node') {
  return {
    hit_type: hitType,
    node_id: node.id,
    edge_id: null,
    handle_id: null,
    handle_type: null,
    node_type: node.type,
    ...relativePoint(point, node.bounds),
  };
}

function hitHandle(point, nodeSnapshots) {
  const candidates = [];
  for (const node of nodeSnapshots) {
    for (const handle of flattenHandles(node)) {
      const bounds = handleBox(node, handle);
      if (containsPoint(bounds, point)) candidates.push({ node, handle, bounds });
    }
  }
  candidates.sort((first, second) => compareNodes(first.node, second.node)
    || stableId(first.handle?.id).localeCompare(stableId(second.handle?.id)));
  if (candidates.length === 0) return null;
  const { node, handle } = candidates[0];
  return {
    ...nodeBindingHit(point, node, 'handle'),
    handle_id: stableId(handle?.id) || null,
    handle_type: typeof handle?.type === 'string' ? handle.type : null,
  };
}

function hitNode(point, nodeSnapshots, { containers }) {
  const candidates = nodeSnapshots
    .filter(node => node.is_container === containers && containsPoint(node.bounds, point))
    .sort(compareNodes);
  return candidates.length === 0 ? null : nodeBindingHit(point, candidates[0], containers ? 'container' : 'node');
}

function center(node) {
  return { x: node.bounds.x + node.bounds.width / 2, y: node.bounds.y + node.bounds.height / 2 };
}

function edgePoints(edge, byId) {
  const explicit = edge?.points ?? edge?.path_points ?? edge?.pathPoints;
  if (Array.isArray(explicit) && explicit.length >= 2) {
    return explicit.filter(point => finite(point?.x) && finite(point?.y)).map(point => ({ x: point.x, y: point.y }));
  }
  const sourcePoint = edge?.source_point ?? edge?.sourcePoint;
  const targetPoint = edge?.target_point ?? edge?.targetPoint;
  if (sourcePoint && targetPoint && finite(sourcePoint.x) && finite(sourcePoint.y) && finite(targetPoint.x) && finite(targetPoint.y)) {
    return [sourcePoint, targetPoint];
  }
  const source = byId.get(stableId(edge?.source));
  const target = byId.get(stableId(edge?.target));
  return source && target ? [center(source), center(target)] : [];
}

function pointToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared <= EPSILON ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  const nearest = { x: a.x + t * dx, y: a.y + t * dy };
  const segmentLength = Math.sqrt(lengthSquared);
  const signedDistance = segmentLength <= EPSILON ? 0 : ((point.x - a.x) * dy - (point.y - a.y) * dx) / segmentLength;
  return { distance: Math.hypot(point.x - nearest.x, point.y - nearest.y), signedDistance, t, segmentLength };
}

function hitEdge(point, edges, nodeSnapshots, radius) {
  const byId = new Map(nodeSnapshots.map(node => [node.id, node]));
  const candidates = [];
  for (const edge of Array.isArray(edges) ? edges : []) {
    const points = edgePoints(edge, byId);
    if (points.length < 2) continue;
    const totalLength = points.slice(1).reduce((sum, endpoint, index) => sum + Math.hypot(endpoint.x - points[index].x, endpoint.y - points[index].y), 0);
    let traversed = 0;
    for (let index = 1; index < points.length; index++) {
      const candidate = pointToSegment(point, points[index - 1], points[index]);
      const relative = totalLength <= EPSILON ? 0 : (traversed + candidate.t * candidate.segmentLength) / totalLength;
      candidates.push({ edge, ...candidate, relative });
      traversed += candidate.segmentLength;
    }
  }
  candidates.sort((first, second) => first.distance - second.distance
    || numberOr(second.edge?.z_index ?? second.edge?.zIndex) - numberOr(first.edge?.z_index ?? first.edge?.zIndex)
    || stableId(first.edge?.id).localeCompare(stableId(second.edge?.id)));
  const winner = candidates[0];
  if (!winner || winner.distance > radius + EPSILON) return null;
  return {
    hit_type: 'edge', node_id: null, edge_id: stableId(winner.edge?.id) || null,
    handle_id: null, handle_type: null, node_type: null,
    relative_x: round(winner.relative), relative_y: round(winner.signedDistance),
  };
}

function hitPoint(point, nodes, edges, radius) {
  return hitHandle(point, nodes)
    ?? hitNode(point, nodes, { containers: false })
    ?? hitEdge(point, edges, nodes, radius)
    ?? hitNode(point, nodes, { containers: true })
    ?? emptyBindingHit();
}

function pointInPolygon(point, polygon) {
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) <= EPSILON
      && point.x >= Math.min(a.x, b.x) - EPSILON && point.x <= Math.max(a.x, b.x) + EPSILON
      && point.y >= Math.min(a.y, b.y) - EPSILON && point.y <= Math.max(a.y, b.y) + EPSILON) return true;
  }
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current];
    const b = polygon[previous];
    const crosses = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function containedNodes(geometry, nodes) {
  if (geometry.closed !== true) return [];
  const internal = getFullPrecisionGeometry(geometry);
  const polygon = internal?.strokes?.flat() ?? [];
  if (polygon.length < 4) return [];
  return nodes.filter(node => !node.is_container && [
    { x: node.bounds.x, y: node.bounds.y },
    { x: node.bounds.x + node.bounds.width, y: node.bounds.y },
    { x: node.bounds.x + node.bounds.width, y: node.bounds.y + node.bounds.height },
    { x: node.bounds.x, y: node.bounds.y + node.bounds.height },
  ].every(corner => pointInPolygon(corner, polygon))).sort(compareNodes);
}

function bindingContainer(hit, byId) {
  const node = byId.get(hit.node_id);
  if (!node) return null;
  return node.is_container ? node.id : node.parent_id;
}

export function hitTestGesture(geometry, nodes = [], edges = [], options = {}) {
  if (!geometry || !finite(geometry.start_x) || !finite(geometry.start_y) || !finite(geometry.end_x) || !finite(geometry.end_y)) {
    throw new TypeError('Geometry must contain finite start and end coordinates');
  }
  const snapshots = snapshotCanvasNodes(nodes);
  const edgeRadius = Math.max(0, numberOr(options.edge_hit_radius ?? options.edgeHitRadius, DEFAULT_EDGE_HIT_RADIUS));
  const start = hitPoint({ x: geometry.start_x, y: geometry.start_y }, snapshots, edges, edgeRadius);
  const end = hitPoint({ x: geometry.end_x, y: geometry.end_y }, snapshots, edges, edgeRadius);
  const contained = containedNodes(geometry, snapshots);
  const byId = new Map(snapshots.map(node => [node.id, node]));
  const startContainer = bindingContainer(start, byId);
  const endContainer = bindingContainer(end, byId);
  const binding = {
    start,
    end,
    contained_node_ids: contained.map(node => node.id),
  };
  const model_view = {
    start: modelHit(start),
    end: modelHit(end),
    contained_node_count: contained.length,
    contained_node_types: contained.map(node => node.type),
    selected_overlap_count: contained.filter(node => node.selected).length,
    same_container: startContainer !== null && startContainer === endContainer,
  };
  const result = { binding, model_view };
  Object.defineProperties(result, {
    start: { enumerable: false, get: () => binding.start },
    end: { enumerable: false, get: () => binding.end },
  });
  return result;
}
