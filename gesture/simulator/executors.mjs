import { SCHEMA_VERSIONS } from '../shared/contracts.mjs';
import { FAMILY_BY_INTENT, INTENTS } from '../shared/taxonomy.mjs';
import { validateRawGesture } from '../shared/schema.mjs';
import { feasibleInsertPairs, feasibleIntents } from './feasibility.mjs';
import { motorStroke } from './motor.mjs';
import { createPrng } from './prng.mjs';

const clamp = value => Number.isFinite(value) ? Math.max(0.03, Math.min(0.97, value)) : 0.5;
const point = (x, y) => ({ x: clamp(x), y: clamp(y) });
const hash = value => Array.from(String(value ?? 0)).reduce((total, char) => ((total * 33) ^ char.codePointAt(0)) >>> 0, 5381).toString(36);
const modifiersFor = world => ({ alt: Boolean(world?.runtime_context?.modifiers?.alt), ctrl: Boolean(world?.runtime_context?.modifiers?.ctrl), meta: Boolean(world?.runtime_context?.modifiers?.meta), shift: Boolean(world?.runtime_context?.modifiers?.shift) });
const authorityFor = world => world?.simulation?.authority ?? {};
const list = value => Array.isArray(value) ? value : [];

function nodeCenter(node, fallback = point(0.5, 0.5)) {
  const x = Number(node?.position?.x); const y = Number(node?.position?.y);
  const width = Number(node?.width); const height = Number(node?.height);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height)
    ? point(x + width / 2, y + height / 2) : fallback;
}

function nodeBounds(node, padding = 0) {
  const center = nodeCenter(node); const width = Number.isFinite(Number(node?.width)) ? Math.max(0.04, Number(node.width)) : 0.18;
  const height = Number.isFinite(Number(node?.height)) ? Math.max(0.04, Number(node.height)) : 0.14;
  return { left: clamp(center.x - width / 2 - padding), right: clamp(center.x + width / 2 + padding), top: clamp(center.y - height / 2 - padding), bottom: clamp(center.y + height / 2 + padding) };
}

function midpoint(first, second) { return point((first.x + second.x) / 2, (first.y + second.y) / 2); }
function offset(center, x, y) { return point(center.x + x, center.y + y); }
function nodesFor(world) { return list(authorityFor(world).nodes).filter(node => typeof node?.id === 'string' && node.id !== ''); }
function nodeById(world) { return new Map(nodesFor(world).map(node => [node.id, node])); }
function selectedNodes(world) { return nodesFor(world).filter(node => node.selected === true); }
function firstValidNode(world, predicate, fallback) { return nodesFor(world).find(predicate) ?? fallback; }
function centerForId(world, id, fallback) { return nodeCenter(nodeById(world).get(id), fallback); }

function referencedPair(world, goal, fallback = []) {
  const byId = nodeById(world); const candidate = goal?.references?.pair;
  if (Array.isArray(candidate) && candidate.length === 2 && candidate.every(id => byId.has(id)) && candidate[0] !== candidate[1]) return candidate;
  return fallback;
}

function semanticTargets(world, goal) {
  const nodes = nodesFor(world); const selected = selectedNodes(world); const byId = nodeById(world);
  const first = selected[0] ?? nodes[0]; const second = selected[1] ?? nodes[1] ?? nodes[0];
  const instruction = list(authorityFor(world).instruction_bindings).find(binding => byId.has(binding?.source) && byId.has(binding?.target));
  const reference = list(authorityFor(world).reference_bindings).find(binding => byId.has(binding?.source) && byId.has(binding?.target));
  const edges = list(authorityFor(world).edges).find(edge => byId.has(edge?.source) && byId.has(edge?.target));
  const resizeHandle = list(authorityFor(world).handles).find(handle => handle?.type === 'resize' && handle?.node_id === first?.id);
  const order = list(authorityFor(world).object_order).filter(id => byId.has(id));
  const pair = referencedPair(world, goal, list(authorityFor(world).ordered_neighbors).find(candidate => Array.isArray(candidate) && candidate.length === 2) ?? []);
  return {
    nodes, selected, first, second,
    start: nodeCenter(first, point(0.2, 0.3)), end: nodeCenter(second, point(0.77, 0.67)),
    instruction: instruction ? [centerForId(world, instruction.source, point(0.2, 0.3)), centerForId(world, instruction.target, point(0.5, 0.5))] : null,
    reference: reference ? [centerForId(world, reference.source, point(0.5, 0.5)), centerForId(world, reference.target, point(0.77, 0.67))] : null,
    edge: edges ? [centerForId(world, edges.source, point(0.2, 0.3)), centerForId(world, edges.target, point(0.5, 0.5))] : null,
    resizeHandle,
    orderCenters: order.map(id => centerForId(world, id, point(0.5, 0.5))), pairCenters: pair.map(id => centerForId(world, id, point(0.5, 0.5))),
  };
}

