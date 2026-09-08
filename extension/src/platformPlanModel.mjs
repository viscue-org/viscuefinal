import { normalizePlatformCapability } from '../../local-server/lib/platform-capabilities.mjs';

export const PLATFORM_PLAN_STORAGE_KEY = 'viscue-platform-capability-v1';
export const PLATFORM_PLAN_SETUP_KEY = 'viscue-platform-plan-setup-complete';

const VISUAL_KINDS = new Set(['image', 'video', 'video_frame', 'document', 'webpage']);

export function platformPlanState(storage = {}, detectedPlatform = 'ChatGPT') {
  const completed = storage?.[PLATFORM_PLAN_SETUP_KEY] === true;
  const detected = normalizePlatformCapability({ platform: detectedPlatform, plan: 'free' }, detectedPlatform);
  const saved = normalizePlatformCapability(storage?.[PLATFORM_PLAN_STORAGE_KEY] || {}, detectedPlatform);
  return Object.freeze({
    needsSetup: !completed,
    capability: completed && saved.platform !== detected.platform ? detected : saved,
  });
}

function countPhysicalVisuals(nodes = []) {
  const assets = nodes.filter(node => node?.type === 'asset' && VISUAL_KINDS.has(node?.data?.kind));
  const ids = new Set(assets.map(node => node.id));
  const physicalIds = new Set();
  for (const node of assets) {
    const parentId = node.data?.provenance?.parentId;
    physicalIds.add(parentId && ids.has(parentId) ? parentId : node.id);
  }
  return physicalIds.size;
}

export function preflightVisualAddition({ nodes = [], candidates = [], limit = 10 } = {}) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
  const current = countPhysicalVisuals(nodes);
  const after = countPhysicalVisuals([...nodes, ...candidates]);
  return Object.freeze({
    ok: current <= safeLimit && after <= safeLimit,
    current,
    after,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - current),
  });
}
