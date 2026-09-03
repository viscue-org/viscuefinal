import assert from 'node:assert/strict';
import test from 'node:test';
import { INTENTS } from '../shared/taxonomy.mjs';
import { assertProductionFeatureKeys, validateRuntimeContext } from '../shared/schema.mjs';
import { feasibleIntents } from '../simulator/feasibility.mjs';
import { generatePersona } from '../simulator/personas.mjs';
import { createPrng } from '../simulator/prng.mjs';
import { generateWorld, sampleGoal } from '../simulator/worlds.mjs';

const runtimeContext = overrides => ({
  schema_version: 'gesture-context/1.0', active_tool: 'select', canvas_mode: 'edit', pointer_type: 'mouse', pointer_count: 1,
  modifiers: { alt: false, ctrl: false, meta: false, shift: false }, selected_node_count: 0, selected_node_types: [], nearby_nodes: [],
  start_hit: { hit_type: 'empty', node_type: null, relative_x: null, relative_y: null }, end_hit: { hit_type: 'empty', node_type: null, relative_x: null, relative_y: null },
  instruction_binding_count: 0, reference_binding_count: 0, graph_edge_count: 0, object_order_count: 0, ...overrides,
});
const worldWith = ({ context = {}, authority = {}, scenario = { kind: 'ordinary' } } = {}) => ({
  runtime_context: runtimeContext(context),
  simulation: { scenario, authority: { nodes: [], edges: [], object_order: [], instruction_bindings: [], reference_bindings: [], handles: [], ...authority }, ground_truth: { intent: 'connect' } },
});

test('generated worlds use only active extension shapes and exact production runtime context', () => {
  const world = generateWorld(12, generatePersona(9));
  assert.equal(validateRuntimeContext(world.runtime_context).ok, true);
  assert.doesNotThrow(() => assertProductionFeatureKeys(world.runtime_context));
  assert.deepEqual(Object.keys(world.runtime_context).sort(), ['active_tool', 'canvas_mode', 'end_hit', 'graph_edge_count', 'instruction_binding_count', 'modifiers', 'nearby_nodes', 'object_order_count', 'pointer_count', 'pointer_type', 'reference_binding_count', 'schema_version', 'selected_node_count', 'selected_node_types', 'start_hit']);
  assert.ok(world.simulation.authority.nodes.every(node => ['asset', 'text'].includes(node.type)));
  assert.ok(world.simulation.authority.edges.every(edge => ['annotation', 'crossAsset'].includes(edge.type)));
});

test('runtime context is ID-free while IDs, bindings, ordering, handles, and truth remain authoritative simulator metadata', () => {
  const world = generateWorld(24, generatePersona(4));
  const serialized = JSON.stringify(world.runtime_context);
  for (const forbidden of ['sim_', 'edge_annotation', 'ground_truth', '"intent"', '"source"', '"target"', '"scenario"']) assert.equal(serialized.includes(forbidden), false, `${forbidden} leaked into learned inputs`);
  assert.ok(world.simulation.authority.nodes.some(node => node.id));
  assert.ok(world.simulation.authority.object_order.every(id => typeof id === 'string'));
  assert.ok(Object.hasOwn(world.simulation, 'ground_truth'));
});

test('feasibility enforces resize, ordered-neighbor, and instruction-reference prerequisites', () => {
  const noResize = worldWith({ context: { selected_node_count: 1, selected_node_types: ['asset'] }, authority: { nodes: [{ id: 'node_a', selected: true }] } });
  const resize = worldWith({ context: { selected_node_count: 1, selected_node_types: ['asset'] }, authority: { nodes: [{ id: 'node_a', selected: true }], handles: [{ node_id: 'node_a', type: 'resize' }] } });
  assert.equal(feasibleIntents(noResize).includes('resize'), false); assert.equal(feasibleIntents(resize).includes('resize'), true);
  const unordered = worldWith({ context: { object_order_count: 2 }, authority: { nodes: [{ id: 'a' }, { id: 'b' }], object_order: ['a', 'b'] } });
  const ordered = worldWith({ context: { object_order_count: 3 }, authority: { nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], object_order: ['a', 'b', 'c'], ordered_neighbors: [['a', 'b']] } });
  assert.equal(feasibleIntents(unordered).includes('insert_between'), false); assert.equal(feasibleIntents(ordered).includes('insert_between'), true);
  const instructionOnly = worldWith({ context: { instruction_binding_count: 1 }, authority: { instruction_bindings: [{ source: 'a', target: 'note' }] } });
  const instructionAndReference = worldWith({ context: { instruction_binding_count: 1, reference_binding_count: 1 }, authority: { nodes: [{ id: 'a', type: 'asset', data: { role: 'Source' } }, { id: 'note', type: 'text' }, { id: 'reference', type: 'asset', data: { role: 'Reference' } }], instruction_bindings: [{ source: 'a', target: 'note' }], reference_bindings: [{ source: 'note', target: 'reference' }] } });
  assert.equal(feasibleIntents(instructionOnly).includes('apply_instruction'), false); assert.equal(feasibleIntents(instructionAndReference).includes('apply_instruction'), true);
});

