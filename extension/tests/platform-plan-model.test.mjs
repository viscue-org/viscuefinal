import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLATFORM_PLAN_SETUP_KEY,
  PLATFORM_PLAN_STORAGE_KEY,
  platformPlanState,
  preflightVisualAddition,
} from '../src/platformPlanModel.mjs';

const asset = (id, kind = 'image', provenance = null) => ({ id, type: 'asset', data: { kind, provenance } });

test('first Workspace access requires setup and a saved valid profile does not ask again', () => {
  const first = platformPlanState({}, 'Claude');
  assert.equal(first.needsSetup, true);
  assert.equal(first.capability.platform, 'claude');
  assert.equal(first.capability.plan, 'free');

  const saved = platformPlanState({
    [PLATFORM_PLAN_SETUP_KEY]: true,
    [PLATFORM_PLAN_STORAGE_KEY]: { platform: 'claude', plan: 'max' },
  }, 'Claude');
  assert.equal(saved.needsSetup, false);
  assert.equal(saved.capability.plan, 'max');
});

test('invalid stored plan stays completed but falls back safely instead of repeating onboarding', () => {
  const state = platformPlanState({
    [PLATFORM_PLAN_SETUP_KEY]: true,
    [PLATFORM_PLAN_STORAGE_KEY]: { platform: 'claude', plan: 'root' },
  }, 'Claude');
  assert.equal(state.needsSetup, false);
  assert.equal(state.capability.plan, 'free');
});

test('a later destination change does not repeat setup and uses that platform safe free capability', () => {
  const state = platformPlanState({
    [PLATFORM_PLAN_SETUP_KEY]: true,
    [PLATFORM_PLAN_STORAGE_KEY]: { platform: 'chatgpt', plan: 'pro' },
  }, 'Gemini');
  assert.equal(state.needsSetup, false);
  assert.equal(state.capability.platform, 'gemini');
  assert.equal(state.capability.plan, 'free');
});

test('visual additions are atomic at the exact effective limit', () => {
  const nodes = [asset('a'), asset('b')];
  assert.deepEqual(preflightVisualAddition({ nodes, candidates: [asset('c')], limit: 3 }), {
    ok: true, current: 2, after: 3, limit: 3, remaining: 1,
  });
  assert.deepEqual(preflightVisualAddition({ nodes, candidates: [asset('c'), asset('d')], limit: 3 }), {
    ok: false, current: 2, after: 4, limit: 3, remaining: 1,
  });
});

test('a derived frame shares its present parent physical slot and detached frames do not', () => {
  const parent = asset('video', 'video');
  const attached = asset('frame', 'image', { parentId: 'video', detached: false });
  const detached = asset('detached', 'image', { parentId: 'missing', detached: true });
  assert.equal(preflightVisualAddition({ nodes: [parent], candidates: [attached], limit: 1 }).ok, true);
  assert.deepEqual(preflightVisualAddition({ nodes: [parent], candidates: [detached], limit: 1 }), {
    ok: false, current: 1, after: 2, limit: 1, remaining: 0,
  });
});

test('an already over-limit restored workspace remains readable but blocks new visual additions', () => {
  const result = preflightVisualAddition({ nodes: [asset('a'), asset('b'), asset('c')], candidates: [], limit: 2 });
  assert.deepEqual(result, { ok: false, current: 3, after: 3, limit: 2, remaining: 0 });
});
