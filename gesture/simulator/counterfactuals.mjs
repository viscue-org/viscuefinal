import { GEOMETRY_FEATURE_NAMES, deriveGeometry, getFullPrecisionGeometry } from '../shared/geometry.mjs';
import { FAMILY_BY_INTENT, INTENTS } from '../shared/taxonomy.mjs';
import { assertProductionFeatureKeys, validateRawGesture, validateRuntimeContext } from '../shared/schema.mjs';
import { feasibleInsertPairs, feasibleIntents } from './feasibility.mjs';
import { generatePersona } from './personas.mjs';
import { createPrng } from './prng.mjs';
import { generateWorld, sampleGoal } from './worlds.mjs';

export const COUNTERFACTUAL_GEOMETRY_THRESHOLD = 0.001;
const numberSeed = seed => Array.from(String(seed ?? 0)).reduce((value, char) => ((value * 31) + char.codePointAt(0)) >>> 0, 17);

/** Euclidean distance over the full, pre-serialization geometry contract. */
export function geometryDistance(first, second) {
  const a = getFullPrecisionGeometry(first); const b = getFullPrecisionGeometry(second);
  return Math.sqrt(GEOMETRY_FEATURE_NAMES.reduce((sum, key) => {
    const left = typeof a[key] === 'boolean' ? Number(a[key]) : Number(a[key]);
    const right = typeof b[key] === 'boolean' ? Number(b[key]) : Number(b[key]);
    return sum + (left - right) ** 2;
  }, 0));
}

export function isCounterfactualFeasible(sample) {
  const raw = sample?.rawGesture;
  const goal = sample?.goal;
  return Boolean(raw && validateRawGesture(raw).ok && goal && INTENTS.includes(goal.intent) && goal.family === FAMILY_BY_INTENT[goal.intent]
    && validateRuntimeContext(sample.world?.runtime_context).ok
    && assertContext(sample.world.runtime_context) && feasibleIntents(sample.world).includes(sample.goal?.intent));
}

function assertContext(context) {
  try { assertProductionFeatureKeys(context); return true; } catch { return false; }
}

/**
 * Produces the deliberately hard paired example. The raw gesture is copied
 * unchanged, while a separately feasible world and its ground-truth goal vary.
 * Consumers may use only `world.runtime_context` as the model context.
 */
export function makeCounterfactualPair(sample, seed = 0) {
  const rawGesture = sample?.rawGesture ?? (sample?.strokes ? sample : null);
  if (!rawGesture || !validateRawGesture(rawGesture).ok) throw new TypeError('counterfactual source requires a schema-valid raw gesture');
  const sourceIntent = sample?.goal?.intent;
  if (!sample?.world || !validateRuntimeContext(sample.world.runtime_context).ok || !assertContext(sample.world.runtime_context)) throw new TypeError('counterfactual source requires a production-valid runtime context');
  if (typeof sourceIntent !== 'string' || !INTENTS.includes(sourceIntent)) throw new TypeError('counterfactual source requires a labeled simulator goal');
  if (sample.goal.family !== FAMILY_BY_INTENT[sourceIntent]) throw new TypeError('counterfactual source goal family does not match intent');
  if (!feasibleIntents(sample.world).includes(sourceIntent)) throw new RangeError('counterfactual source goal is not feasible in its world');
  const sourceGeometry = deriveGeometry(rawGesture); const random = createPrng(`counterfactual:${String(seed)}`); const base = numberSeed(seed);
  let selected = null;
  for (let attempt = 0; attempt < 64 && !selected; attempt++) {
    const persona = generatePersona(`counterfactual-persona:${base + attempt}`);
    const world = generateWorld(base + attempt * 17 + 1, persona);
    if (JSON.stringify(world.runtime_context) === JSON.stringify(sample?.world?.runtime_context)) continue;
    const candidates = feasibleIntents(world).filter(intent => intent !== 'unknown' && intent !== sourceIntent);
    if (candidates.length === 0) continue;
    const intent = candidates[random.int(candidates.length)];
    const sampled = sampleGoal(world, persona, random);
    const references = intent === 'insert_between' ? Object.freeze({ pair: feasibleInsertPairs(world)[0] }) : null;
    const goal = Object.freeze({ ...sampled, intent, family: FAMILY_BY_INTENT[intent], accepted: true, reason: null, references });
    const correctedTruth = Object.freeze({ intent, family: FAMILY_BY_INTENT[intent], accepted: true });
    const correctedWorld = Object.freeze({
      ...world,
      simulation: Object.freeze({ ...world.simulation, ground_truth: correctedTruth }),
    });
    selected = { world: correctedWorld, goal };
  }
  if (!selected) throw new RangeError('could not construct a feasible distinct counterfactual context');
  const copiedRaw = structuredClone(rawGesture);
  const distance = geometryDistance(sourceGeometry, deriveGeometry(copiedRaw));
  if (distance > COUNTERFACTUAL_GEOMETRY_THRESHOLD) throw new RangeError('counterfactual geometry exceeds the documented threshold');
  const pair = Object.freeze({ rawGesture: copiedRaw, world: selected.world, goal: selected.goal, counterfactual: Object.freeze({ geometry_distance: distance, geometry_threshold: COUNTERFACTUAL_GEOMETRY_THRESHOLD, mechanism: 'same_raw_distinct_feasible_context' }) });
  if (!isCounterfactualFeasible(pair)) throw new TypeError('counterfactual construction failed feasibility or feature-boundary validation');
  return pair;
}
