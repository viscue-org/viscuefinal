import test from 'node:test';
import assert from 'node:assert/strict';
import { auditDataset } from '../dataset/audit.mjs';

const validRecord = () => ({
  sample_id: 'sample-1', split: 'train',
  model_input: { sequence: [[[0]]], geometry: [0], nodes: [[0]], context: [0] },
  raw_strokes: { strokes: [] },
  pre_state: { canvas: 'one' },
  simulator_provenance: { persona_group: 'p1', world_group: 'w1', template_group: 't1', mechanism_id: 'm1' },
  ground_truth: { intent: 'connect' },
});

test('audit recursively blocks simulator and label keys in model input', () => {
  const record = validRecord();
  record.model_input.context = [{ nested: { ground_truth: 'connect' } }];
  const report = auditDataset({ records: [record] });
  assert.ok(report.blocking_findings.some(finding => /forbidden key.*ground_truth/i.test(finding)));
});

test('audit blocks group contamination, duplicates, and metadata shortcuts', () => {
  const first = validRecord();
  const second = validRecord();
  second.sample_id = 'sample-2';
  second.split = 'test';
  second.ground_truth = { intent: 'resize' };
  const report = auditDataset({ records: [first, second] });
  assert.ok(report.blocking_findings.some(finding => /persona group overlap/i.test(finding)));
  assert.ok(report.blocking_findings.some(finding => /duplicate canvas/i.test(finding)));
  assert.ok(report.blocking_findings.some(finding => /suspicious metadata/i.test(finding)));
});

test('audit blocks a hard split row that only claims counterfactual status', () => {
  const record = validRecord();
  record.split = 'hard_counterfactual';
  record.quality_flags = { hard_counterfactual: true };
  const report = auditDataset({ records: [record] });
  assert.ok(report.blocking_findings.some(finding => /lacks a real pair/i.test(finding)));
});

test('audit blocks OOD rows that are merely accepted ordinary labels', () => {
  const record = validRecord();
  record.split = 'ood';
  record.quality_flags = { ood: true };
  const report = auditDataset({ records: [record] });
  assert.ok(report.blocking_findings.some(finding => /OOD split lacks real failure/i.test(finding)));
});

test('audit enforces the exact dataset record and tensor contract', () => {
  const record = validRecord();
  record.extra = true;
  record.model_input.sequence = [[[Number.NaN]]];
  record.model_input.shapes = { sequence: [1, 1, 1] };
  const report = auditDataset({ records: [record] });
  assert.ok(report.blocking_findings.some(finding => /top-level key|record contract/i.test(finding)));
  assert.ok(report.blocking_findings.some(finding => /tensor|shape|finite/i.test(finding)));
});

test('audit rejects extra model_input shape keys', () => {
  const record = validRecord();
  record.model_input.shapes = { sequence: [4, 128, 7], geometry: [48], nodes: [32, 14], context: [24], extra: [1] };
  const report = auditDataset({ records: [record] });
  assert.ok(report.blocking_findings.some(finding => /model_input.*shapes\.extra.*not allowed/i.test(finding)));
});

test('audit reports a malformed record missing model_input without throwing', () => {
  const record = validRecord();
  delete record.model_input;
  const report = auditDataset({ records: [record] });
  assert.ok(report.blocking_findings.some(finding => /model_input.*required/i.test(finding)));
});
