import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ONBOARDING_SCENE_COUNT,
  advanceOnboarding,
  createOnboardingState,
  getOnboardingSceneDuration,
  shouldShowOnboarding,
  skipOnboarding,
} from '../src/onboardingModel.mjs';

test('a fresh install shows onboarding while a completed install shows the regular popup', () => {
  assert.equal(shouldShowOnboarding(undefined), true);
  assert.equal(shouldShowOnboarding(false), true);
  assert.equal(shouldShowOnboarding(true), false);
});

test('advancing moves through one scene at a time and completes only after the final scene', () => {
  let state = createOnboardingState();

  for (let scene = 0; scene < ONBOARDING_SCENE_COUNT - 1; scene += 1) {
    assert.equal(state.scene, scene);
    assert.equal(state.completed, false);
    state = advanceOnboarding(state);
  }

  assert.equal(state.scene, ONBOARDING_SCENE_COUNT - 1);
  assert.equal(state.completed, false);
  assert.deepEqual(advanceOnboarding(state), {
    scene: ONBOARDING_SCENE_COUNT - 1,
    completed: true,
  });
});

test('skip completes onboarding without changing the current scene', () => {
  const state = { scene: 2, completed: false };

  assert.deepEqual(skipOnboarding(state), { scene: 2, completed: true });
});

test('the real-tool demo remains visible long enough to play its full recording', () => {
  assert.equal(getOnboardingSceneDuration(0, false), 3600);
  assert.equal(getOnboardingSceneDuration(2, false), 11200);
  assert.equal(getOnboardingSceneDuration(2, true), 11200);
});
