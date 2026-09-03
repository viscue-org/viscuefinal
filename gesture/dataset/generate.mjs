import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip, gzipSync } from 'node:zlib';
import { once } from 'node:events';
import { createSourceManifest } from '../../scripts/source-manifest.mjs';
import { INTENTS, FAMILY_BY_INTENT } from '../shared/taxonomy.mjs';
import { deriveGeometry } from '../shared/geometry.mjs';
import { buildModelInputs } from '../shared/features.mjs';
import { generatePersona } from '../simulator/personas.mjs';
import { generateWorld } from '../simulator/worlds.mjs';
import { feasibleIntents } from '../simulator/feasibility.mjs';
import { executeGoal } from '../simulator/executors.mjs';
import { makeCounterfactualPair } from '../simulator/counterfactuals.mjs';
import { addSplitMembership, emptySplitGroups, groupAssignment, normalizeSplitMembership } from './splits.mjs';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(moduleDirectory, '../..');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const jsonLine = value => `${JSON.stringify(value)}\n`;
const clone = value => JSON.parse(JSON.stringify(value));
export const MAX_SHARD_SIZE = 1000;

async function sourceHashes() {
  const source = await createSourceManifest(workspaceRoot);
  const [schema, geometry, generator] = await Promise.all([
    fsp.readFile(path.join(workspaceRoot, 'gesture/shared/schema.mjs')),
    fsp.readFile(path.join(workspaceRoot, 'gesture/shared/geometry.mjs')),
    fsp.readFile(path.join(workspaceRoot, 'gesture/dataset/generate.mjs')),
  ]);
  return Object.freeze({ source_tree_sha256: source.tree_sha256, schema_sha256: sha256(schema), geometry_sha256: sha256(geometry), generator_sha256: sha256(generator) });
}