test('all 30 taxonomy decisions have scheduled feasible worlds and unknown is only an abstention goal', () => {
  const seen = new Set();
  for (let seed = 0; seed < 720; seed++) {
    const world = generateWorld(seed, generatePersona(seed)); const goal = sampleGoal(world, generatePersona(seed), createPrng(seed)); seen.add(goal.intent);
    assert.equal(feasibleIntents(world).includes(goal.intent), true, `${goal.intent} should be feasible`);
    if (goal.intent === 'unknown') { assert.equal(goal.accepted, false); assert.ok(['ambiguous_intent', 'ood'].includes(goal.reason)); } else assert.equal(goal.accepted, true, `${goal.intent} must be an accepted operation candidate`);
  }
  assert.deepEqual([...seen].sort(), [...INTENTS].sort());
});

test('ordinary worlds exclude unknown from feasible operations', () => {
  const world = generateWorld(31, generatePersona(31));
  assert.equal(world.simulation.scenario.kind, 'ordinary');
  assert.equal(feasibleIntents(world).includes('unknown'), false);
  assert.notEqual(sampleGoal(world, generatePersona(31), createPrng(31)).intent, 'unknown');
});

test('sampleGoal never emits impossible operations and is reproducible for one world and seed', () => {
  const world = worldWith();
  assert.deepEqual(sampleGoal(world, generatePersona(1), createPrng(8)), sampleGoal(world, generatePersona(1), createPrng(8)));
  const goal = sampleGoal(world, generatePersona(1), createPrng(8));
  assert.equal(feasibleIntents(world).includes(goal.intent), true);
  assert.notEqual(goal.intent, 'resize'); assert.notEqual(goal.intent, 'insert_between'); assert.notEqual(goal.intent, 'apply_instruction');
});

test('coverage schedule spans every pair of device, density, canvas mode, and active tool plus rare scenarios', () => {
  const worlds = Array.from({ length: 720 }, (_, seed) => generateWorld(seed, generatePersona(seed))); const axes = ['device', 'density', 'canvas_mode', 'active_tool'];
  for (let left = 0; left < axes.length; left++) for (let right = left + 1; right < axes.length; right++) {
    const pairs = new Set(worlds.map(world => { const coverage = world.simulation.provenance.coverage; return `${coverage[axes[left]]}|${coverage[axes[right]]}`; }));
    const leftValues = new Set(worlds.map(world => world.simulation.provenance.coverage[axes[left]])); const rightValues = new Set(worlds.map(world => world.simulation.provenance.coverage[axes[right]]));
    assert.equal(pairs.size, leftValues.size * rightValues.size, `${axes[left]} x ${axes[right]} pair coverage`);
  }
  assert.ok(worlds.some(world => ['ambiguous', 'ood'].includes(world.simulation.scenario.kind)));
});

const fullyFeasibleWorld = () => generateWorld(31, generatePersona(31));
const cloneWorld = world => structuredClone(world);

test('resize rejects detached handles and requires a handle on an authoritative selected node', () => {
  const valid = fullyFeasibleWorld();
  assert.equal(feasibleIntents(valid).includes('resize'), true);

  const detached = cloneWorld(valid);
  detached.simulation.authority.handles[0].node_id = 'sentinel_detached_handle';
  assert.equal(feasibleIntents(detached).includes('resize'), false);

  const unselected = cloneWorld(valid);
  const handleNode = unselected.simulation.authority.nodes.find(node => node.id === unselected.simulation.authority.handles[0].node_id);
  handleNode.selected = false;
  unselected.runtime_context.selected_node_count -= 1;
  assert.equal(feasibleIntents(unselected).includes('resize'), false);
});

