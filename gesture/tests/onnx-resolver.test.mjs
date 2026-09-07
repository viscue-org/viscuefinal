import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stat } from 'node:fs/promises';
import { initOnnxSession, resolveOrtWasmBase, runOnnxInference } from '../runtime/onnx-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelPath = path.resolve(__dirname, '../runtime/models/gesture-resolver-v1.onnx');

test('inference uses the shipped calibration threshold, not an unsafe lower default', async () => {
  const session = { run: async () => ({ logits: { data: [Math.log(0.57 * 29 / 0.43), ...Array(29).fill(0)] } }) };
  const result = await runOnnxInference({}, { session });
  assert.equal(result.confidence, 0.57);
  assert.equal(result.accepted, false);
});

test('malformed nonfinite logits are rejected before producing a resolution', async () => {
  const session = { run: async () => ({ logits: { data: Array(30).fill(NaN) } }) };
  await assert.rejects(runOnnxInference({}, { session }), /logits/i);
});

test('unknown is never exposed as a semantic alternative', async () => {
  const logits = Array(30).fill(-10);
  logits[0] = 10;
  logits[29] = 9;
  logits[1] = 8;
  const session = { run: async () => ({ logits: { data: logits } }) };

  const result = await runOnnxInference({}, { session, calibration: { acceptance_threshold: 0.6, abstention_threshold: 0.4, temperature: 1, model_version: 'test/1' } });

  assert.equal(result.accepted, true);
  assert.equal(result.alternatives.some(item => item.intent === 'unknown'), false);
});

test('an unknown top prediction still exposes the strongest semantic alternatives', async () => {
  const logits = Array(30).fill(-10);
  logits[29] = 10;
  logits[0] = 9;
  logits[1] = 8;
  const session = { run: async () => ({ logits: { data: logits } }) };

  const result = await runOnnxInference({}, { session, calibration: { acceptance_threshold: 0.6, abstention_threshold: 0.4, temperature: 1, model_version: 'test/1' } });

  assert.equal(result.accepted, false);
  assert.equal(result.alternatives[0].intent, 'select_region');
});

test('browser development WASM base resolves to the installed ONNX runtime assets', async () => {
  const base = resolveOrtWasmBase({ moduleUrl: new URL('../runtime/onnx-resolver.mjs', import.meta.url).href });
  const wasm = fileURLToPath(new URL('ort-wasm-simd-threaded.jsep.wasm', base));
  const info = await stat(wasm);
  assert.ok(info.size > 1_000_000);
});

test('extension WASM base uses the extension runtime URL', () => {
  const base = resolveOrtWasmBase({ runtimeGetUrl: path => `chrome-extension://viscue/${path}` });
  assert.equal(base, 'chrome-extension://viscue/');
});

test('ONNX session initializes and resolves dummy gesture input', async () => {
  const session = await initOnnxSession({ modelPath });
  assert.ok(session, 'Session should be created');

  const dummyInputs = {
    sequence: Array.from({ length: 4 }, () => Array.from({ length: 128 }, () => [0.1, 0.2, 16, 0.01, 0.02, 0.5, 1])),
    sequence_mask: Array.from({ length: 4 }, () => Array(128).fill(1)),
    geometry: Array(48).fill(0.1),
    nodes: Array.from({ length: 32 }, () => Array(14).fill(0.1)),
    node_mask: Array(32).fill(1),
    context: Array(24).fill(0.1),
  };

  const result = await runOnnxInference(dummyInputs, { session });
  assert.equal(result.schema_version, 'gesture-resolution/1.0');
  assert.ok(typeof result.confidence === 'number');
  assert.ok(Array.isArray(result.alternatives));
  assert.equal(result.model_version, 'gesture-fusion-v1');
});