function rectangle(bounds) {
  return [point(bounds.left, bounds.top), point(bounds.right, bounds.top), point(bounds.right, bounds.bottom), point(bounds.left, bounds.bottom), point(bounds.left, bounds.top)];
}

function unionBounds(nodes, padding = 0) {
  const bounds = nodes.map(node => nodeBounds(node, padding));
  if (bounds.length === 0) return { left: 0.3, right: 0.7, top: 0.3, bottom: 0.6 };
  return { left: Math.min(...bounds.map(value => value.left)), right: Math.max(...bounds.map(value => value.right)), top: Math.min(...bounds.map(value => value.top)), bottom: Math.max(...bounds.map(value => value.bottom)) };
}

function lassoBounds(bounds) {
  const cx = (bounds.left + bounds.right) / 2; const cy = (bounds.top + bounds.bottom) / 2;
  const rx = Math.max(0.11, (bounds.right - bounds.left) / 2); const ry = Math.max(0.09, (bounds.bottom - bounds.top) / 2);
  return Array.from({ length: 9 }, (_, index) => { const angle = -Math.PI / 2 + index * Math.PI / 4; return point(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry); });
}

function arrowhead(start, end, size = 0.075) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  return [point(end.x - Math.cos(angle - 0.62) * size, end.y - Math.sin(angle - 0.62) * size), end, point(end.x - Math.cos(angle + 0.62) * size, end.y - Math.sin(angle + 0.62) * size)];
}

function correctedLine(start, end, persona) {
  const dx = end.x - start.x; const dy = end.y - start.y; const length = Math.max(Math.hypot(dx, dy), 0.001);
  const overshoot = Math.max(0, Number(persona.overshoot) || 0); const correction = Math.max(0, Number(persona.correction) || 0);
  if (overshoot < 0.02 && correction < 0.02) return [start, end];
  const amount = Math.min(0.075, (overshoot + correction) * 0.25);
  return [start, point(end.x + dx / length * amount, end.y + dy / length * amount), end];
}

function lineWithArrow(start, end, persona, waypoint = null) {
  return [{ anchors: waypoint ? [start, waypoint, end] : correctedLine(start, end, persona) }, { anchors: arrowhead(start, end) }];
}

