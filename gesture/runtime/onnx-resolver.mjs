import * as ort from 'onnxruntime-web';
import { FAMILY_BY_INTENT, INTENTS } from '../shared/taxonomy.mjs';
import { SCHEMA_VERSIONS } from '../shared/contracts.mjs';

let sessionPromise = null;
let cachedSession = null;
let cachedCalibration = null;

const DEFAULT_CALIBRATION = {
  model_version: 'gesture-fusion-v1',
  acceptance_threshold: 0.55,
  abstention_threshold: 0.35,
  temperature: 1.0,
};

export function resolveOrtWasmBase({ runtimeGetUrl = null, moduleUrl = import.meta.url } = {}) {
  if (typeof runtimeGetUrl === 'function') return runtimeGetUrl('');
  return new URL('../../node_modules/onnxruntime-web/dist/', moduleUrl).href;
}

/**
 * Initializes and caches the ONNX InferenceSession.
 * Supports both browser extensions (via chrome.runtime.getURL / fetch) and Node.js environments.
 */
export async function initOnnxSession({ modelPath = null, calibrationPath = null } = {}) {
  if (cachedSession) return cachedSession;
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    try {
      let resolvedModelPath = modelPath;
      if (!resolvedModelPath) {
        if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
          resolvedModelPath = chrome.runtime.getURL('models/gesture-resolver-v1.onnx');
        } else {
          resolvedModelPath = new URL('./models/gesture-resolver-v1.onnx', import.meta.url).href;
        }
      }

      // Configure WASM paths if running in browser
      if (typeof window !== 'undefined' && ort.env?.wasm) {
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.simd = true;
        const runtimeGetUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
          ? chrome.runtime.getURL.bind(chrome.runtime)
          : null;
        ort.env.wasm.wasmPaths = resolveOrtWasmBase({ runtimeGetUrl });
      }

      cachedSession = await ort.InferenceSession.create(resolvedModelPath, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      cachedCalibration = DEFAULT_CALIBRATION;
      return cachedSession;
    } catch (err) {
      console.warn('[Viscue Gesture] Failed to initialize ONNX session:', err);
      sessionPromise = null;
      throw err;
    }
  })();

  return sessionPromise;
}

function softmax(logits, temperature = 1.0) {
  const scaled = logits.map(x => x / Math.max(1e-6, temperature));
  const max = Math.max(...scaled);
  const exps = scaled.map(x => Math.exp(x - max));
  const sum = exps.reduce((acc, val) => acc + val, 0);
  return exps.map(x => x / sum);
}

/**
 * Assembles Flat Float32 arrays from input tensors and executes ONNX inference.
 */
export async function runOnnxInference(inputs, { session = null, calibration = DEFAULT_CALIBRATION } = {}) {
  const activeSession = session || cachedSession || await initOnnxSession();
  if (!activeSession) throw new Error('ONNX inference session unavailable');

  // 1. Flatten sequence: 4 x 128 x 7 = 3584 elements
  const rawSeq = inputs.sequence || [];
  const seqFlat = new Float32Array(4 * 128 * 7);
  let seqIdx = 0;
  for (let s = 0; s < 4; s++) {
    const stroke = rawSeq[s] || [];
    for (let p = 0; p < 128; p++) {
      const pt = stroke[p] || [0, 0, 0, 0, 0, 0, 0];
      for (let f = 0; f < 7; f++) {
        seqFlat[seqIdx++] = Number(pt[f]) || 0;
      }
    }
  }

  // 2. Flatten sequence_mask: 4 x 128 = 512 elements
  const rawSeqMask = inputs.sequence_mask || [];
  const seqMaskFlat = new Float32Array(4 * 128);
  let seqMaskIdx = 0;
  for (let s = 0; s < 4; s++) {
    const sMask = rawSeqMask[s] || [];
    for (let p = 0; p < 128; p++) {
      seqMaskFlat[seqMaskIdx++] = Number(sMask[p]) || 0;
    }
  }

  // 3. Flatten geometry: 48 elements
  const geomFlat = new Float32Array(48);
  const rawGeom = inputs.geometry || [];
  for (let i = 0; i < 48; i++) {
    geomFlat[i] = Number(rawGeom[i]) || 0;
  }

  // 4. Flatten nodes: 32 x 14 = 448 elements
  const rawNodes = inputs.nodes || [];
  const nodesFlat = new Float32Array(32 * 14);
  let nodeIdx = 0;
  for (let n = 0; n < 32; n++) {
    const nodeFeats = rawNodes[n] || [];
    for (let f = 0; f < 14; f++) {
      nodesFlat[nodeIdx++] = Number(nodeFeats[f]) || 0;
    }
  }

  // 5. Flatten node_mask: 32 elements
  const rawNodeMask = inputs.node_mask || [];
  const nodeMaskFlat = new Float32Array(32);
  for (let i = 0; i < 32; i++) {
    nodeMaskFlat[i] = Number(rawNodeMask[i]) || 0;
  }

  // 6. Flatten context: 24 elements
  const ctxFlat = new Float32Array(24);
  const rawCtx = inputs.context || [];
  for (let i = 0; i < 24; i++) {
    ctxFlat[i] = Number(rawCtx[i]) || 0;
  }

  const feeds = {
    sequence: new ort.Tensor('float32', seqFlat, [1, 4, 128, 7]),
    geometry: new ort.Tensor('float32', geomFlat, [1, 48]),
    nodes: new ort.Tensor('float32', nodesFlat, [1, 32, 14]),
    context: new ort.Tensor('float32', ctxFlat, [1, 24]),
    sequence_mask: new ort.Tensor('float32', seqMaskFlat, [1, 4, 128]),
    node_mask: new ort.Tensor('float32', nodeMaskFlat, [1, 32]),
  };

  const results = await activeSession.run(feeds);
  const logitsTensor = results.logits;
  const logits = Array.from(logitsTensor.data);
  const probabilities = softmax(logits, calibration.temperature || 1.0);

  // Find top predictions
  const ranked = probabilities
    .map((prob, idx) => ({ intent: INTENTS[idx] || 'unknown', confidence: Number(prob.toFixed(4)) }))
    .sort((a, b) => b.confidence - a.confidence);

  const top = ranked[0];
  const threshold = calibration.acceptance_threshold || 0.55;
  const isAccepted = top.confidence >= threshold && top.intent !== 'unknown';
  const family = isAccepted ? FAMILY_BY_INTENT[top.intent] || null : null;

  return Object.freeze({
    schema_version: SCHEMA_VERSIONS.resolution,
    family,
    intent: isAccepted ? top.intent : null,
    confidence: top.confidence,
    accepted: isAccepted,
    reason: isAccepted ? null : (top.confidence < (calibration.abstention_threshold || 0.35) ? 'low_confidence' : 'ambiguous_intent'),
    alternatives: Object.freeze(ranked.slice(1, 4)),
    model_version: calibration.model_version || 'gesture-fusion-v1',
  });
}

/**
 * Synchronous/async callable adapter for pipeline integration.
 */
export function createOnnxGestureModel(sessionOptions = {}) {
  initOnnxSession(sessionOptions).catch(() => {});
  return function onnxGestureModel(inputs) {
    if (!cachedSession) {
      return {
        schema_version: SCHEMA_VERSIONS.resolution,
        family: null,
        intent: null,
        confidence: 0,
        accepted: false,
        reason: 'model_unavailable',
        alternatives: [],
        model_version: null,
      };
    }
    return runOnnxInference(inputs, { session: cachedSession, calibration: cachedCalibration });
  };
}