test('insert_between validates member IDs and real adjacency rather than trusting an asserted pair', () => {
  const valid = fullyFeasibleWorld();
  assert.equal(feasibleIntents(valid).includes('insert_between'), true);
  const scheduled = cloneWorld(valid);
  scheduled.simulation.ground_truth.intent = 'insert_between';
  const scheduledGoal = sampleGoal(scheduled, generatePersona(31), createPrng(31));
  assert.equal(scheduledGoal.intent, 'insert_between');
  assert.ok(Array.isArray(scheduledGoal.references?.pair));
  const scheduledOrder = scheduled.simulation.authority.object_order;
  assert.equal(Math.abs(scheduledOrder.indexOf(scheduledGoal.references.pair[0]) - scheduledOrder.indexOf(scheduledGoal.references.pair[1])), 1);

  const nonMember = cloneWorld(valid);
  nonMember.simulation.authority.ordered_neighbors = [['sentinel_missing_left', nonMember.simulation.authority.object_order[1]]];
  assert.equal(feasibleIntents(nonMember).includes('insert_between'), false);

  const nonAdjacent = cloneWorld(valid);
  const order = nonAdjacent.simulation.authority.object_order;
  nonAdjacent.simulation.authority.ordered_neighbors = [[order[0], order[2]]];
  assert.equal(feasibleIntents(nonAdjacent).includes('insert_between'), false);

  const reversedAdjacent = cloneWorld(valid);
  const reversedOrder = reversedAdjacent.simulation.authority.object_order;
  reversedAdjacent.simulation.authority.ordered_neighbors = [[reversedOrder[1], reversedOrder[0]]];
  assert.equal(feasibleIntents(reversedAdjacent).includes('insert_between'), true);

  const impossibleGoal = cloneWorld(nonAdjacent);
  impossibleGoal.simulation.ground_truth.intent = 'insert_between';
  const goal = sampleGoal(impossibleGoal, generatePersona(31), createPrng(31));
  assert.notEqual(goal.intent, 'insert_between');
  assert.equal(goal.references?.pair ?? null, null);
});

test('apply_instruction rejects stale or mistyped authority bindings', () => {
  const valid = fullyFeasibleWorld();
  assert.equal(feasibleIntents(valid).includes('apply_instruction'), true);

  const staleInstruction = cloneWorld(valid);
  staleInstruction.simulation.authority.instruction_bindings[0].target = 'sentinel_stale_note';
  assert.equal(feasibleIntents(staleInstruction).includes('apply_instruction'), false);

  const mistypedReference = cloneWorld(valid);
  mistypedReference.simulation.authority.reference_bindings[0].target = mistypedReference.simulation.authority.nodes.find(node => node.type === 'text').id;
  assert.equal(feasibleIntents(mistypedReference).includes('apply_instruction'), false);
});

test('approve and reject require a real selected target or instruction-to-note binding, not a reference asset', () => {
  const selectedOnly = cloneWorld(fullyFeasibleWorld());
  selectedOnly.simulation.authority.reference_bindings = [];
  selectedOnly.runtime_context.reference_binding_count = 0;
  assert.equal(feasibleIntents(selectedOnly).includes('approve'), true);
  assert.equal(feasibleIntents(selectedOnly).includes('reject'), true);
  assert.equal(feasibleIntents(selectedOnly).includes('apply_instruction'), false);

  const staleTargets = cloneWorld(selectedOnly);
  staleTargets.simulation.authority.nodes.forEach(node => { node.selected = false; });
  staleTargets.runtime_context.selected_node_count = 0;
  staleTargets.simulation.authority.instruction_bindings[0].target = 'sentinel_stale_note';
  assert.equal(feasibleIntents(staleTargets).includes('approve'), false);
  assert.equal(feasibleIntents(staleTargets).includes('reject'), false);

  const bindingOnly = cloneWorld(selectedOnly);
  bindingOnly.simulation.authority.nodes.forEach(node => { node.selected = false; });
  bindingOnly.runtime_context.selected_node_count = 0;
  assert.equal(feasibleIntents(bindingOnly).includes('approve'), true);
  assert.equal(feasibleIntents(bindingOnly).includes('reject'), true);
});