function pathsFor(intent, context, persona) {
  const { start, end, first, second, selected, instruction, reference, edge, resizeHandle, orderCenters, pairCenters } = context;
  const targetBounds = nodeBounds(first, 0.025); const selectedBounds = unionBounds(selected.length ? selected : [first], 0.035);
  const instructionPath = instruction ?? [start, end]; const referencePath = reference ?? [start, end]; const edgePath = edge ?? [start, end];
  switch (intent) {
    case 'select_region': return [{ anchors: rectangle(selectedBounds), closed: true }];
    case 'lasso_select': return [{ anchors: lassoBounds(unionBounds(selected.length ? selected : [first], 0.05)), closed: true }];
    case 'crop_region': {
      const cropNode = firstValidNode({ simulation: { authority: { nodes: context.nodes } } }, node => node?.type === 'asset' && ['image', 'video', 'document'].includes(node?.data?.kind), first);
      return [{ anchors: rectangle(nodeBounds(cropNode, 0.012)), closed: true }];
    }
    case 'apply_instruction': return lineWithArrow(instructionPath[0], instructionPath[1], persona, offset(midpoint(instructionPath[0], instructionPath[1]), 0, -0.06));
    case 'connect': return lineWithArrow(start, end, persona);
    case 'point_to': return [{ anchors: [...correctedLine(start, end, persona), offset(end, -0.025, 0.02)] }];
    case 'replace': return lineWithArrow(referencePath[0], referencePath[1], persona, offset(midpoint(referencePath[0], referencePath[1]), 0.035, 0));
    case 'insert_between': { const left = pairCenters[0] ?? start; const right = pairCenters[1] ?? end; const gap = midpoint(left, right); return [{ anchors: correctedLine(left, gap, persona) }, { anchors: arrowhead(gap, right, 0.06) }]; }
    case 'sequence': { const firstOrder = orderCenters[0] ?? start; const lastOrder = orderCenters.at(-1) ?? end; return lineWithArrow(firstOrder, lastOrder, persona, offset(midpoint(firstOrder, lastOrder), 0, 0.07)); }
    case 'flow_direction': return lineWithArrow(edgePath[0], edgePath[1], persona, offset(midpoint(edgePath[0], edgePath[1]), -0.055, 0));
    case 'move': return [{ anchors: correctedLine(nodeCenter(first), offset(nodeCenter(first), 0.16, 0.09), persona) }];
    case 'resize': { const bounds = nodeBounds(first); const handlePosition = resizeHandle?.position; const handle = Number.isFinite(Number(handlePosition?.x)) && Number.isFinite(Number(handlePosition?.y)) ? point(handlePosition.x, handlePosition.y) : point(bounds.right, bounds.bottom); const expanded = point(handle.x + 0.09, handle.y + 0.07); return [{ anchors: [handle, offset(midpoint(handle, expanded), 0.018, -0.012), expanded] }]; }
    case 'reorder': { const source = orderCenters[0] ?? start; const neighbor = orderCenters[1] ?? end; return [{ anchors: [source, offset(midpoint(source, neighbor), 0, -0.065), neighbor] }]; }
    case 'align': { const items = (selected.length ? selected : [first, second]).slice(0, 4); const axis = items.reduce((sum, node) => sum + nodeCenter(node).x, 0) / items.length; return items.map(node => { const origin = nodeCenter(node); return { anchors: [origin, point(axis, origin.y)] }; }); }
    case 'distribute': { const items = (selected.length ? selected : [first, second]).slice(0, 4); const min = Math.min(...items.map(node => nodeCenter(node).x)); const max = Math.max(...items.map(node => nodeCenter(node).x)); return items.map((node, index) => { const origin = nodeCenter(node); return { anchors: [origin, point(items.length === 1 ? origin.x : min + (max - min) * index / (items.length - 1), origin.y)] }; }); }
    case 'duplicate': { const origin = nodeCenter(first); const destination = offset(origin, 0.13, -0.1); return [{ anchors: correctedLine(origin, destination, persona) }, { anchors: [destination, offset(destination, 0.025, 0.018)] }]; }
    case 'rotate': { const center = nodeCenter(first); const radius = Math.max(0.1, Math.min(0.18, Number(first?.width) || 0.14)); return [{ anchors: Array.from({ length: 6 }, (_, index) => { const angle = -0.8 + index * 0.38; return offset(center, Math.cos(angle) * radius, Math.sin(angle) * radius); }) }]; }
    case 'zoom': { const center = point(0.5, 0.5); return [{ anchors: [point(0.33, 0.32), center] }, { anchors: [point(0.67, 0.68), center] }]; }
    case 'pan': return [{ anchors: [point(0.5, 0.5), point(0.71, 0.58), point(0.84, 0.64)] }];
    case 'emphasize': return [{ anchors: [point(targetBounds.left, targetBounds.bottom + 0.035), point((targetBounds.left + targetBounds.right) / 2, targetBounds.bottom + 0.055), point(targetBounds.right, targetBounds.bottom + 0.035)] }];
    case 'remove': return [{ anchors: [point(targetBounds.left, targetBounds.top), point(targetBounds.right, targetBounds.bottom)] }, { anchors: [point(targetBounds.left, targetBounds.bottom), point(targetBounds.right, targetBounds.top)] }];
    case 'approve': { const y = (targetBounds.top + targetBounds.bottom) / 2; return [{ anchors: [point(targetBounds.left, y), point(targetBounds.left + 0.04, targetBounds.bottom), point(targetBounds.right, targetBounds.top)] }]; }
    case 'reject': { const wide = { left: clamp(targetBounds.left - 0.045), right: clamp(targetBounds.right + 0.045), top: clamp(targetBounds.top - 0.045), bottom: clamp(targetBounds.bottom + 0.045) }; return [{ anchors: [point(wide.left, wide.top), point(wide.right, wide.bottom)] }, { anchors: [point(wide.left, wide.bottom), point(wide.right, wide.top)] }]; }
    case 'annotate': { const note = firstValidNode({ simulation: { authority: { nodes: context.nodes } } }, node => node?.type === 'text' && node !== first, second); const noteCenter = nodeCenter(note, offset(nodeCenter(first), 0.22, -0.14)); return [{ anchors: [nodeCenter(first), offset(midpoint(nodeCenter(first), noteCenter), 0, -0.045), noteCenter] }]; }
    case 'rough_layout': { const secondBounds = nodeBounds(second, 0.018); return [{ anchors: rectangle(targetBounds), closed: true }, { anchors: [point(targetBounds.right, (targetBounds.top + targetBounds.bottom) / 2), point(secondBounds.left, (secondBounds.top + secondBounds.bottom) / 2)] }, { anchors: rectangle(secondBounds), closed: true }]; }
    case 'draw_layout': { const frame = { left: 0.18, right: 0.82, top: 0.2, bottom: 0.72 }; return [{ anchors: [point(frame.left, frame.top), point(frame.right, frame.top), point(frame.right, frame.bottom)] }, { anchors: [point(frame.left, frame.bottom), point(frame.left, frame.top), point(frame.right, frame.bottom)] }]; }
    case 'compare': { const left = nodeBounds(first, 0.03); const right = nodeBounds(second, 0.03); return [{ anchors: [point(left.right, left.top), point(left.left, (left.top + left.bottom) / 2), point(left.right, left.bottom)] }, { anchors: [point(right.left, right.top), point(right.right, (right.top + right.bottom) / 2), point(right.left, right.bottom)] }]; }
    case 'bracket_group': { const bounds = unionBounds(selected.length ? selected : [first, second], 0.04); return [{ anchors: [point(bounds.left, bounds.top), point(bounds.left - 0.035, bounds.top), point(bounds.left - 0.035, bounds.bottom), point(bounds.left, bounds.bottom)] }]; }
    case 'group': return [{ anchors: lassoBounds(unionBounds(selected.length ? selected : [first, second], 0.06)), closed: true }];
    default: throw new RangeError(`unsupported gesture intent: ${intent}`);
  }
}

