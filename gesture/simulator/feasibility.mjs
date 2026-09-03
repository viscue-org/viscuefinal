import { INTENTS } from '../shared/taxonomy.mjs';

const list = value => Array.isArray(value) ? value : [];
const count = value => Number.isInteger(value) && value >= 0 ? value : 0;
const authorityFor = world => world?.simulation?.authority ?? {};
const contextFor = world => world?.runtime_context ?? {};
const nodesFor = world => list(authorityFor(world).nodes).filter(node => typeof node?.id === 'string' && node.id !== '');
const nodeCount = world => nodesFor(world).length;
const nodeById = world => new Map(nodesFor(world).map(node => [node.id, node]));
const bindingsPresent = (world, kind) => count(contextFor(world)[`${kind}_binding_count`]) > 0 && list(authorityFor(world)[`${kind}_bindings`]).length > 0;
const selectedNodes = world => nodesFor(world).filter(node => node.selected === true);
const selectedCount = world => Math.min(count(contextFor(world).selected_node_count), selectedNodes(world).length);
const hasResizeHandle = world => {
  const selectedIds = new Set(selectedNodes(world).map(node => node.id));
  return list(authorityFor(world).handles).some(handle => handle?.type === 'resize' && selectedIds.has(handle.node_id));
};
const validObjectOrder = world => {
  const order = list(authorityFor(world).object_order);
  const nodes = nodeById(world);
  return order.length >= 2 && new Set(order).size === order.length && order.every(id => nodes.has(id)) && count(contextFor(world).object_order_count) >= order.length;
};
const orderedPairs = world => {
  if (!validObjectOrder(world)) return [];
  const order = authorityFor(world).object_order;
  return list(authorityFor(world).ordered_neighbors).filter(pair => {
    if (!Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1]) return false;
    const [left, right] = pair;
    const leftIndex = order.indexOf(left); const rightIndex = order.indexOf(right);
    return leftIndex >= 0 && rightIndex >= 0 && Math.abs(leftIndex - rightIndex) === 1;
  });
};
const hasOrderedNeighbors = world => orderedPairs(world).length > 0;
const hasCropTarget = world => nodesFor(world).some(node => node?.type === 'asset' && ['image', 'video', 'document'].includes(node?.data?.kind));
const hasEdges = world => count(contextFor(world).graph_edge_count) > 0 && list(authorityFor(world).edges).length > 0;
const ambiguityOrOod = world => ['ambiguous', 'ood'].includes(world?.simulation?.scenario?.kind);
const validInstructionToNote = world => {
  if (!bindingsPresent(world, 'instruction')) return false;
  const nodes = nodeById(world);
  return list(authorityFor(world).instruction_bindings).some(binding => nodes.has(binding?.source) && nodes.get(binding?.target)?.type === 'text');
};
const hasApprovalTarget = world => selectedCount(world) >= 1 || validInstructionToNote(world);
const validInstructionReferenceChain = world => {
  if (!bindingsPresent(world, 'instruction') || !bindingsPresent(world, 'reference')) return false;
  const nodes = nodeById(world);
  const isSourceAsset = id => nodes.get(id)?.type === 'asset' && nodes.get(id)?.data?.role === 'Source';
  const isNote = id => nodes.get(id)?.type === 'text';
  const isReferenceAsset = id => nodes.get(id)?.type === 'asset' && nodes.get(id)?.data?.role === 'Reference';
  return list(authorityFor(world).instruction_bindings).some(instruction => (
    isSourceAsset(instruction?.source) && isNote(instruction?.target)
      && list(authorityFor(world).reference_bindings).some(reference => reference?.source === instruction.target && isReferenceAsset(reference?.target))
  ));
};
const prerequisites = Object.freeze({
  select_region: world => nodeCount(world) >= 1, lasso_select: world => nodeCount(world) >= 2, apply_instruction: validInstructionReferenceChain, connect: world => nodeCount(world) >= 2,
  move: world => selectedCount(world) >= 1, resize: world => selectedCount(world) >= 1 && hasResizeHandle(world), group: world => selectedCount(world) >= 2, emphasize: world => nodeCount(world) >= 1, remove: world => selectedCount(world) >= 1, replace: world => nodeCount(world) >= 1 && bindingsPresent(world, 'reference'),
  point_to: world => nodeCount(world) >= 1, rough_layout: world => nodeCount(world) >= 2, crop_region: hasCropTarget, reorder: validObjectOrder, insert_between: hasOrderedNeighbors, align: world => selectedCount(world) >= 2, distribute: world => selectedCount(world) >= 3, duplicate: world => selectedCount(world) >= 1, rotate: world => selectedCount(world) >= 1,
  zoom: () => true, pan: () => true, approve: hasApprovalTarget, reject: hasApprovalTarget, compare: world => nodeCount(world) >= 2, sequence: validObjectOrder, flow_direction: hasEdges, bracket_group: world => nodeCount(world) >= 2, annotate: world => nodeCount(world) >= 1, draw_layout: () => true, unknown: ambiguityOrOod,
});
export function feasibleIntents(world) { return INTENTS.filter(intent => prerequisites[intent](world)); }
export function feasibleInsertPairs(world) { return orderedPairs(world).map(pair => Object.freeze([...pair])); }