test('structural prerequisite audit has a positive and negative case for every structural intent', () => {
  const positive = fullyFeasibleWorld();
  const audit = [
    ['select_region', world => { world.simulation.authority.nodes = []; }], ['lasso_select', world => { world.simulation.authority.nodes = world.simulation.authority.nodes.slice(0, 1); }],
    ['apply_instruction', world => { world.simulation.authority.reference_bindings = []; }], ['connect', world => { world.simulation.authority.nodes = world.simulation.authority.nodes.slice(0, 1); }],
    ['move', world => { world.simulation.authority.nodes.forEach(node => { node.selected = false; }); world.runtime_context.selected_node_count = 0; }], ['resize', world => { world.simulation.authority.handles = []; }],
    ['group', world => { world.simulation.authority.nodes.forEach(node => { node.selected = false; }); world.simulation.authority.nodes[0].selected = true; world.runtime_context.selected_node_count = 1; }],
    ['emphasize', world => { world.simulation.authority.nodes = []; }], ['remove', world => { world.simulation.authority.nodes.forEach(node => { node.selected = false; }); world.runtime_context.selected_node_count = 0; }],
    ['replace', world => { world.simulation.authority.reference_bindings = []; }], ['point_to', world => { world.simulation.authority.nodes = []; }], ['rough_layout', world => { world.simulation.authority.nodes = world.simulation.authority.nodes.slice(0, 1); }],
    ['crop_region', world => { world.simulation.authority.nodes.forEach(node => { if (node.data) node.data.kind = 'webpage'; }); }], ['reorder', world => { world.simulation.authority.object_order = [world.simulation.authority.object_order[0]]; world.runtime_context.object_order_count = 1; }],
    ['insert_between', world => { const order = world.simulation.authority.object_order; world.simulation.authority.ordered_neighbors = [[order[0], order[2]]]; }], ['align', world => { world.simulation.authority.nodes.forEach(node => { node.selected = false; }); world.simulation.authority.nodes[0].selected = true; world.runtime_context.selected_node_count = 1; }],
    ['distribute', world => { world.simulation.authority.nodes.forEach(node => { node.selected = false; }); world.simulation.authority.nodes.slice(0, 2).forEach(node => { node.selected = true; }); world.runtime_context.selected_node_count = 2; }], ['duplicate', world => { world.simulation.authority.nodes.forEach(node => { node.selected = false; }); world.runtime_context.selected_node_count = 0; }],
    ['rotate', world => { world.simulation.authority.nodes.forEach(node => { node.selected = false; }); world.runtime_context.selected_node_count = 0; }], ['approve', world => { world.simulation.authority.nodes.forEach(node => { node.selected = false; }); world.runtime_context.selected_node_count = 0; world.simulation.authority.instruction_bindings = []; }], ['reject', world => { world.simulation.authority.nodes.forEach(node => { node.selected = false; }); world.runtime_context.selected_node_count = 0; world.simulation.authority.instruction_bindings = []; }],
    ['compare', world => { world.simulation.authority.nodes = world.simulation.authority.nodes.slice(0, 1); }], ['sequence', world => { world.simulation.authority.object_order = [world.simulation.authority.object_order[0]]; world.runtime_context.object_order_count = 1; }], ['flow_direction', world => { world.simulation.authority.edges = []; }],
    ['bracket_group', world => { world.simulation.authority.nodes = world.simulation.authority.nodes.slice(0, 1); }], ['annotate', world => { world.simulation.authority.nodes = []; }], ['unknown', world => { world.simulation.scenario.kind = 'ordinary'; }],
  ];
  for (const [intent, breakPrerequisite] of audit) {
    const valid = intent === 'unknown' ? generateWorld(37, generatePersona(37)) : positive;
    assert.equal(feasibleIntents(valid).includes(intent), true, `${intent} positive prerequisite`);
    const invalid = cloneWorld(valid); breakPrerequisite(invalid);
    assert.equal(feasibleIntents(invalid).includes(intent), false, `${intent} negative prerequisite`);
  }
  for (const intent of ['zoom', 'pan', 'draw_layout']) assert.equal(feasibleIntents(worldWith()).includes(intent), true, `${intent} has no structural prerequisite`);
});

test('recursive feature-boundary audit excludes every authority, truth, scenario, and latent sentinel', () => {
  const persona = { ...generatePersona(14), persona_id: 'sentinel_persona_id', skill: 0.31415926, velocity: 1.61803399, jitter: 0.27182818, density_preference: 'sentinel_density' };
  const world = generateWorld(14, persona);
  const values = [];
  const keys = [];
  const walk = value => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (value && typeof value === 'object') for (const [key, nested] of Object.entries(value)) { keys.push(key); walk(nested); }
    else values.push(value);
  };
  walk(world.runtime_context);
  const authorityIds = [
    ...world.simulation.authority.nodes.map(node => node.id), ...world.simulation.authority.edges.map(edge => edge.id),
    ...world.simulation.authority.handles.map(handle => handle.id), ...world.simulation.authority.instruction_bindings.flatMap(binding => [binding.source, binding.target]), ...world.simulation.authority.reference_bindings.flatMap(binding => [binding.source, binding.target]),
  ];
  for (const value of [...authorityIds, world.simulation.ground_truth.intent, world.simulation.ground_truth.family, world.simulation.scenario.kind, persona.persona_id, persona.skill, persona.velocity, persona.jitter, persona.density_preference]) assert.equal(values.includes(value), false, `leaked value ${String(value)}`);
  for (const key of ['id', 'source', 'target', 'node_id', 'ground_truth', 'intent', 'persona_id', 'scenario', 'template_id', 'skill', 'velocity', 'jitter', 'density_preference']) assert.equal(keys.includes(key), false, `leaked key ${key}`);
  assert.equal(validateRuntimeContext(world.runtime_context).ok, true);
  assert.doesNotThrow(() => assertProductionFeatureKeys(world.runtime_context));
});
