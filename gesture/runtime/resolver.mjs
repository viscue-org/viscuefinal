import { ABSTENTION_REASONS, SCHEMA_VERSIONS } from '../shared/contracts.mjs';
import { validateResolution } from '../shared/schema.mjs';

/** Produces the only schema-valid result when no installed model can resolve inputs. */
export function createAbstention(reason, modelVersion = undefined) {
  if (!ABSTENTION_REASONS.includes(reason)) throw new TypeError(`Unsupported abstention reason: ${reason}`);
  const unavailable = reason === 'model_unavailable';
  if (!unavailable && (typeof modelVersion !== 'string' || modelVersion.trim() === '')) {
    throw new TypeError('Known model abstentions require a non-empty model version');
  }
  return Object.freeze({
    schema_version: SCHEMA_VERSIONS.resolution,
    family: null,
    intent: null,
    confidence: 0,
    accepted: false,
    reason,
    alternatives: Object.freeze([]),
    model_version: unavailable ? null : modelVersion,
  });
}

/**
 * Extension boundary for an eventual local model. The model receives only the
 * ID-free tensors assembled by buildModelInputs and must return the Task 2
 * resolution schema; no network provider is called here.
 */
export function resolveGesture(inputs, { model = null } = {}) {
  if (typeof model !== 'function') return createAbstention('model_unavailable');
  const resolution = model(inputs);
  if (resolution && typeof resolution.then === 'function') {
    return resolution.then(res => {
      const validation = validateResolution(res);
      if (!validation.ok || res.intent === 'unknown') return createAbstention('invalid_input', 'local-model/invalid-output');
      return res;
    });
  }
  const validation = validateResolution(resolution);
  if (!validation.ok || resolution.intent === 'unknown') return createAbstention('invalid_input', 'local-model/invalid-output');
  return resolution;
}
