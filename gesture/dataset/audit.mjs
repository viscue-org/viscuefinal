import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createGunzip } from 'node:zlib';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createSourceManifest } from '../../scripts/source-manifest.mjs';
import { validateRawGesture, validateRuntimeContext } from '../shared/schema.mjs';
import { FORBIDDEN_FEATURE_KEYS } from '../shared/contracts.mjs';
import { FAMILIES, FAMILY_BY_INTENT, INTENTS } from '../shared/taxonomy.mjs';
import { GEOMETRY_FEATURE_NAMES, deriveGeometry } from '../shared/geometry.mjs';
import { feasibleIntents } from '../simulator/feasibility.mjs';
import { executeGoal } from '../simulator/executors.mjs';
import { generatePersona } from '../simulator/personas.mjs';
import { verifyManifest, writeJsonAtomically } from './manifest.mjs';

export const MAX_SHARD_SIZE = 1000;
export const DEFAULT_NEAR_INDEX_LIMIT_PER_SPLIT = 4000;
const RECORD_KEYS = Object.freeze(['sample_id', 'schema_version', 'generator_version', 'geometry_version', 'split', 'model_input', 'raw_strokes', 'derived_geometry', 'runtime_context', 'pre_state', 'simulator_provenance', 'ground_truth', 'quality_flags']);
const MODEL_KEYS = Object.freeze(['sequence', 'sequence_mask', 'stroke_mask', 'geometry', 'nodes', 'node_mask', 'context', 'shapes']);
const PROVENANCE_KEYS = Object.freeze(['persona_id', 'persona_group', 'world_group', 'template_group', 'mechanism_id', 'sample_seed', 'world_seed', 'scenario', 'authority', 'attempt_intent', 'attempt_seed', 'attempt_persona_seed', 'ambiguity']);
const QUALITY_KEYS = Object.freeze(['feasible', 'ood', 'hard_counterfactual', 'incomplete', 'accidental', 'cancelled', 'release_failure', 'ambiguous', 'outcome', 'pair']);
const SHAPES = Object.freeze({ sequence: [4, 128, 7], geometry: [48], nodes: [32, 14], context: [24] });
const forbidden = new Set([...FORBIDDEN_FEATURE_KEYS, 'persona', 'provenance', 'seed', 'world_seed', 'mechanism_id', 'quality_flags']);
const protectedSplits = new Set(['validation', 'test', 'hard_counterfactual', 'template_holdout', 'ood']);
const sha256 = value => createHash('sha256').update(Buffer.isBuffer(value) || typeof value === 'string' ? value : (JSON.stringify(value) ?? '')).digest('hex');
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const geometryDistance = (left, right) => Math.sqrt(GEOMETRY_FEATURE_NAMES.reduce((sum, key) => sum + (Number(left?.[key]) - Number(right?.[key])) ** 2, 0));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const addUnique = (findings, finding) => { if (!findings.includes(finding)) findings.push(finding); };
const exactKeys = (value, expected, label, findings) => {
  if (!isObject(value)) { findings.push(`${label} must be an object`); return false; }
  const allowed = new Set(expected);
  for (const key of Object.keys(value)) if (!allowed.has(key)) findings.push(`${label}.${key} is not allowed`);
  for (const key of expected) if (!Object.hasOwn(value, key)) findings.push(`${label}.${key} is required`);
  return true;
};
function recursiveForbidden(value, prefix = 'model_input') {
  const findings = [];
  if (!value || typeof value !== 'object') return findings;
  for (const [key, child] of Object.entries(value)) { const location = `${prefix}.${key}`; if (forbidden.has(key)) findings.push(`forbidden key found in model_input: ${location}`); findings.push(...recursiveForbidden(child, location)); }
  return findings;
}
function walkTensor(value, shape, label, findings, depth = 0) {
  if (!Array.isArray(value) || value.length !== shape[depth]) { findings.push(`${label} shape mismatch; expected [${shape.join(',')}]`); return; }
  if (depth === shape.length - 1) { for (const item of value) if (!finite(item)) findings.push(`${label} contains non-finite tensor values`); }
  else value.forEach(item => walkTensor(item, shape, label, findings, depth + 1));
}
function walkMask(value, shape, label, findings) {
  walkTensor(value, shape, label, findings);
  const check = item => Array.isArray(item) ? item.forEach(check) : (item !== 0 && item !== 1 ? findings.push(`${label} must contain only binary mask values`) : undefined);
  if (Array.isArray(value)) check(value);
}
function validateModelInput(input, findings, id) {
  const label = `model_input for ${id}`; if (!exactKeys(input, MODEL_KEYS, label, findings)) return;
  for (const [key, shape] of Object.entries(SHAPES)) walkTensor(input[key], shape, `${label}.${key}`, findings);
  walkMask(input.sequence_mask, [4, 128], `${label}.sequence_mask`, findings); walkMask(input.stroke_mask, [4], `${label}.stroke_mask`, findings); walkMask(input.node_mask, [32], `${label}.node_mask`, findings);
  if (!exactKeys(input.shapes, Object.keys(SHAPES), `${label}.shapes`, findings)) return;
  for (const [key, shape] of Object.entries(SHAPES)) if (JSON.stringify(input.shapes[key]) !== JSON.stringify(shape)) findings.push(`${label}.shapes.${key} does not match the fixed tensor shape`);
}
function validateGeometry(geometry, findings, id) {
  if (!exactKeys(geometry, GEOMETRY_FEATURE_NAMES, `derived_geometry for ${id}`, findings)) return;
  for (const key of GEOMETRY_FEATURE_NAMES) if (!(typeof geometry[key] === 'boolean' || finite(geometry[key]))) findings.push(`derived_geometry.${key} must be finite: ${id}`);
}
function validatePreState(state, findings, id) {
  if (!exactKeys(state, ['nodes', 'edges', 'object_order_count'], `pre_state for ${id}`, findings)) return;
  if (!Array.isArray(state.nodes) || state.nodes.length > 32) findings.push(`pre_state.nodes is invalid: ${id}`);
  for (const node of state.nodes ?? []) { if (!exactKeys(node, ['type', 'position', 'width', 'height', 'selected', 'data'], `pre_state node for ${id}`, findings)) continue; if (typeof node.type !== 'string' || !isObject(node.position) || !finite(node.position.x) || !finite(node.position.y) || !finite(node.width) || !finite(node.height) || typeof node.selected !== 'boolean') findings.push(`pre_state node geometry is invalid: ${id}`); }
  if (!Array.isArray(state.edges) || state.edges.some(edge => !exactKeys(edge, ['type'], `pre_state edge for ${id}`, findings) || typeof edge.type !== 'string')) findings.push(`pre_state.edges is invalid: ${id}`);
  if (!Number.isInteger(state.object_order_count) || state.object_order_count < 0) findings.push(`pre_state.object_order_count is invalid: ${id}`);
}
function validateRecord(record, findings) {
  const id = typeof record?.sample_id === 'string' ? record.sample_id : 'record'; if (!exactKeys(record, RECORD_KEYS, `record ${id}`, findings)) return;
  if (record.schema_version !== 'gesture-dataset-record/1.0') findings.push(`record contract version is unsupported: ${id}`);
  for (const key of ['sample_id', 'generator_version', 'geometry_version', 'split']) if (typeof record[key] !== 'string' || record[key] === '') findings.push(`record ${id}.${key} must be a non-empty string`);
  validateModelInput(record.model_input, findings, id); const raw = validateRawGesture(record.raw_strokes); if (!raw.ok) findings.push(`invalid raw gesture ${id}: ${raw.error}`); const context = validateRuntimeContext(record.runtime_context); if (!context.ok) findings.push(`invalid runtime context ${id}: ${context.error}`); validateGeometry(record.derived_geometry, findings, id); validatePreState(record.pre_state, findings, id);
  if (!exactKeys(record.simulator_provenance, PROVENANCE_KEYS, `simulator_provenance for ${id}`, findings)) return;
  for (const key of ['persona_id', 'persona_group', 'world_group', 'template_group', 'mechanism_id', 'sample_seed', 'world_seed']) if (typeof record.simulator_provenance[key] !== 'string' || record.simulator_provenance[key] === '') findings.push(`simulator_provenance.${key} is required for ${id}`);
  if (!isObject(record.simulator_provenance.scenario) || typeof record.simulator_provenance.scenario.kind !== 'string') findings.push(`simulator_provenance.scenario is invalid: ${id}`); if (!isObject(record.simulator_provenance.authority) || !Array.isArray(record.simulator_provenance.authority.nodes)) findings.push(`simulator_provenance.authority is invalid: ${id}`); if (record.simulator_provenance.ambiguity !== null && !exactKeys(record.simulator_provenance.ambiguity, ['candidate_a_intent', 'candidate_a_seed', 'candidate_b_intent', 'candidate_b_seed'], `simulator_provenance.ambiguity for ${id}`, findings)) findings.push(`simulator_provenance.ambiguity is invalid: ${id}`);
  if (!exactKeys(record.ground_truth, ['family', 'intent', 'accepted'], `ground_truth for ${id}`, findings)) return; if (!INTENTS.includes(record.ground_truth.intent) || !FAMILIES.includes(record.ground_truth.family) || typeof record.ground_truth.accepted !== 'boolean' || (record.ground_truth.intent !== 'unknown' && record.ground_truth.family !== FAMILY_BY_INTENT[record.ground_truth.intent])) findings.push(`ground_truth does not match the taxonomy: ${id}`);
  if (!exactKeys(record.quality_flags, QUALITY_KEYS, `quality_flags for ${id}`, findings)) return; for (const key of QUALITY_KEYS.slice(0, 8)) if (typeof record.quality_flags[key] !== 'boolean') findings.push(`quality_flags.${key} must be boolean: ${id}`); if (!['complete', 'incomplete', 'miss', 'cancelled', 'release_failure', 'ambiguous'].includes(record.quality_flags.outcome)) findings.push(`quality_flags.outcome is unsupported: ${id}`); if (record.quality_flags.pair !== null && !exactKeys(record.quality_flags.pair, ['pair_id', 'role', 'source_sample_id', 'replacement_sample_id', 'geometry_distance', 'geometry_threshold', 'mechanism'], `quality_flags.pair for ${id}`, findings)) findings.push(`quality_flags.pair is invalid: ${id}`);
}
function sampledVector(points, length = 16) { if (!points.length) return null; return Array.from({ length }, (_, index) => { const point = points[Math.round(index * (points.length - 1) / Math.max(1, length - 1))]; return [Number(point.x), Number(point.y)]; }).flat(); }
function numericVector(value, limit = 48) { const result = []; const visit = item => { if (result.length >= limit || item === null || item === undefined) return; if (typeof item === 'number' && Number.isFinite(item)) result.push(item); else if (Array.isArray(item)) item.forEach(visit); else if (isObject(item)) Object.values(item).forEach(visit); }; visit(value); return result.length ? result : null; }
function vectorDistance(left, right) { if (!left || !right || left.length !== right.length) return Infinity; return Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0) / left.length); }
function lshKeys(vector, scale) { const left = vector.slice(0, 8); const right = vector.slice(-8); const middle = vector.filter((_, index) => index % 2 === 0).slice(0, 8); return [left, right, middle].flatMap((projection, projectionIndex) => [0, 0.5].map(offset => `${projectionIndex}:${projection.map(value => Math.floor(value * scale + offset)).join(':')}`)); }
function vectorsFor(record) { const points = record?.raw_strokes?.strokes?.flatMap(stroke => stroke.points ?? []) ?? []; return { raw: sampledVector(points), features: numericVector({ geometry: record.model_input?.geometry, context: record.model_input?.context, nodes: record.model_input?.nodes }), canvas: numericVector(record.pre_state) }; }
function recordNearHit(state, kind, prior, record, distance) {
  state.near_duplicate_totals[kind]++; state.near_duplicate_total += kind === 'raw' ? 1 : 0;
  if (prior.split !== record.split) state.nearConcentration.protectedCrossSplit[kind]++;
  const classKey = `${prior.intent}->${record.ground_truth?.intent}`; state.nearConcentration.perClass[classKey] = (state.nearConcentration.perClass[classKey] ?? 0) + 1;
  if (state.near_duplicate_candidates.length < 100) state.near_duplicate_candidates.push({ kind, first: prior.sampleId, second: record.sample_id, distance });
}
function registerNear(state, kind, vector, record, limit, indexCurrent) {
  if (!vector) return; const scale = kind === 'raw' ? 64 : 32; const threshold = kind === 'features' ? 0.001 : limit; const map = state.near[kind]; const pairId = record.quality_flags?.pair?.pair_id ?? null; const current = { sampleId: record.sample_id, split: record.split, intent: record.ground_truth?.intent, pairId, vector }; const keys = lshKeys(vector, scale); const candidates = new Map();
  for (const key of keys) for (const prior of map.get(key) ?? []) { const distance = vectorDistance(vector, prior.vector); const existing = candidates.get(prior.sampleId); if (distance <= threshold && (!existing || distance < existing.distance)) candidates.set(prior.sampleId, { prior, distance }); }
  for (const { prior, distance } of candidates.values()) { const samePair = pairId !== null && prior.pairId === pairId && record.split === 'hard_counterfactual' && prior.split === 'hard_counterfactual'; if (samePair) state.pendingPairNear.push({ kind, prior, record, distance }); else recordNearHit(state, kind, prior, record, distance); }
  if (!indexCurrent) return;
  for (const key of keys) { const list = map.get(key) ?? []; if (list.length < 32) list.push(current); map.set(key, list); }
}
function createState(options = {}) { const nearIndexLimitPerSplit = Number.isInteger(options.nearIndexLimitPerSplit) && options.nearIndexLimitPerSplit >= 0 ? options.nearIndexLimitPerSplit : DEFAULT_NEAR_INDEX_LIMIT_PER_SPLIT; return { count: 0, blocking_findings: [], warnings: [], seenIds: new Map(), seenRaw: new Map(), seenFeatures: new Map(), seenCanvas: new Map(), near: { raw: new Map(), features: new Map(), canvas: new Map() }, nearIndexLimitPerSplit, nearIndexedBySplit: new Map(), pendingPairNear: [], pendingPairExact: [], near_duplicate_total: 0, near_duplicate_totals: { raw: 0, features: 0, canvas: 0 }, near_duplicate_candidates: [], nearConcentration: { protectedCrossSplit: { raw: 0, features: 0, canvas: 0 }, perClass: {} }, groups: new Map(), actualGroups: new Map(), labelsByProvenance: new Map(), hardPairs: new Map(), actualMembership: new Map(), splitCounts: new Map(), intentCounts: new Map(), coverage: { intents: new Set(), devices: new Set(), tools: new Set(), splits: new Set(), scenarios: new Set(), canvases: new Set(), selected: new Set(), bindings: new Set(), edges: new Set(), orders: new Set(), contexts: new Set(), mechanisms: new Set() }, featureStats: new Map() }; }
function reserveNearIndexRecord(state, record) { const split = typeof record?.split === 'string' ? record.split : 'invalid'; const count = state.nearIndexedBySplit.get(split) ?? 0; if (count >= state.nearIndexLimitPerSplit) return false; state.nearIndexedBySplit.set(split, count + 1); return true; }
function endpoint(record) { const points = record?.raw_strokes?.strokes?.flatMap(stroke => stroke.points ?? []) ?? []; return points.at(-1) ?? null; }
function scheduledAttemptIntent(record) {
  const match = /^gesture-.*-(\d+)$/.exec(String(record?.sample_id ?? '')); if (!match) return null;
  const index = Number(match[1]); if (!Number.isSafeInteger(index)) return null;
  const scheduled = INTENTS[(index % INTENTS.length + Math.floor(index / INTENTS.length) * 11) % INTENTS.length];
  return scheduled === 'unknown' && record.split !== 'train' ? 'connect' : scheduled;
}
function expectedRaw(record) {
  const provenance = record?.simulator_provenance;
  if (!provenance?.attempt_intent || !provenance?.attempt_persona_seed || !provenance?.attempt_seed || !provenance?.authority) return null;
  try {
    const scheduled = scheduledAttemptIntent(record); if (record.split === 'ood' && scheduled !== provenance.attempt_intent) return null;
    const persona = generatePersona(provenance.attempt_persona_seed); if (persona.persona_id !== provenance.persona_id) return null;
    return executeGoal({ persona, world: { runtime_context: record.runtime_context, simulation: { authority: provenance.authority, scenario: provenance.scenario } }, goal: { intent: provenance.attempt_intent, family: FAMILY_BY_INTENT[provenance.attempt_intent], accepted: true }, seed: provenance.attempt_seed });
  } catch { return null; }
}
function expectedAmbiguity(record) {
  const provenance = record?.simulator_provenance; const pair = provenance?.ambiguity;
  if (!pair || pair.candidate_a_intent === pair.candidate_b_intent || pair.candidate_a_seed === pair.candidate_b_seed) return null;
  if (![pair.candidate_a_intent, pair.candidate_b_intent].every(intent => INTENTS.includes(intent) && intent !== 'unknown')) return null;
  try {
    const persona = generatePersona(provenance.attempt_persona_seed); if (persona.persona_id !== provenance.persona_id) return null;
    const world = { runtime_context: record.runtime_context, simulation: { authority: provenance.authority, scenario: provenance.scenario } };
    const make = (intent, seed) => executeGoal({ persona, world, goal: { intent, family: FAMILY_BY_INTENT[intent], accepted: true }, seed });
    const first = make(pair.candidate_a_intent, pair.candidate_a_seed); const second = make(pair.candidate_b_intent, pair.candidate_b_seed);
    return first.strokes.length <= 2 && second.strokes.length <= 2 ? { first, second } : null;
  } catch { return null; }
}
function strokeEvidenceHash(stroke) { return sha256({ pointer_type: stroke?.pointer_type, cancelled: stroke?.cancelled, points: (stroke?.points ?? []).map(point => ({ x: point.x, y: point.y, pressure: point.pressure })) }); }
function ambiguityEvidence(record) {
  const expected = expectedAmbiguity(record); if (!expected) return false;
  const actual = new Set((record.raw_strokes?.strokes ?? []).map(strokeEvidenceHash));
  return expected.first.strokes.every(stroke => actual.has(strokeEvidenceHash(stroke))) && expected.second.strokes.every(stroke => actual.has(strokeEvidenceHash(stroke)));
}
function outcomeEvidence(record) {
  const strokes = record.raw_strokes?.strokes ?? []; const points = strokes.flatMap(stroke => stroke.points ?? []); const first = points[0]; const last = points.at(-1); const cancelled = strokes.some(stroke => stroke.cancelled === true);
  const expected = expectedRaw(record); const expectedPoints = expected?.strokes?.flatMap(stroke => stroke.points ?? []) ?? []; const expectedLast = expectedPoints.at(-1); const endpointError = expectedLast && last ? Math.hypot(last.x - expectedLast.x, last.y - expectedLast.y) : Infinity;
  const truncated = Boolean(expectedPoints.length >= 4 && points.length <= expectedPoints.length * 0.72);
  return { cancelled, pointCount: points.length, incomplete: !cancelled && truncated, miss: !cancelled && Boolean(expectedRaw(record)) && endpointError > 0.025, release_failure: cancelled && points.length > 1 };
}
function processRecord(record, state) {
  state.count++; validateRecord(record, state.blocking_findings); for (const finding of recursiveForbidden(record?.model_input)) addUnique(state.blocking_findings, finding); const id = record?.sample_id; if (typeof id !== 'string' || id === '') return; if (state.seenIds.has(id)) addUnique(state.blocking_findings, `duplicate sample_id: ${id}`); else state.seenIds.set(id, id);
  const provenance = record.simulator_provenance ?? {}; const split = record.split; const intent = record.ground_truth?.intent; if (typeof split === 'string') { state.coverage.splits.add(split); state.splitCounts.set(split, (state.splitCounts.get(split) ?? 0) + 1); if (!state.actualMembership.has(split)) state.actualMembership.set(split, new Set()); state.actualMembership.get(split).add(id); } if (typeof intent === 'string') { state.coverage.intents.add(intent); state.intentCounts.set(intent, (state.intentCounts.get(intent) ?? 0) + 1); }
  if (typeof record.runtime_context?.pointer_type === 'string') state.coverage.devices.add(record.runtime_context.pointer_type); if (typeof record.runtime_context?.active_tool === 'string') state.coverage.tools.add(record.runtime_context.active_tool); state.coverage.mechanisms.add(provenance.mechanism_id); state.coverage.scenarios.add(provenance.scenario?.kind ?? 'missing'); state.coverage.canvases.add(record.runtime_context?.canvas_mode ?? 'missing'); state.coverage.selected.add(String(record.runtime_context?.selected_node_count)); state.coverage.bindings.add(`${record.runtime_context?.instruction_binding_count}:${record.runtime_context?.reference_binding_count}`); state.coverage.edges.add(String(record.runtime_context?.graph_edge_count)); state.coverage.orders.add(String(record.runtime_context?.object_order_count)); state.coverage.contexts.add(String(record.runtime_context?.nearby_nodes?.length));
  const ambiguous = split === 'train' && intent === 'unknown'; const expectedMechanism = split === 'template_holdout' ? 'executor-template-holdout-v1' : split === 'ood' ? 'executor-ood-v1' : ambiguous ? 'executor-ambiguous-v1' : 'executor-core-v1'; if (provenance.mechanism_id !== expectedMechanism) addUnique(state.blocking_findings, `mechanism_id does not match execution for ${id}`); if (split === 'ood' && provenance.scenario?.kind !== 'ood') addUnique(state.blocking_findings, `OOD split is not an OOD scenario: ${id}`); if (ambiguous) { if (provenance.scenario?.kind !== 'ambiguous' || record.ground_truth?.accepted !== false || record.quality_flags?.ambiguous !== true || record.quality_flags?.ood === true || record.quality_flags?.cancelled === true || record.quality_flags?.outcome !== 'ambiguous' || !ambiguityEvidence(record)) addUnique(state.blocking_findings, `ordinary unknown row has inconsistent ambiguity evidence: ${id}`); } else if (protectedSplits.has(split) && split !== 'ood' && provenance.scenario?.kind !== 'ordinary') addUnique(state.blocking_findings, `protected ordinary split has a non-ordinary scenario: ${id}`);
  for (const [kind, value] of [['persona', provenance.persona_group], ['world', provenance.world_group], ['template', provenance.template_group]]) if (typeof value === 'string') { const key = `${kind}:${value}`; const prior = state.groups.get(key); if (prior && prior !== split) addUnique(state.blocking_findings, `${kind} group overlap across protected splits: ${value}`); else state.groups.set(key, split); if (!state.actualGroups.has(split)) state.actualGroups.set(split, { persona: new Set(), world: new Set(), template: new Set() }); state.actualGroups.get(split)[kind].add(value); }
  const pair = record.quality_flags?.pair; if (pair !== null && split !== 'hard_counterfactual') addUnique(state.blocking_findings, `pair metadata is only allowed in hard_counterfactual: ${id}`); if (split === 'hard_counterfactual') { if (!pair || typeof pair.pair_id !== 'string' || !['source', 'replacement'].includes(pair.role)) addUnique(state.blocking_findings, `hard counterfactual row lacks a real pair: ${id}`); else { if (!state.hardPairs.has(pair.pair_id)) state.hardPairs.set(pair.pair_id, []); state.hardPairs.get(pair.pair_id).push({ id, role: pair.role, source_sample_id: pair.source_sample_id, replacement_sample_id: pair.replacement_sample_id, intent, geometry: record.derived_geometry, rawHash: sha256(record.raw_strokes), contextHash: sha256(record.runtime_context), threshold: pair.geometry_threshold, distance: pair.geometry_distance }); } }
  const evidence = outcomeEvidence(record); if (split === 'ood') { const outcome = record.quality_flags?.outcome; const objective = outcome === 'incomplete' ? evidence.incomplete : outcome === 'miss' ? evidence.miss : outcome === 'cancelled' ? evidence.cancelled : outcome === 'release_failure' ? evidence.release_failure : false; if (intent !== 'unknown' || record.ground_truth?.accepted !== false || !objective) addUnique(state.blocking_findings, `OOD split lacks real failure outcomes: ${id}`); }
  if (split === 'template_holdout') { const expected = expectedRaw(record); const actualPoints = record.raw_strokes?.strokes?.flatMap(stroke => stroke.points ?? []) ?? []; const expectedPoints = expected?.strokes?.flatMap(stroke => stroke.points ?? []) ?? []; const changed = actualPoints.length === expectedPoints.length && actualPoints.some((point, index) => index > 0 && index < actualPoints.length - 1 && Math.hypot(point.x - expectedPoints[index].x, point.y - expectedPoints[index].y) > 1e-5); if (!changed) addUnique(state.blocking_findings, `template holdout mechanism has no executed endpoint-preserving transform: ${id}`); }
  const pairId = pair?.pair_id ?? null; const rawHash = sha256(record.raw_strokes); const featureHash = sha256(record.model_input); const canvasHash = sha256(record.pre_state); const priorRaw = state.seenRaw.get(rawHash); if (priorRaw) { const samePair = pairId !== null && priorRaw.pairId === pairId && split === 'hard_counterfactual' && priorRaw.split === 'hard_counterfactual'; if (samePair) state.pendingPairExact.push({ kind: 'raw', pairId, first: priorRaw.sampleId, second: id }); else addUnique(state.blocking_findings, `exact raw duplicate: ${id} and ${priorRaw.sampleId}`); } else state.seenRaw.set(rawHash, { sampleId: id, pairId, split }); const priorFeature = state.seenFeatures.get(featureHash); if (priorFeature) addUnique(state.blocking_findings, `exact feature duplicate: ${id} and ${priorFeature}`); else state.seenFeatures.set(featureHash, id); const priorCanvas = state.seenCanvas.get(canvasHash); if (priorCanvas) { const samePair = pairId !== null && priorCanvas.pairId === pairId && split === 'hard_counterfactual' && priorCanvas.split === 'hard_counterfactual'; if (samePair) state.pendingPairExact.push({ kind: 'canvas', pairId, first: priorCanvas.sampleId, second: id }); else addUnique(state.blocking_findings, `duplicate canvas state: ${id} and ${priorCanvas.sampleId}`); } else state.seenCanvas.set(canvasHash, { sampleId: id, pairId, split });
  const vectors = vectorsFor(record); const indexNear = reserveNearIndexRecord(state, record); registerNear(state, 'raw', vectors.raw, record, 0.003, indexNear); registerNear(state, 'features', vectors.features, record, 0.003, indexNear); registerNear(state, 'canvas', vectors.canvas, record, 0.004, indexNear);
  for (const value of [provenance.persona_group, provenance.template_group, provenance.mechanism_id]) if (typeof value === 'string') { const key = `metadata:${value}`; if (!state.labelsByProvenance.has(key)) state.labelsByProvenance.set(key, { count: 0, labels: new Set() }); state.labelsByProvenance.get(key).count++; state.labelsByProvenance.get(key).labels.add(intent); }
  if (record.raw_strokes && record.derived_geometry) try { const recomputed = deriveGeometry(record.raw_strokes); for (const key of GEOMETRY_FEATURE_NAMES) if (Math.abs(Number(recomputed[key]) - Number(record.derived_geometry[key])) > 1e-6) { addUnique(state.blocking_findings, `derived geometry mismatch: ${id}.${key}`); break; } if (Array.isArray(record.model_input?.geometry) && GEOMETRY_FEATURE_NAMES.some((key, index) => Math.abs(Number(record.model_input.geometry[index]) - Number(recomputed[key])) > 1e-6)) addUnique(state.blocking_findings, `model_input geometry mismatch: ${id}`); } catch (error) { addUnique(state.blocking_findings, `cannot recompute geometry ${id}: ${error.message}`); }
  const authority = provenance.authority; if (authority && record.runtime_context && intent && intent !== 'unknown') try { if (!feasibleIntents({ runtime_context: record.runtime_context, simulation: { authority, scenario: provenance.scenario } }).includes(intent)) addUnique(state.blocking_findings, `impossible intent/world combination: ${id}`); } catch { addUnique(state.blocking_findings, `invalid feasibility authority: ${id}`); }
  const representative = [
    ...(record.model_input?.geometry ?? []).slice(0, 8),
    ...(record.model_input?.sequence?.[0]?.slice(0, 4)?.flat() ?? []).slice(0, 8),
    ...(record.model_input?.nodes?.slice(0, 3)?.flat() ?? []).slice(0, 8),
    ...(record.model_input?.context ?? []).slice(0, 8),
  ];
  for (const [index, value] of representative.entries()) if (typeof value === 'number' && Number.isFinite(value)) { const key = `representative:${index}:${Number(value).toFixed(4)}`; if (!state.featureStats.has(key)) state.featureStats.set(key, { count: 0, labels: new Set() }); state.featureStats.get(key).count++; state.featureStats.get(key).labels.add(intent); }
}
function finalizeState(state) {
  const validPairIds = new Set();
  for (const [pairId, rows] of state.hardPairs) { if (rows.length !== 2) { addUnique(state.blocking_findings, `hard counterfactual pair is incomplete: ${pairId}`); continue; } const source = rows.find(row => row.role === 'source'); const replacement = rows.find(row => row.role === 'replacement'); const measured = source && replacement ? geometryDistance(source.geometry, replacement.geometry) : Infinity; const valid = source && replacement && source.intent !== replacement.intent && source.contextHash !== replacement.contextHash && source.source_sample_id === source.id && replacement.source_sample_id === source.id && source.replacement_sample_id === replacement.id && replacement.replacement_sample_id === replacement.id && Number.isFinite(measured) && measured <= 0.001 && source.distance <= source.threshold && replacement.distance <= replacement.threshold && Math.abs(source.distance - measured) <= 1e-6 && Math.abs(replacement.distance - measured) <= 1e-6; if (!valid) { addUnique(state.blocking_findings, `hard counterfactual pair lacks consistent source/replacement semantics: ${pairId}`); addUnique(state.blocking_findings, `hard counterfactual geometry is not similar: ${pairId}`); } else validPairIds.add(pairId); }
  for (const pending of state.pendingPairExact) if (!validPairIds.has(pending.pairId)) addUnique(state.blocking_findings, `invalid hard pair cannot suppress ${pending.kind} duplicate: ${pending.first} and ${pending.second}`);
  for (const pending of state.pendingPairNear) if (!validPairIds.has(pending.record.quality_flags?.pair?.pair_id)) recordNearHit(state, pending.kind, pending.prior, pending.record, pending.distance);
  if (state.blocking_findings.some(finding => /group overlap/.test(finding))) addUnique(state.blocking_findings, 'suspicious metadata-only shortcut due to protected group overlap'); const repeated = [...state.labelsByProvenance.values()].filter(value => value.count >= 3); if (repeated.length && repeated.filter(value => value.labels.size === 1).length / repeated.length > 0.95) addUnique(state.blocking_findings, 'suspicious metadata-only shortcut: a repeated simulator field determines intent'); if (state.count >= INTENTS.length) for (const intent of INTENTS) if (!state.coverage.intents.has(intent)) addUnique(state.blocking_findings, `missing taxonomy coverage: ${intent}`);
  if (state.count >= 30) { for (const device of ['mouse', 'touch', 'stylus']) if (!state.coverage.devices.has(device)) addUnique(state.blocking_findings, `missing device coverage: ${device}`); for (const tool of ['select', 'annotate']) if (!state.coverage.tools.has(tool)) addUnique(state.blocking_findings, `missing tool coverage: ${tool}`); }
  if (state.count >= 1000 && (state.coverage.canvases.size < 2 || state.coverage.selected.size < 2 || state.coverage.bindings.size < 2 || state.coverage.edges.size < 2 || state.coverage.orders.size < 2 || state.coverage.contexts.size < 2)) addUnique(state.blocking_findings, 'runtime context coverage collapsed to one value');
  const representativeLimit = Math.max(5, Math.floor(state.count * 0.2)); for (const [key, stat] of state.featureStats) if (stat.count >= representativeLimit && stat.labels.size === 1) addUnique(state.blocking_findings, `suspicious class-specific one-field shortcut: ${key}`); if (state.near_duplicate_total / Math.max(1, state.count) > 0.02) state.warnings.push('near-duplicate raw sequence rate requires investigation');
  for (const kind of ['raw', 'features', 'canvas']) if (state.nearConcentration.protectedCrossSplit[kind] >= Math.max(4, Math.floor(state.count * 0.005))) state.warnings.push(`near-duplicate ${kind} concentration crosses protected splits`);
  const membershipSummary = Object.fromEntries([...state.actualMembership].map(([split, ids]) => [split, { count: ids.size, sha256: sha256([...ids].sort().join('\n')) }]));
  const groupSummary = Object.fromEntries([...state.actualGroups].map(([split, groups]) => [split, Object.fromEntries(Object.entries(groups).map(([kind, values]) => [kind, { count: values.size, sha256: sha256([...values].sort().join('\n')) }]))]));
  const concentrationEntries = Object.entries(state.nearConcentration.perClass).sort((left, right) => right[1] - left[1]);
  if (concentrationEntries.some(([, count]) => count >= Math.max(50, Math.floor(state.count * 0.005)))) state.warnings.push('near-duplicate class concentration requires disposition');
  const sampledBySplit = Object.fromEntries([...state.nearIndexedBySplit].sort()); const sampledRecords = Object.values(sampledBySplit).reduce((sum, count) => sum + count, 0);
  return { schema_version: 'audit-report/1.0', record_count: state.count, blocking_findings: state.blocking_findings, warnings: state.warnings, warning_dispositions: state.warnings.map(warning => ({ warning, status: 'machine-checkable-review-required', protected_cross_split: true })), near_index: { strategy: 'deterministic-stratified-bounded-lsh', limit_per_split: state.nearIndexLimitPerSplit, sampled_records: sampledRecords, sampled_by_split: sampledBySplit, candidate_records: state.count, exact_duplicate_checks: 'exhaustive' }, near_duplicate_total: state.near_duplicate_total, near_duplicate_rate: state.near_duplicate_total / Math.max(1, state.count), near_duplicate_totals: state.near_duplicate_totals, near_duplicate_rates: Object.fromEntries(Object.entries(state.near_duplicate_totals).map(([kind, total]) => [kind, total / Math.max(1, state.count)])), near_duplicate_concentration: { protectedCrossSplit: state.nearConcentration.protectedCrossSplit, perClass: { total: concentrationEntries.reduce((sum, entry) => sum + entry[1], 0), top: Object.fromEntries(concentrationEntries.slice(0, 50)) } }, near_duplicate_candidates: state.near_duplicate_candidates, split_record_counts: Object.fromEntries([...state.splitCounts].sort()), coverage: { intents: [...state.coverage.intents].sort(), devices: [...state.coverage.devices].sort(), tools: [...state.coverage.tools].sort(), splits: [...state.coverage.splits].sort(), scenarios: [...state.coverage.scenarios].sort(), canvas_modes: [...state.coverage.canvases].sort(), selected_node_counts: [...state.coverage.selected].sort(), binding_counts: [...state.coverage.bindings].sort(), edge_counts: [...state.coverage.edges].sort(), object_order_counts: [...state.coverage.orders].sort(), nearby_node_counts: [...state.coverage.contexts].sort(), mechanisms: [...state.coverage.mechanisms].sort() }, intent_distribution: Object.fromEntries([...state.intentCounts].sort()), actual_membership_summary: membershipSummary, actual_groups_summary: groupSummary };
}
export function auditDataset(dataset, options = {}) { const state = createState(options); for (const record of Array.isArray(dataset?.records) ? dataset.records : []) processRecord(record, state); return finalizeState(state); }
export async function beginIncrementalAudit(manifestBytes, options = {}) {
  const bytes = Buffer.isBuffer(manifestBytes) ? manifestBytes : Buffer.from(manifestBytes);
  const manifest = JSON.parse(bytes.toString('utf8'));
  const state = createState(options);
  validateManifestShape(manifest, state.blocking_findings);
  const auditSourceTreeSha256 = await validateManifestSemantics(manifest, state.blocking_findings, options);
  return { manifest, manifestBytes: bytes, state, auditSourceTreeSha256 };
}
export function pushIncrementalRecord(session, record) { processRecord(record, session.state); }
export function finishIncrementalAudit(session, verifiedShardHashes) {
  const { manifest, manifestBytes, state } = session;
  if (state.count !== manifest.total_samples || manifest.configuration?.samples !== manifest.total_samples) addUnique(state.blocking_findings, 'manifest total sample count mismatch');
  compareManifestMembership(manifest, state);
  const expected = Object.fromEntries((manifest.shards ?? []).map(shard => [shard.path, shard.sha256]));
  if (JSON.stringify(verifiedShardHashes) !== JSON.stringify(expected)) addUnique(state.blocking_findings, 'verified shard hash map does not match the manifest');
  const report = finalizeState(state);
  report.dataset_manifest_sha256 = sha256(manifestBytes);
  report.shard_hashes = expected;
  report.audit_source_tree_sha256 = session.auditSourceTreeSha256;
  report.generation_source_tree_sha256 = manifest.generator?.source_tree_sha256 ?? null;
  return report;
}
async function streamShard(file, state) { let count = 0; let sawData = false; const input = createReadStream(file).pipe(createGunzip()); try { for await (const line of createInterface({ input, crlfDelay: Infinity })) { if (!line.trim()) continue; sawData = true; count++; try { processRecord(JSON.parse(line), state); } catch (error) { addUnique(state.blocking_findings, `invalid JSONL record in ${path.basename(file)}: ${error.message}`); } } } catch (error) { addUnique(state.blocking_findings, `cannot read shard ${path.basename(file)}: ${error.message}`); } if (!sawData) addUnique(state.blocking_findings, `shard is empty: ${path.basename(file)}`); return count; }
const setEqual = (actual, expected) => actual.size === expected.size && [...actual].every(value => expected.has(value));
function validateManifestShape(manifest, findings) {
  if (!exactKeys(manifest, ['schema_version', 'dataset_version', 'status', 'total_samples', 'configuration', 'generator', 'shards', 'splits', 'intent_distribution'], 'manifest', findings)) return;
  if (manifest.schema_version !== 'dataset-manifest/1.0') findings.push('manifest schema_version is unsupported');
  if (typeof manifest.dataset_version !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*-v[0-9]+$/.test(manifest.dataset_version)) findings.push('manifest dataset_version is invalid');
  if (manifest.status !== 'generated') findings.push('manifest status is invalid');
  if (!Number.isInteger(manifest.total_samples) || manifest.total_samples < 1) findings.push('manifest.total_samples is invalid');
  if (!exactKeys(manifest.configuration, ['personas', 'samples', 'seed', 'shardSize'], 'manifest.configuration', findings)) return;
  if (!Number.isInteger(manifest.configuration.personas) || manifest.configuration.personas < 6 || !Number.isInteger(manifest.configuration.samples) || manifest.configuration.samples < 1 || !Number.isSafeInteger(manifest.configuration.seed) || !Number.isInteger(manifest.configuration.shardSize) || manifest.configuration.shardSize < 1 || manifest.configuration.shardSize > MAX_SHARD_SIZE) findings.push('manifest.configuration is invalid');
  if (!exactKeys(manifest.generator, ['version', 'geometry_version', 'source_tree_sha256', 'schema_sha256', 'geometry_sha256', 'generator_sha256'], 'manifest.generator', findings)) return;
  if (manifest.generator.version !== 'gesture-simulator/1.0' || manifest.generator.geometry_version !== 'gesture-geometry/1.0') findings.push('manifest generator version contract is invalid');
  for (const key of ['source_tree_sha256', 'schema_sha256', 'geometry_sha256', 'generator_sha256']) if (typeof manifest.generator[key] !== 'string' || !/^[0-9a-f]{64}$/.test(manifest.generator[key])) findings.push(`manifest.generator.${key} is invalid`);
  if (!Array.isArray(manifest.shards) || manifest.shards.length === 0) findings.push('manifest.shards must be non-empty');
}
async function validateManifestSemantics(manifest, findings, options = {}) {
  const expectedNames = ['train', 'validation', 'test', 'hard_counterfactual', 'template_holdout', 'ood'];
  if (!setEqual(new Set(Object.keys(manifest.splits ?? {})), new Set(expectedNames))) addUnique(findings, 'manifest split names are not exact');
  for (const split of expectedNames) {
    const value = manifest.splits?.[split];
    if (!exactKeys(value, ['persona_groups', 'world_groups', 'template_groups', 'sample_ids'], `manifest.splits.${split}`, findings)) continue;
    for (const key of ['persona_groups', 'world_groups', 'template_groups', 'sample_ids']) if (!Array.isArray(value[key]) || value[key].some(item => typeof item !== 'string' || item === '')) findings.push(`manifest.splits.${split}.${key} is invalid`);
  }
  if (!exactKeys(manifest.intent_distribution, INTENTS, 'manifest.intent_distribution', findings) || INTENTS.some(intent => !Number.isInteger(manifest.intent_distribution[intent]) || manifest.intent_distribution[intent] < 0)) findings.push('manifest intent distribution contract is invalid');
  try {
    const generated = await (async () => {
      const source = await createSourceManifest(workspaceRoot);
      const [schema, geometry, generator] = await Promise.all([fs.readFile(path.join(workspaceRoot, 'gesture/shared/schema.mjs')), fs.readFile(path.join(workspaceRoot, 'gesture/shared/geometry.mjs')), fs.readFile(path.join(workspaceRoot, 'gesture/dataset/generate.mjs'))]);
      const verified = options.verifiedGenerationSourceTreeSha256;
      if (verified !== undefined && (typeof verified !== 'string' || !/^[0-9a-f]{64}$/.test(verified) || verified !== manifest.generator?.source_tree_sha256)) addUnique(findings, 'verified generation source hash does not match the manifest');
      return { source_tree_sha256: verified === manifest.generator?.source_tree_sha256 ? verified : source.tree_sha256, audit_source_tree_sha256: source.tree_sha256, schema_sha256: sha256(schema), geometry_sha256: sha256(geometry), generator_sha256: sha256(generator) };
    })();
    for (const key of ['source_tree_sha256', 'schema_sha256', 'geometry_sha256', 'generator_sha256']) if (manifest.generator?.[key] !== generated[key]) addUnique(findings, `manifest generator ${key} does not match current source`);
    return generated.audit_source_tree_sha256;
  } catch (error) { addUnique(findings, `cannot verify current generator hashes: ${error.message}`); }
  return null;
}
function compareManifestMembership(manifest, state) { const names = ['train', 'validation', 'test', 'hard_counterfactual', 'template_holdout', 'ood']; if (!setEqual(new Set(Object.keys(manifest.splits ?? {})), new Set(names))) addUnique(state.blocking_findings, 'manifest split names are not exact'); const personaGroups = new Set(); for (const split of names) { const declaredSplit = manifest.splits?.[split] ?? {}; const expected = new Set(declaredSplit.sample_ids ?? []); const actual = state.actualMembership.get(split) ?? new Set(); if (!setEqual(actual, expected)) addUnique(state.blocking_findings, `split membership mismatch: ${split}`); const groups = state.actualGroups.get(split) ?? { persona: new Set(), world: new Set(), template: new Set() }; for (const [kind, key] of [['persona', 'persona_groups'], ['world', 'world_groups'], ['template', 'template_groups']]) { if (!setEqual(groups[kind], new Set(declaredSplit[key] ?? []))) addUnique(state.blocking_findings, `${kind} membership mismatch: ${split}`); if (kind === 'persona') for (const value of groups[kind]) personaGroups.add(value); } } if (personaGroups.size !== Number(manifest.configuration?.personas)) addUnique(state.blocking_findings, 'manifest persona total does not match actual persona groups'); const declared = manifest.intent_distribution ?? {}; const actual = Object.fromEntries(INTENTS.map(intent => [intent, state.intentCounts.get(intent) ?? 0])); if (INTENTS.some(intent => Number(declared[intent] ?? -1) !== actual[intent])) addUnique(state.blocking_findings, 'manifest intent distribution mismatch'); }
export async function auditDatasetDirectory(directory, options = {}) {
  const manifestPath = path.join(directory, 'manifest.json'); const manifestBytes = await fs.readFile(manifestPath); const manifest = JSON.parse(manifestBytes.toString('utf8')); const state = createState(options); validateManifestShape(manifest, state.blocking_findings); const auditSourceTreeSha256 = await validateManifestSemantics(manifest, state.blocking_findings, options); const listed = new Set(); const shardEntries = Array.isArray(manifest.shards) ? manifest.shards : []; let expectedStart = null; let expectedTotal = 0;
  for (const [index, shard] of shardEntries.entries()) { if (!isObject(shard) || typeof shard.path !== 'string' || listed.has(shard.path)) { addUnique(state.blocking_findings, `invalid or duplicate shard declaration at index ${index}`); continue; } if (!setEqual(new Set(Object.keys(shard)), new Set(['path', 'sha256', 'records', 'seed_range'])) || !isObject(shard.seed_range) || !setEqual(new Set(Object.keys(shard.seed_range)), new Set(['start', 'end_exclusive']))) addUnique(state.blocking_findings, `shard declaration contract mismatch: ${shard.path}`); listed.add(shard.path); if (!shard.path.startsWith('shards/') || shard.path.includes('..') || !shard.path.endsWith('.jsonl.gz')) { addUnique(state.blocking_findings, `invalid shard path: ${shard.path}`); continue; } if (!Number.isInteger(shard.records) || shard.records < 1 || shard.records > MAX_SHARD_SIZE) addUnique(state.blocking_findings, `invalid shard record count: ${shard.path}`); let start; let end; try { start = BigInt(shard.seed_range?.start ?? '0'); end = BigInt(shard.seed_range?.end_exclusive ?? '0'); } catch { addUnique(state.blocking_findings, `invalid shard seed range: ${shard.path}`); start = 0n; end = 0n; } if (expectedStart !== null && start !== expectedStart) addUnique(state.blocking_findings, `shard seed ranges are not contiguous: ${shard.path}`); expectedStart = end; const actualPath = path.join(directory, shard.path); let stat; try { stat = await fs.stat(actualPath); } catch { addUnique(state.blocking_findings, `listed shard is missing: ${shard.path}`); continue; } if (stat.size === 0) addUnique(state.blocking_findings, `shard is empty: ${shard.path}`); const actualRecords = await streamShard(actualPath, state); expectedTotal += actualRecords; if (actualRecords !== shard.records) addUnique(state.blocking_findings, `shard record count mismatch: ${shard.path}`); const expectedSeedStart = BigInt(manifest.configuration?.seed ?? 0) * 1_000_003n + BigInt(expectedTotal - actualRecords); const expectedSeedEnd = expectedSeedStart + BigInt(actualRecords); if (start !== expectedSeedStart || end !== expectedSeedEnd) addUnique(state.blocking_findings, `declared seed range mismatch: ${shard.path}`); }
  try { const actualFiles = (await fs.readdir(path.join(directory, 'shards'))).filter(name => name.endsWith('.jsonl.gz')).map(name => `shards/${name}`); for (const file of actualFiles) if (!listed.has(file)) addUnique(state.blocking_findings, `stale or extra shard file: ${file}`); } catch { addUnique(state.blocking_findings, 'shards directory is missing'); } if (expectedTotal !== manifest.total_samples || manifest.configuration?.samples !== manifest.total_samples || state.count !== manifest.total_samples) addUnique(state.blocking_findings, 'manifest total sample count mismatch'); compareManifestMembership(manifest, state); const report = finalizeState(state); report.dataset_manifest_sha256 = sha256(manifestBytes); report.shard_hashes = Object.fromEntries(shardEntries.map(shard => [shard.path, shard.sha256])); report.audit_source_tree_sha256 = auditSourceTreeSha256; report.generation_source_tree_sha256 = manifest.generator?.source_tree_sha256 ?? null; try { await verifyManifest(manifest, { dir: directory, requireFreeze: false }); } catch (error) { addUnique(report.blocking_findings, error.message); } await writeJsonAtomically(path.join(directory, 'audit-report.json'), report); return { manifest, report };
}