function normalizedWorld(base, intent, index, { ordinary = true, scenarioKind = null } = {}) {
  const world = clone(base);
  // The base simulator supplies a valid topology. Vary its production-shaped
  // layout independently of the goal so canvas-state diversity is real rather
  // than an ID/provenance trick.
  const mix = (value, multiplier) => { let mixed = (value + 1) >>> 0; mixed = Math.imul(mixed ^ (mixed >>> 16), multiplier); mixed = Math.imul(mixed ^ (mixed >>> 13), 0x27d4eb2d); return ((mixed ^ (mixed >>> 16)) >>> 0) / 0xffffffff; };
  const dx = (mix(index, 2654435761) - 0.5) * 0.4;
  const dy = (mix(index, 2246822519) - 0.5) * 0.34;
  world.simulation.authority.nodes.forEach((node, nodeIndex) => {
    node.width = Math.max(0.1, Math.min(0.34, node.width + (mix(index + nodeIndex * 17, 3266489917) - 0.5) * 0.1));
    node.height = Math.max(0.08, Math.min(0.3, node.height + (mix(index + nodeIndex * 29, 668265263) - 0.5) * 0.08));
    node.position.x = Math.max(0.01, Math.min(0.95 - node.width, node.position.x + dx + nodeIndex * 0.004));
    node.position.y = Math.max(0.01, Math.min(0.95 - node.height, node.position.y + dy - nodeIndex * 0.004));
  });
  world.runtime_context.nearby_nodes = world.runtime_context.nearby_nodes.map((nearby, nodeIndex) => ({ ...nearby, width: Number(world.simulation.authority.nodes[nodeIndex]?.width ?? nearby.width).toFixed(8) * 1, height: Number(world.simulation.authority.nodes[nodeIndex]?.height ?? nearby.height).toFixed(8) * 1 }));
  world.runtime_context.active_tool = index % 2 === 0 ? 'select' : 'annotate';
  world.runtime_context.canvas_mode = index % 3 === 0 ? 'annotate' : 'edit';
  // Vary optional production context facts while retaining every prerequisite
  // required by the scheduled intent. These are real world-state variations,
  // not label/provenance fields.
  const selectedMinimum = new Set(['move', 'resize', 'remove', 'duplicate', 'rotate', 'approve', 'reject']).has(intent) ? 1 : intent === 'group' || intent === 'align' ? 2 : intent === 'distribute' ? 3 : 0;
  const selectedNodes = world.simulation.authority.nodes.filter(node => node.selected === true);
  if (selectedMinimum === 0) selectedNodes.forEach((node, nodeIndex) => { node.selected = index % 3 === 0 ? false : nodeIndex < (index % 2 === 0 ? 1 : 2); });
  else selectedNodes.forEach((node, nodeIndex) => { node.selected = nodeIndex < selectedMinimum; });
  world.runtime_context.selected_node_count = world.simulation.authority.nodes.filter(node => node.selected).length;
  world.runtime_context.selected_node_types = world.simulation.authority.nodes.filter(node => node.selected).map(node => node.type);
  world.runtime_context.nearby_nodes = world.runtime_context.nearby_nodes.map(node => ({ ...node, selected: world.simulation.authority.nodes.find(candidate => candidate.type === node.node_type)?.selected === true }));
  if (!['apply_instruction'].includes(intent) && index % 3 === 0) { world.simulation.authority.instruction_bindings = []; world.runtime_context.instruction_binding_count = 0; }
  if (!['apply_instruction', 'replace'].includes(intent) && index % 4 === 0) { world.simulation.authority.reference_bindings = []; world.runtime_context.reference_binding_count = 0; }
  if (intent !== 'flow_direction' && index % 5 === 0) { world.simulation.authority.edges = []; world.runtime_context.graph_edge_count = 0; }
  if (!['reorder', 'insert_between', 'sequence'].includes(intent) && index % 6 === 0) { world.simulation.authority.object_order = []; world.simulation.authority.ordered_neighbors = []; world.runtime_context.object_order_count = 0; }
  if (intent === 'distribute') {
    world.simulation.authority.nodes[2].selected = true;
    world.runtime_context.selected_node_count = 3;
    world.runtime_context.selected_node_types = world.simulation.authority.nodes.filter(node => node.selected).map(node => node.type);
    world.runtime_context.nearby_nodes[2].selected = true;
  }
  if (scenarioKind) world.simulation.scenario = { kind: scenarioKind, rare: true };
  else if (intent === 'unknown') world.simulation.scenario = { kind: 'ood', rare: true };
  else if (ordinary) world.simulation.scenario = { kind: 'ordinary', rare: false };
  return world;
}
function templateTransform(raw, templateGroup) {
  if (templateGroup.startsWith('arc-core:')) return raw;
  const transformed = clone(raw);
  // Every protected template family changes the motor program. The holdout
  // mirror is absent from train; other held-out families use distinct warps.
  for (const stroke of transformed.strokes) for (const [pointIndex, point] of stroke.points.entries()) {
    const interior = pointIndex > 0 && pointIndex < stroke.points.length - 1;
    if (templateGroup.startsWith('mirror-holdout:') && interior) point.y = Number(Math.min(.97, Math.max(.03, point.y + .028 * Math.sin(Math.PI * pointIndex / (stroke.points.length - 1)))).toFixed(8));
    else if (templateGroup.startsWith('arc-validation:')) point.x = Number(Math.min(.97, Math.max(.03, point.x + .012 * Math.sin(point.time_ms / 19))).toFixed(8));
    else if (templateGroup.startsWith('arc-test:')) point.y = Number(Math.min(.97, Math.max(.03, point.y + .012 * Math.cos(point.time_ms / 23))).toFixed(8));
    // Counterfactual source/replacement rows deliberately retain the exact
    // source motor trace; only authoritative context and intent change.
    else if (templateGroup.startsWith('arc-counterfactual:')) continue;
    else if (templateGroup.startsWith('recovery-ood:')) point.y = Number(Math.min(.97, Math.max(.03, point.y + .016 * Math.sin(point.time_ms / 13))).toFixed(8));
  }
  return transformed;
}

function goalFor(world, intent, persona, sampleSeed) {
  if (intent !== 'unknown' && !feasibleIntents(world).includes(intent)) throw new Error(`dataset goal ${intent} is not feasible for seed ${sampleSeed}`);
  return Object.freeze({ intent, family: FAMILY_BY_INTENT[intent], accepted: intent !== 'unknown', reason: intent === 'unknown' ? 'ood' : null, variation: Number(sampleSeed % 1_000_000n), persona_device: persona.device });
}
function publicCanvas(authority) {
  return { nodes: authority.nodes.map(node => ({ type: node.type, position: node.position, width: node.width, height: node.height, selected: node.selected, data: node.data })), edges: authority.edges.map(edge => ({ type: edge.type })), object_order_count: authority.object_order.length };
}

