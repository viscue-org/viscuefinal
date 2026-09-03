import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectRuntimeContext } from '../shared/context.mjs';
import { deriveGeometry } from '../shared/geometry.mjs';
import { hitTestGesture } from '../shared/hit-testing.mjs';
import { validateRuntimeContext } from '../shared/schema.mjs';

const point = (x, y, time_ms) => ({ x, y, time_ms, pressure: null });
const gesture = points => ({
  gesture_id: 'hit-fixture',
  schema_version: 'gesture-runtime/1.0',
  strokes: [{ pointer_id: 1, pointer_type: 'mouse', button: 0, cancelled: false, points }],
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
});
const lineGeometry = deriveGeometry(gesture([point(0.1, 0.2, 0), point(0.9, 0.2, 100)]));

const nodes = [
  {
    id: 'container_secret', type: 'group', is_container: true, zIndex: 0,
    bounds: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
  },
  {
    id: 'image_a', type: 'asset:image', parentId: 'container_secret', selected: true, zIndex: 2,
    bounds: { x: 0.05, y: 0.15, width: 0.3, height: 0.2 },
    handles: [{ id: 'east_port_secret', type: 'source', x: 0.29, y: 0.09, width: 0.02, height: 0.02 }],
    data: { label: 'USER SECRET A', imageUrl: 'https://private.example/a.png' },
  },
  {
    id: 'image_b', type: 'asset:image', parentId: 'container_secret', selected: false, zIndex: 2,
    bounds: { x: 0.65, y: 0.15, width: 0.3, height: 0.2 },
    data: { label: 'USER SECRET B' },
  },
];
const edges = [{ id: 'edge_secret', source: 'image_a', target: 'image_b', zIndex: 1 }];

test('authoritative binding retains IDs while model view contains no identifiers or user content', () => {
  const hits = hitTestGesture(lineGeometry, nodes, edges);

  assert.equal(hits.binding.start.node_id, 'image_a');
  assert.equal(hits.binding.end.node_id, 'image_b');
  assert.equal(hits.start.node_id, 'image_a');
  assert.deepEqual(hits.model_view.start, {
    hit_type: 'node', node_type: 'asset:image', relative_x: 0.16666667, relative_y: 0.25,
  });
  const serializedModelView = JSON.stringify(hits.model_view);
  for (const forbidden of ['image_a', 'image_b', 'container_secret', 'edge_secret', 'east_port_secret', 'USER SECRET', 'private.example']) {
    assert.equal(serializedModelView.includes(forbidden), false, forbidden);
  }
});

test('selected node wins an equal-z overlap and stable ID breaks the remaining tie', () => {
  const overlapping = [
    { id: 'z-last', type: 'asset:z', zIndex: 7, bounds: { x: 0, y: 0, width: 0.4, height: 0.4 } },
    { id: 'a-first', type: 'asset:a', zIndex: 7, bounds: { x: 0, y: 0, width: 0.4, height: 0.4 } },
    { id: 'selected', type: 'asset:selected', selected: true, zIndex: 7, bounds: { x: 0, y: 0, width: 0.4, height: 0.4 } },
  ];

  assert.equal(hitTestGesture(lineGeometry, overlapping, []).binding.start.node_id, 'selected');
  assert.equal(hitTestGesture(lineGeometry, overlapping.slice(0, 2), []).binding.start.node_id, 'a-first');
});

test('handle acquisition outranks its node body and retains handle identity only in binding', () => {
  const geometry = deriveGeometry(gesture([point(0.35, 0.25, 0), point(0.5, 0.5, 50)]));
  const hits = hitTestGesture(geometry, nodes, edges);

  assert.deepEqual({
    hit_type: hits.binding.start.hit_type,
    node_id: hits.binding.start.node_id,
    handle_id: hits.binding.start.handle_id,
    handle_type: hits.binding.start.handle_type,
  }, {
    hit_type: 'handle', node_id: 'image_a', handle_id: 'east_port_secret', handle_type: 'source',
  });
  assert.deepEqual(hits.model_view.start, {
    hit_type: 'handle', node_type: 'asset:image', relative_x: 1, relative_y: 0.5,
  });
  assert.equal(JSON.stringify(hits.model_view).includes('east_port_secret'), false);
});

test('edge proximity uses deterministic source-target geometry when no node is hit', () => {
  const geometry = deriveGeometry(gesture([point(0.5, 0.25, 0), point(0.5, 0.5, 50)]));
  const hits = hitTestGesture(geometry, nodes, edges, { edge_hit_radius: 0.02 });

  assert.equal(hits.binding.start.hit_type, 'edge');
  assert.equal(hits.binding.start.edge_id, 'edge_secret');
  assert.deepEqual(hits.model_view.start, {
    hit_type: 'edge', node_type: null, relative_x: 0.5, relative_y: 0,
  });
});

test('closed lasso contains full node bounds and excludes enclosing containers', () => {
  const geometry = deriveGeometry(gesture([
    point(0, 0.1, 0), point(1, 0.1, 10), point(1, 0.4, 20), point(0, 0.4, 30), point(0, 0.1, 40),
  ]));
  const hits = hitTestGesture(geometry, nodes, edges);

  assert.deepEqual(hits.binding.contained_node_ids, ['image_a', 'image_b']);
  assert.equal(hits.model_view.contained_node_count, 2);
});

