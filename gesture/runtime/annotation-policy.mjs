import { processGestureCandidate } from './pipeline.mjs';

export function isResolverConfigured(model) {
  return typeof model === 'function';
}

/**
 * Drawing always stores the raw, schema-valid stroke. Semantic resolution is
 * opt-in: without an explicitly supplied local resolver no pipeline result or
 * unresolved operation is created.
 */
export function resolveAnnotationCandidate({ model = null, ...candidate } = {}) {
  if (!isResolverConfigured(model)) return Object.freeze({ pipeline: null, operation: null });
  const pipeline = processGestureCandidate({ ...candidate, model });
  return Object.freeze({ pipeline, operation: pipeline.operation });
}