function sampleRecord({ index, seed, personas }) {
  const sampleSeed = BigInt(seed) * 1_000_003n + BigInt(index);
  const personaIndex = index % personas;
  const persona = generatePersona(`dataset:${seed}:persona:${personaIndex}`);
  // Intent choice is deliberately offset on every persona pass. A persona or
  // device therefore cannot act as a label surrogate in the smoke corpus.
  let scheduledIntent = INTENTS[(index % INTENTS.length + Math.floor(index / INTENTS.length) * 11) % INTENTS.length];
  const worldSeed = `dataset:${seed}:world:${index}`;
  const assignment = groupAssignment({ personaIndex, worldSeed, templateIndex: index % 19, seed });
  const hardRound = Math.floor(index / personas);
  const pairBaseIndex = assignment.split === 'hard_counterfactual' ? (hardRound % 2 === 0 ? index : index - personas) : index;
  const pairRole = assignment.split === 'hard_counterfactual' ? (hardRound % 2 === 0 ? 'source' : 'replacement') : null;
  // Keep a small ambiguous train slice for abstention calibration; protected
  // validation/test/holdout rows and OOD use explicit split semantics.
  if (scheduledIntent === 'unknown' && assignment.split !== 'train') scheduledIntent = 'connect';
  const ambiguous = scheduledIntent === 'unknown' && assignment.split === 'train';
  const executionIntent = ambiguous ? feasibleIntents(generateWorld(worldSeed, persona)).find(intent => intent !== 'unknown') ?? 'connect' : scheduledIntent;
  const world = normalizedWorld(generateWorld(worldSeed, persona), executionIntent, index, { ordinary: assignment.split !== 'ood', scenarioKind: ambiguous ? 'ambiguous' : null });
  let goal = goalFor(world, executionIntent, persona, sampleSeed);
  const oodOutcome = assignment.split === 'ood' ? ['incomplete', 'miss', 'cancelled', 'release_failure'][index % 4] : 'complete';
  if (assignment.split === 'ood') goal = Object.freeze({ ...goal, outcome: oodOutcome, accepted: false });
  let ambiguity = null;
  let raw;
  if (ambiguous) {
    const candidatePrograms = feasibleIntents(world).filter(candidate => candidate !== 'unknown').map(candidate => {
      const candidateSeed = `dataset:${sampleSeed}:ambiguous:${candidate}`;
      const candidateGoal = goalFor(world, candidate, persona, sampleSeed);
      return { intent: candidate, seed: candidateSeed, raw: executeGoal({ persona, world, goal: candidateGoal, seed: candidateSeed }) };
    }).filter(candidate => candidate.raw.strokes.length <= 2);
    if (candidatePrograms.length < 2) throw new Error(`ambiguous dataset world has fewer than two bounded candidates: ${sampleSeed}`);
    const firstIndex = Number(sampleSeed % BigInt(candidatePrograms.length));
    const secondIndex = (firstIndex + 1 + Number((sampleSeed / 11n) % BigInt(candidatePrograms.length - 1))) % candidatePrograms.length;
    const first = candidatePrograms[firstIndex]; const second = candidatePrograms[secondIndex];
    ambiguity = { candidate_a_intent: first.intent, candidate_a_seed: first.seed, candidate_b_intent: second.intent, candidate_b_seed: second.seed };
    let nextTime = 0; const composedStrokes = [];
    for (const candidate of [first, second]) for (const stroke of candidate.raw.strokes) {
      const shift = nextTime - stroke.points[0].time_ms;
      const points = stroke.points.map(point => ({ ...point, time_ms: point.time_ms + shift }));
      composedStrokes.push({ ...stroke, points }); nextTime = points.at(-1).time_ms + 18;
    }
    raw = { gesture_id: `ambiguous-${String(sampleSeed)}`, schema_version: first.raw.schema_version, strokes: composedStrokes, modifiers: first.raw.modifiers };
    goal = goalFor(world, first.intent, persona, sampleSeed);
  } else raw = executeGoal({ persona, world, goal, seed: `dataset:${sampleSeed}` });
  let pair = null;
  if (assignment.split === 'hard_counterfactual') {
    const sourceSeed = BigInt(seed) * 1_000_003n + BigInt(pairBaseIndex);
    const sourcePersona = generatePersona(`dataset:${seed}:persona:${personaIndex}`);
    const sourceIntent = INTENTS[(pairBaseIndex % INTENTS.length + Math.floor(pairBaseIndex / INTENTS.length) * 11) % INTENTS.length] === 'unknown' ? 'connect' : INTENTS[(pairBaseIndex % INTENTS.length + Math.floor(pairBaseIndex / INTENTS.length) * 11) % INTENTS.length];
    const sourceWorld = normalizedWorld(generateWorld(`dataset:${seed}:world:${pairBaseIndex}`, sourcePersona), sourceIntent, pairBaseIndex);
    const sourceGoal = goalFor(sourceWorld, sourceIntent, sourcePersona, sourceSeed);
    const sourceRaw = executeGoal({ persona: sourcePersona, world: sourceWorld, goal: sourceGoal, seed: `dataset:${sourceSeed}` });
    const replacement = makeCounterfactualPair({ rawGesture: sourceRaw, world: sourceWorld, goal: sourceGoal }, `dataset-hard:${seed}:${pairBaseIndex}`);
    if (pairRole === 'source') { raw = sourceRaw; goal = sourceGoal; Object.assign(world, sourceWorld); }
    else {
      raw = replacement.rawGesture; goal = replacement.goal;
      const replacementWorld = normalizedWorld(replacement.world, replacement.goal.intent, index);
      replacementWorld.runtime_context.canvas_mode = sourceWorld.runtime_context.canvas_mode === 'edit' ? 'annotate' : 'edit';
      replacementWorld.runtime_context.active_tool = sourceWorld.runtime_context.active_tool === 'select' ? 'annotate' : 'select';
      Object.assign(world, replacementWorld);
    }
    const sourceSampleId = `gesture-${seed}-${String(pairBaseIndex).padStart(8, '0')}`;
    const replacementSampleId = `gesture-${seed}-${String(pairBaseIndex + personas).padStart(8, '0')}`;
    pair = { pair_id: `hard:${seed}:${personaIndex}:${Math.floor(hardRound / 2)}`, role: pairRole, source_sample_id: sourceSampleId, replacement_sample_id: replacementSampleId, geometry_distance: replacement.counterfactual.geometry_distance, geometry_threshold: replacement.counterfactual.geometry_threshold, mechanism: replacement.counterfactual.mechanism };
  }
  raw = templateTransform(raw, assignment.template_group);
  const geometry = deriveGeometry(raw);
  const modelInput = buildModelInputs({ strokes: raw.strokes, geometry, canvasContext: world.runtime_context, nodes: world.simulation.authority.nodes });
  const sampleId = `gesture-${seed}-${String(index).padStart(8, '0')}`;
  return Object.freeze({
    sample_id: sampleId, schema_version: 'gesture-dataset-record/1.0', generator_version: 'gesture-simulator/1.0', geometry_version: 'gesture-geometry/1.0', split: assignment.split,
    model_input: modelInput, raw_strokes: raw, derived_geometry: geometry, runtime_context: world.runtime_context, pre_state: publicCanvas(world.simulation.authority),
    simulator_provenance: { persona_id: persona.persona_id, persona_group: assignment.persona_group, world_group: assignment.world_group, template_group: assignment.template_group, mechanism_id: ambiguous ? 'executor-ambiguous-v1' : assignment.mechanism_id, sample_seed: String(sampleSeed), world_seed: worldSeed, scenario: world.simulation.scenario, authority: world.simulation.authority, attempt_intent: goal.intent, attempt_seed: `dataset:${sampleSeed}`, attempt_persona_seed: `dataset:${seed}:persona:${personaIndex}`, ambiguity },
    ground_truth: { family: assignment.split === 'ood' || ambiguous ? 'abstention' : goal.family, intent: assignment.split === 'ood' || ambiguous ? 'unknown' : goal.intent, accepted: assignment.split !== 'ood' && !ambiguous && goal.accepted },
    quality_flags: { feasible: assignment.split !== 'ood', ood: assignment.split === 'ood', hard_counterfactual: Boolean(pair), incomplete: oodOutcome === 'incomplete', accidental: oodOutcome === 'miss', cancelled: oodOutcome === 'cancelled' || oodOutcome === 'release_failure', release_failure: oodOutcome === 'release_failure', ambiguous: Boolean(ambiguity), outcome: ambiguous ? 'ambiguous' : oodOutcome, pair },
  });
}