test('lasso containment includes node corners that lie exactly on its boundary', () => {
  const geometry = deriveGeometry(gesture([
    point(0.05, 0.15, 0), point(0.35, 0.15, 10), point(0.35, 0.35, 20),
    point(0.05, 0.35, 30), point(0.05, 0.15, 40),
  ]));
  const hits = hitTestGesture(geometry, nodes, edges);

  assert.deepEqual(hits.binding.contained_node_ids, ['image_a']);
});

test('context projection is schema-valid, ID-free, content-free, and bounded to stable first 32 nodes', () => {
  const crowdedNodes = Array.from({ length: 40 }, (_, index) => ({
    id: `node_${String(index).padStart(2, '0')}`,
    type: `asset:t${String(index).padStart(2, '0')}`,
    parentId: 'container_secret',
    selected: index === 0,
    zIndex: 1,
    bounds: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 },
    data: { text: `PRIVATE CONTENT ${index}` },
  }));
  const allNodes = [nodes[0], ...crowdedNodes];
  const hits = hitTestGesture(lineGeometry, allNodes, []);
  const context = projectRuntimeContext({
    active_tool: 'annotate',
    canvas_mode: 'edit',
    raw_gesture: gesture([point(0.1, 0.2, 0), point(0.9, 0.2, 100)]),
    geometry: lineGeometry,
    nodes: allNodes,
    edges: [
      { id: 'private_edge_1', source: 'node_00', target: 'node_01' },
      { id: 'private_edge_2', source: 'node_02', target: 'node_00' },
    ],
    instruction_bindings: [{ id: 'instruction_private' }],
    reference_bindings: [{ id: 'reference_private' }, { id: 'reference_private_2' }],
    object_order: ['node_00', 'node_01'],
  }, hits);

  assert.equal(validateRuntimeContext(context).ok, true, validateRuntimeContext(context).error);
  assert.equal(context.nearby_nodes.length, 32);
  assert.equal(context.nearby_nodes[0].node_type, 'asset:t00');
  assert.equal(context.nearby_nodes[31].node_type, 'asset:t31');
  assert.deepEqual(context.nearby_nodes[0], {
    node_type: 'asset:t00', relative_x: 0.35, relative_y: 0.25, width: 0.1, height: 0.1,
    selected: true, same_container: true, incoming_edge_count: 1, outgoing_edge_count: 1,
  });
  assert.equal(context.instruction_binding_count, 1);
  assert.equal(context.reference_binding_count, 2);
  assert.equal(context.graph_edge_count, 2);
  assert.equal(context.object_order_count, 2);

  const serialized = JSON.stringify(context);
  for (const forbidden of ['node_00', 'container_secret', 'private_edge', 'PRIVATE CONTENT', 'instruction_private', 'reference_private']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('nearby-node ordering uses proximity before descending z-order and stable ID', () => {
  const orderedNodes = [
    { id: 'far', type: 'asset:far', zIndex: 99, bounds: { x: 0.6, y: 0.6, width: 0.1, height: 0.1 } },
    { id: 'z-low', type: 'asset:z-low', zIndex: 1, bounds: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 } },
    { id: 'z-high-b', type: 'asset:z-high-b', zIndex: 2, bounds: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 } },
    { id: 'z-high-a', type: 'asset:z-high-a', zIndex: 2, bounds: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 } },
  ];
  const hits = hitTestGesture(lineGeometry, orderedNodes, []);
  const context = projectRuntimeContext({
    active_tool: 'annotate', canvas_mode: 'edit',
    raw_gesture: gesture([point(0.1, 0.2, 0), point(0.9, 0.2, 100)]),
    geometry: lineGeometry, nodes: orderedNodes, edges: [],
  }, hits);

  assert.deepEqual(context.nearby_nodes.map(node => node.node_type), [
    'asset:z-high-a', 'asset:z-high-b', 'asset:z-low', 'asset:far',
  ]);
});

test('context uses bounded direct summaries when React Flow snapshots are absent', () => {
  const emptyHits = hitTestGesture(lineGeometry, [], []);
  const context = projectRuntimeContext({
    active_tool: 'select', canvas_mode: 'readonly', pointer_type: 'touch', pointer_count: 2,
    modifiers: { alt: true, ctrl: false, meta: false, shift: true },
    selected_node_count: 3, selected_node_types: ['asset:image', 'text', 'shape'],
    graph_edge_count: 7, instruction_binding_count: 4, reference_binding_count: 5,
    object_order_count: 6, geometry: lineGeometry,
  }, emptyHits);

  assert.deepEqual({
    selected_node_count: context.selected_node_count,
    selected_node_types: context.selected_node_types,
    graph_edge_count: context.graph_edge_count,
    instruction_binding_count: context.instruction_binding_count,
    reference_binding_count: context.reference_binding_count,
    object_order_count: context.object_order_count,
  }, {
    selected_node_count: 3,
    selected_node_types: ['asset:image', 'text', 'shape'],
    graph_edge_count: 7,
    instruction_binding_count: 4,
    reference_binding_count: 5,
    object_order_count: 6,
  });
  assert.equal(validateRuntimeContext(context).ok, true, validateRuntimeContext(context).error);
});