/** Executes a feasible Task 6 goal into the exact Task 2 raw-gesture contract. */
export function executeGoal({ persona = {}, world = {}, goal, seed = 0 } = {}) {
  if (!goal || !INTENTS.includes(goal.intent)) throw new TypeError('executeGoal requires a known goal intent');
  const intent = goal.intent; const hasAuthority = Array.isArray(world?.simulation?.authority?.nodes); const expectedFamily = FAMILY_BY_INTENT[intent];
  if (goal.family !== undefined && goal.family !== expectedFamily) throw new TypeError(`goal family does not match intent ${intent}`);
  if (intent !== 'unknown' && hasAuthority && !feasibleIntents(world).includes(intent)) throw new RangeError(`goal ${intent} is not feasible in the supplied world`);
  if (intent === 'insert_between' && goal.references?.pair !== undefined && hasAuthority) {
    const pair = goal.references.pair; const valid = feasibleInsertPairs(world).some(candidate => candidate[0] === pair?.[0] && candidate[1] === pair?.[1]);
    if (!valid) throw new RangeError('insert_between requires an authoritative adjacent reference pair');
  }
  const prng = createPrng(`execute:${String(seed)}`); const pointerType = ['mouse', 'touch', 'stylus'].includes(persona.device) ? persona.device : 'mouse';
  const context = semanticTargets(world, goal); const requestedOutcome = goal.outcome ?? (goal.accepted === false ? 'cancelled' : 'complete'); const outcome = requestedOutcome === 'missed' ? 'miss' : requestedOutcome;
  if (!['complete', 'incomplete', 'miss', 'cancelled', 'release_failed', 'release_failure'].includes(outcome)) throw new RangeError(`unsupported gesture outcome: ${requestedOutcome}`);
  const cancelled = intent === 'unknown' || outcome === 'cancelled' || outcome === 'release_failed' || outcome === 'release_failure';
  const cancelledStart = cancelled ? point(context.start.x + (prng() - 0.5) * 0.18, context.start.y + (prng() - 0.5) * 0.16) : context.start;
  const descriptors = cancelled ? [{ anchors: [cancelledStart, context.end], cancelled: true }] : pathsFor(intent, context, persona);
  let nextTime = 0;
  const strokes = descriptors.slice(0, 4).map((descriptor, index) => { if (index > 0) nextTime += 18 + prng.int(35); const built = motorStroke({ ...descriptor, pointerType, pointerId: index + 1, startTime: nextTime, prng, persona, incomplete: outcome === 'incomplete', miss: outcome === 'miss' }); nextTime = built.nextTime; return built.stroke; });
  if (outcome === 'release_failure' && strokes[0]?.cancelled === true) {
    const stroke = strokes[0]; const last = stroke.points.at(-1); const x = point(last.x + 0.012, last.y + 0.008);
    stroke.points.push({ x: x.x, y: x.y, time_ms: last.time_ms + 12, pressure: last.pressure });
  }
  const rawGesture = { gesture_id: `synthetic-${hash(`${seed}:${intent}`)}`, schema_version: SCHEMA_VERSIONS.rawGesture, strokes, modifiers: modifiersFor(world) };
  const validation = validateRawGesture(rawGesture); if (!validation.ok) throw new TypeError(`simulator emitted invalid raw gesture: ${validation.error}`);
  return rawGesture;
}

export const executorFamilyFor = intent => FAMILY_BY_INTENT[intent] ?? null;