async function writeGzipJsonlAtomically(destination, records) {
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  const output = fs.createWriteStream(temporary, { flags: 'w' });
  const gzip = createGzip({ mtime: 0 }); gzip.pipe(output);
  try {
    for (const record of records) if (!gzip.write(jsonLine(record))) await once(gzip, 'drain');
    gzip.end(); await once(output, 'close'); await fsp.rename(temporary, destination);
  } catch (error) { gzip.destroy(); output.destroy(); await fsp.rm(temporary, { force: true }); throw error; }
}
function validateConfig(config) {
  const personas = Number(config.personas); const samples = Number(config.samples); const seed = Number(config.seed); const shardSize = Number(config.shardSize ?? MAX_SHARD_SIZE);
  if (!Number.isInteger(personas) || personas < 6) throw new RangeError('personas must be an integer of at least 6');
  if (!Number.isInteger(samples) || samples < 1) throw new RangeError('samples must be a positive integer');
  if (!Number.isSafeInteger(seed)) throw new RangeError('seed must be a safe integer');
  if (!Number.isInteger(shardSize) || shardSize < 1 || shardSize > MAX_SHARD_SIZE) throw new RangeError(`shardSize must be an integer from 1 to ${MAX_SHARD_SIZE}`);
  return { personas, samples, seed, shardSize };
}
const gzipBytes = records => gzipSync(Buffer.from(records.map(jsonLine).join('')), { mtime: 0 });
async function fileMatches(file, expected) { try { return Buffer.compare(await fsp.readFile(file), expected) === 0; } catch { return false; } }

