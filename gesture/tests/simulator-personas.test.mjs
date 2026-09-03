import assert from 'node:assert/strict';
import test from 'node:test';
import { generatePersona } from '../simulator/personas.mjs';
import { createPrng } from '../simulator/prng.mjs';
import { generateWorld } from '../simulator/worlds.mjs';

test('SplitMix64 and Xoshiro256** have stable, platform-independent snapshots', () => {
  const splitmix = createPrng(0);
  assert.deepEqual(Array.from({ length: 4 }, () => splitmix.nextSplitMix64().toString(16).padStart(16, '0')), ['e220a8397b1dcdaf', '6e789e6aa1b965f4', '06c45d188009454f', 'f88bb8a8724c81ec']);
  const xoshiro = createPrng(0);
  assert.deepEqual(Array.from({ length: 4 }, () => xoshiro.nextUint64().toString(16).padStart(16, '0')), ['99ec5f36cb75f2b4', 'bf6e1f784956452a', '1a5f849d4933e6e0', '6aa594f1262d2d2c']);
});

test('same seed reproduces personas exactly and 100k seeds have stable opaque unique IDs', () => {
  assert.deepEqual(generatePersona(42), generatePersona(42));
  const personas = Array.from({ length: 100_000 }, (_, index) => generatePersona(index));
  assert.equal(new Set(personas.map(persona => persona.persona_id)).size, 100_000);
  assert.equal(personas.some(persona => persona.persona_id.endsWith('_42')), false);
});

test('personas cover device and motor preferences without collapsing into one template', () => {
  const personas = Array.from({ length: 180 }, (_, index) => generatePersona(index));
  assert.deepEqual(new Set(personas.map(persona => persona.device)), new Set(['mouse', 'touch', 'stylus']));
  assert.ok(new Set(personas.map(persona => `${persona.viewport.width}x${persona.viewport.height}`)).size >= 3);
  assert.ok(new Set(personas.map(persona => persona.handedness)).size >= 2);
  assert.ok(new Set(personas.map(persona => persona.density_preference)).size >= 3);
  for (const persona of personas) for (const key of ['skill', 'velocity', 'jitter', 'hesitation', 'correction', 'overshoot', 'zoom']) assert.equal(Number.isFinite(persona[key]), true, `${key} is numeric`);
});

test('persona latent fields and provenance never cross the runtime feature boundary', () => {
  const persona = generatePersona(20);
  const world = generateWorld(10, persona);
  const serialized = JSON.stringify(world.runtime_context);
  for (const forbidden of ['persona_id', 'ground_truth', 'scenario_name', 'world_seed', 'device_preference']) assert.equal(serialized.includes(forbidden), false, `${forbidden} leaked into runtime context`);
  assert.equal(world.simulation.provenance.persona_id, persona.persona_id);
});
