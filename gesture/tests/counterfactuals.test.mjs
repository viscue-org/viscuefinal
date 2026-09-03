import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveGeometry } from '../shared/geometry.mjs';
import { assertProductionFeatureKeys, validateRawGesture, validateRuntimeContext } from '../shared/schema.mjs';
import { makeCounterfactualPair, COUNTERFACTUAL_GEOMETRY_THRESHOLD, isCounterfactualFeasible } from '../simulator/counterfactuals.mjs';
import { executeGoal } from '../simulator/executors.mjs';
import { generatePersona } from '../simulator/personas.mjs';
import { createPrng } from '../simulator/prng.mjs';
import { generateWorld, sampleGoal } from '../simulator/worlds.mjs';
import { feasibleInsertPairs } from '../simulator/feasibility.mjs';

function source(seed = 31) {
  const persona = generatePersona(seed);
  const world = generateWorld(seed, persona);
  const goal = sampleGoal(world, persona, createPrng(`goal:${seed}`));
  return { rawGesture: executeGoal({ persona, world, goal, seed: `raw:${seed}` }), world, goal };
}

function independentGeometryDistance(firstRaw, secondRaw) {
  const first = deriveGeometry(firstRaw); const second = deriveGeometry(secondRaw);
  return Math.sqrt(Object.keys(first).reduce((sum, key) => sum + (Number(first[key]) - Number(second[key])) ** 2, 0));
}

test('counterfactual preserves measured full geometry while changing a feasible production context and label', () => {
  const sample = source();
  const pair = makeCounterfactualPair(sample, 42);
  assert.equal(validateRawGesture(pair.rawGesture).ok, true);
  assert.deepEqual(pair.rawGesture, sample.rawGesture);
  assert.equal(independentGeometryDistance(sample.rawGesture, pair.rawGesture), 0);
  assert.ok(pair.counterfactual.geometry_distance <= COUNTERFACTUAL_GEOMETRY_THRESHOLD);
  assert.notEqual(pair.goal.intent, sample.goal.intent);
  assert.notDeepEqual(pair.world.runtime_context, sample.world.runtime_context);
  assert.equal(validateRuntimeContext(pair.world.runtime_context).ok, true);
  assert.doesNotThrow(() => assertProductionFeatureKeys(pair.world.runtime_context));
  assert.equal(isCounterfactualFeasible(pair), true);
});

test('shape-only baseline cannot distinguish the deliberately identical pair and neither model context leaks IDs or labels', () => {
  const sample = source(44);
  const pair = makeCounterfactualPair(sample, 99);
  assert.deepEqual(deriveGeometry(sample.rawGesture), deriveGeometry(pair.rawGesture), 'the shape-only baseline receives identical measured features');
  for (const context of [sample.world.runtime_context, pair.world.runtime_context]) {
    assert.equal(/persona_id|ground_truth|"intent"|node_id|scenario|template|label/.test(JSON.stringify(context)), false);
  }
  assert.deepEqual(makeCounterfactualPair(sample, 99), pair, 'counterfactual sampling is seed deterministic');
});

test('counterfactual simulator truth and structured references agree with its replacement intent', () => {
  const sample = source(6);
  const pair = makeCounterfactualPair(sample, 6);
  assert.equal(pair.world.simulation.ground_truth.intent, pair.goal.intent);
  assert.equal(pair.goal.intent, 'insert_between');
  assert.deepEqual(pair.goal.references?.pair, feasibleInsertPairs(pair.world)[0]);
  assert.ok(pair.world.simulation.authority.object_order.includes(pair.goal.references.pair[0]));
  assert.ok(pair.world.simulation.authority.object_order.includes(pair.goal.references.pair[1]));
});

test('counterfactual rejects an inconsistent or infeasible source label before pairing', () => {
  const sample = source(31);
  assert.throws(() => makeCounterfactualPair({ ...sample, goal: { ...sample.goal, family: sample.goal.family === 'selection' ? 'relation' : 'selection' } }, 4), /family/i);
  const impossibleWorld = structuredClone(sample.world);
  impossibleWorld.simulation.authority.nodes = [];
  assert.throws(() => makeCounterfactualPair({ ...sample, world: impossibleWorld }, 4), /feasible/i);
});

test('counterfactual rejects a source production context that contains simulator metadata', () => {
  const sample = source(31);
  assert.throws(() => makeCounterfactualPair({ ...sample, world: { ...sample.world, runtime_context: { ...sample.world.runtime_context, persona_id: 'latent' } } }, 4), /context|production|valid/i);
});
