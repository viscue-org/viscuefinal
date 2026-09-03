export const PLAN_POLICY = Object.freeze({
  free: Object.freeze({ physicalReferences: 2 }),
  pro: Object.freeze({ physicalReferences: 10 }),
  plus: Object.freeze({ physicalReferences: 20 }),
});

export const MODEL_ROUTES = Object.freeze({
  imagePrimary: 'qwen.qwen3-vl-235b-a22b',
  imageFallback: 'amazon.nova-pro-v1:0',
  videoPrimary: 'amazon.nova-pro-v1:0',
  videoFallback: 'amazon.nova-lite-v1:0',
  relevance: 'amazon.titan-embed-image-v1',
  compiler: '',
});

export const STAGE_STATUS = Object.freeze(['ok', 'degraded', 'blocked', 'skipped']);

export function createStage(name, status, details = {}) {
  if (!STAGE_STATUS.includes(status)) throw new TypeError(`Invalid stage status: ${status}`);
  return { name, status, ...details };
}
