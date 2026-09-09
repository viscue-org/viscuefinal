export const PLAN_POLICY = Object.freeze({
  free: Object.freeze({ physicalReferences: 20 }),
  pro: Object.freeze({ physicalReferences: 20 }),
  plus: Object.freeze({ physicalReferences: 20 }),
});

export const MODEL_ROUTES = Object.freeze({
  imagePrimary: 'us.amazon.nova-lite-v1:0',
  imageFallback: 'us.amazon.nova-pro-v1:0',
  videoPrimary: 'us.amazon.nova-pro-v1:0',
  videoFallback: 'us.amazon.nova-lite-v1:0',
  relevance: 'amazon.titan-embed-image-v1',
  compiler: 'mistral.ministral-3-8b-instruct',
});

export function resolveModelRoutes(env = {}) {
  return Object.freeze({
    ...MODEL_ROUTES,
    imagePrimary: env.IMAGE_MODEL_ID || env.VISION_MODEL_ID || MODEL_ROUTES.imagePrimary,
    imageFallback: env.IMAGE_FALLBACK_MODEL_ID || MODEL_ROUTES.imageFallback,
    videoPrimary: env.VIDEO_MODEL_ID || MODEL_ROUTES.videoPrimary,
    videoFallback: env.VIDEO_FALLBACK_MODEL_ID || MODEL_ROUTES.videoFallback,
    relevance: env.RELEVANCE_MODEL_ID || MODEL_ROUTES.relevance,
    compiler: env.PROMPT_MODEL_ID || env.COMPILER_MODEL || MODEL_ROUTES.compiler,
  });
}

export const STAGE_STATUS = Object.freeze(['ok', 'degraded', 'blocked', 'skipped']);

export function createStage(name, status, details = {}) {
  if (!STAGE_STATUS.includes(status)) throw new TypeError(`Invalid stage status: ${status}`);
  return { name, status, ...details };
}
