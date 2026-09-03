export const ONBOARDING_SCENE_COUNT = 5;

export function shouldShowOnboarding(completed) {
  return completed !== true;
}

export function createOnboardingState() {
  return { scene: 0, completed: false };
}

export function advanceOnboarding(state) {
  if (state.completed) return state;
  if (state.scene >= ONBOARDING_SCENE_COUNT - 1) {
    return { scene: ONBOARDING_SCENE_COUNT - 1, completed: true };
  }
  return { scene: state.scene + 1, completed: false };
}

export function skipOnboarding(state) {
  return { ...state, completed: true };
}

export function getOnboardingSceneDuration(scene, reducedMotion) {
  if (scene === 2) return 11200;
  return reducedMotion ? 5200 : 3600;
}