/** Generates bounded gzip shards; existing matching shards are retained for safe resume. */
export async function generateDataset(config) {
  if (typeof config.dir !== 'string' || config.dir === '') throw new TypeError('dir is required');
  const normalized = validateConfig(config); const directory = path.resolve(config.dir); const shardDirectory = path.join(directory, 'shards');
  await fsp.mkdir(shardDirectory, { recursive: true });
  const splits = emptySplitGroups(); const shards = []; const intent_distribution = Object.fromEntries(INTENTS.map(intent => [intent, 0]));
  for (let start = 0, shardIndex = 0; start < normalized.samples; start += normalized.shardSize, shardIndex++) {
    const end = Math.min(normalized.samples, start + normalized.shardSize); const relativePath = `shards/shard-${String(shardIndex).padStart(5, '0')}.jsonl.gz`; const destination = path.join(directory, relativePath); const records = [];
    for (let index = start; index < end; index++) { const record = sampleRecord({ index, seed: normalized.seed, personas: normalized.personas }); records.push(record); intent_distribution[record.ground_truth.intent]++; addSplitMembership(splits, { ...record.simulator_provenance, split: record.split }, record.sample_id); }
    const expected = gzipBytes(records); if (!(await fileMatches(destination, expected))) await writeGzipJsonlAtomically(destination, records);
    shards.push({ path: relativePath, sha256: sha256(await fsp.readFile(destination)), records: end - start, seed_range: { start: String(BigInt(normalized.seed) * 1_000_003n + BigInt(start)), end_exclusive: String(BigInt(normalized.seed) * 1_000_003n + BigInt(end)) } });
  }
  // A successful smaller regeneration removes only stale generated shard files.
  const expectedPaths = new Set(shards.map(shard => shard.path));
  for (const name of await fsp.readdir(shardDirectory)) if (name.endsWith('.jsonl.gz') && !expectedPaths.has(`shards/${name}`)) await fsp.rm(path.join(shardDirectory, name), { force: true });
  return Object.freeze({ directory, configuration: normalized, shards, splits: normalizeSplitMembership(splits), intent_distribution, hashes: await sourceHashes() });
}
