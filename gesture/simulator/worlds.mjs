import { SCHEMA_VERSIONS } from '../shared/contracts.mjs';
import { FAMILY_BY_INTENT, INTENTS } from '../shared/taxonomy.mjs';
import { assertProductionFeatureKeys, validateRuntimeContext } from '../shared/schema.mjs';
import { feasibleInsertPairs, feasibleIntents } from './feasibility.mjs';

const DENSITIES = ['sparse', 'dense']; const MODES = ['edit', 'annotate']; const TOOLS = ['select', 'annotate'];
const safeSeed = seed => typeof seed === 'number' && Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : typeof seed === 'bigint' ? Number((seed < 0n ? -seed : seed) % 9007199254740991n) : Array.from(String(seed ?? '')).reduce((total, character) => total * 31 + character.codePointAt(0), 0) >>> 0;
const round = value => Number(value.toFixed(8));
const idFor = (seed, suffix) => `sim_${safeSeed(seed).toString(36)}_${suffix}`;

function coverageFor(seed, persona) { const index = safeSeed(seed) % 24; return Object.freeze({ device: persona.device, density: DENSITIES[Math.floor(index / 3) % 2], canvas_mode: MODES[Math.floor(index / 6) % 2], active_tool: TOOLS[Math.floor(index / 12) % 2] }); }
function scenarioFor(seed) { const normalized = safeSeed(seed); return normalized % 74 === 0 ? Object.freeze({ kind: 'ood', rare: true }) : normalized % 37 === 0 ? Object.freeze({ kind: 'ambiguous', rare: true }) : Object.freeze({ kind: 'ordinary', rare: false }); }
function authorityFor(seed, density) {
  const image = idFor(seed, 'image'); const reference = idFor(seed, 'reference'); const note = idFor(seed, 'note');
  const nodes = [
    { id: image, type: 'asset', position: { x: 0.08, y: 0.14 }, width: 0.24, height: 0.2, selected: true, data: { kind: 'image', role: 'Source' } },
    { id: reference, type: 'asset', position: { x: 0.58, y: 0.16 }, width: 0.22, height: 0.2, selected: true, data: { kind: 'document', role: 'Reference' } },
    { id: note, type: 'text', position: { x: 0.36, y: 0.62 }, width: 0.26, height: 0.12, selected: true, data: { text: 'synthetic instruction' } },
  ];
  if (density === 'dense') nodes.push({ id: idFor(seed, 'video'), type: 'asset', position: { x: 0.12, y: 0.58 }, width: 0.18, height: 0.18, selected: false, data: { kind: 'video', role: 'Context' } });
  return Object.freeze({
    nodes: Object.freeze(nodes.map(node => Object.freeze({ ...node, position: Object.freeze({ ...node.position }), data: Object.freeze({ ...node.data }) }))),
    edges: Object.freeze([Object.freeze({ id: idFor(seed, 'edge_annotation'), type: 'annotation', source: image, target: note }), Object.freeze({ id: idFor(seed, 'edge_cross'), type: 'crossAsset', source: image, target: reference })]),
    object_order: Object.freeze([image, note, reference]), ordered_neighbors: Object.freeze([Object.freeze([image, note])]), handles: Object.freeze([Object.freeze({ node_id: image, id: idFor(seed, 'resize'), type: 'resize' })]),
    instruction_bindings: Object.freeze([Object.freeze({ source: image, target: note })]), reference_bindings: Object.freeze([Object.freeze({ source: note, target: reference })]),
  });
}
function runtimeContext(authority, coverage, persona) {
  const nodes = authority.nodes;
  const nearby = nodes.map((node, index) => Object.freeze({ node_type: node.type, relative_x: round(0.12 + index * 0.19), relative_y: round(-0.18 + index * 0.13), width: round(Math.min(1, node.width)), height: round(Math.min(1, node.height)), selected: node.selected === true, same_container: false, incoming_edge_count: authority.edges.filter(edge => edge.target === node.id).length, outgoing_edge_count: authority.edges.filter(edge => edge.source === node.id).length }));
  const context = { schema_version: SCHEMA_VERSIONS.runtimeContext, active_tool: coverage.active_tool, canvas_mode: coverage.canvas_mode, pointer_type: persona.device, pointer_count: persona.device === 'touch' ? 2 : 1, modifiers: Object.freeze({ alt: false, ctrl: false, meta: false, shift: false }), selected_node_count: nodes.filter(node => node.selected).length, selected_node_types: nodes.filter(node => node.selected).map(node => node.type), nearby_nodes: Object.freeze(nearby), start_hit: Object.freeze({ hit_type: 'node', node_type: 'asset', relative_x: 0.5, relative_y: 0.5 }), end_hit: Object.freeze({ hit_type: 'node', node_type: 'asset', relative_x: 0.5, relative_y: 0.5 }), instruction_binding_count: authority.instruction_bindings.length, reference_binding_count: authority.reference_bindings.length, graph_edge_count: authority.edges.length, object_order_count: authority.object_order.length };
  const validation = validateRuntimeContext(context); if (!validation.ok) throw new TypeError(`simulator emitted invalid runtime context: ${validation.error}`); assertProductionFeatureKeys(context);
  return Object.freeze(context);
}
export function generateWorld(worldSeed, persona) {
  if (!persona || typeof persona !== 'object') throw new TypeError('generateWorld requires a persona');
  const coverage = coverageFor(worldSeed, persona); const scenario = scenarioFor(worldSeed); const authority = authorityFor(worldSeed, coverage.density); const scheduled = INTENTS[safeSeed(worldSeed) % INTENTS.length]; const intent = scenario.kind === 'ordinary' && scheduled !== 'unknown' ? scheduled : 'unknown'; const context = runtimeContext(authority, coverage, persona);
  return Object.freeze({ runtime_context: context, simulation: Object.freeze({ provenance: Object.freeze({ world_seed: String(worldSeed), persona_id: persona.persona_id, coverage }), scenario, authority, ground_truth: Object.freeze({ intent, family: FAMILY_BY_INTENT[intent], accepted: intent !== 'unknown' }) }) });
}
/** Selects a deterministic already-feasible simulator target; unknown always abstains. */
export function sampleGoal(world, persona, prng) {
  const feasible = feasibleIntents(world); const scheduled = world?.simulation?.ground_truth?.intent; const intent = feasible.includes(scheduled) ? scheduled : feasible.find(candidate => candidate !== 'unknown') ?? feasible[0] ?? 'unknown'; const unknown = intent === 'unknown';
  const pair = intent === 'insert_between' ? feasibleInsertPairs(world)[0] : null;
  return Object.freeze({ intent, family: FAMILY_BY_INTENT[intent], accepted: !unknown, reason: unknown ? (world?.simulation?.scenario?.kind === 'ood' ? 'ood' : 'ambiguous_intent') : null, variation: prng && typeof prng.int === 'function' ? prng.int(1_000_000) : 0, persona_device: persona?.device ?? null, references: pair ? Object.freeze({ pair }) : null });
}
