import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWilsonScoreInterval,
  computeMacroF1,
  computeSelectivePrecision,
  computeOODFalseAcceptRate,
  computeECE,
  exportValidationReport,
} from '../runtime/validation-lab.mjs';

test('Wilson Score Interval: Computes 95% CI correctly and handles edge cases', () => {
  const empty = computeWilsonScoreInterval(0, 0);
  assert.equal(empty.lower, 0);
  assert.equal(empty.upper, 0);

  const perfect = computeWilsonScoreInterval(100, 100, 0.95);
  assert.ok(perfect.lower > 0.95);
  assert.equal(perfect.upper, 1);

  const typical = computeWilsonScoreInterval(90, 100, 0.95);
  assert.ok(typical.lower >= 0.82 && typical.lower <= 0.85);
  assert.ok(typical.upper >= 0.94 && typical.upper <= 0.96);
  assert.ok(typical.lower < typical.center && typical.center < typical.upper);
});

test('Macro F1: Evaluates precision, recall, and F1 across gesture classes', () => {
  const groundTruths = ['connect', 'connect', 'lasso_select', 'move'];
  const predictions = ['connect', 'lasso_select', 'lasso_select', 'move'];

  const result = computeMacroF1(groundTruths, predictions, ['connect', 'lasso_select', 'move']);
  assert.ok(result.macroF1 > 0.7);
  assert.equal(result.classes.move.f1, 1.0);
  assert.equal(result.classes.connect.recall, 0.5);
  assert.equal(result.classes.lasso_select.precision, 0.5);
});

test('Selective Precision: Computes coverage and precision trade-off', () => {
  const trials = [
    { groundTruth: 'connect', prediction: 'connect', confidence: 0.92 },
    { groundTruth: 'move', prediction: 'move', confidence: 0.85 },
    { groundTruth: 'resize', prediction: 'rotate', confidence: 0.65 }, // low confidence
    { groundTruth: 'point_to', prediction: 'point_to', confidence: 0.75 },
  ];

  const selective = computeSelectivePrecision(trials, 0.7);
  assert.equal(selective.count, 3);
  assert.equal(selective.coverage, 0.75);
  assert.equal(selective.precision, 1.0); // all 3 above threshold are correct!
});

test('OOD False Accept Rate: Measures rejection on non-gesture inputs', () => {
  const oodTrials = [
    { intent: 'unknown', accepted: false, confidence: 0.2 },
    { intent: 'unknown', accepted: false, confidence: 0.4 },
    { intent: 'connect', accepted: true, confidence: 0.8 }, // False accept!
    { intent: 'move', accepted: false, confidence: 0.6 },
  ];

  const result = computeOODFalseAcceptRate(oodTrials, 0.7);
  assert.equal(result.total, 4);
  assert.equal(result.falseAcceptCount, 1);
  assert.equal(result.falseAcceptRate, 0.25);
});

test('ECE: Computes Expected Calibration Error across confidence bins', () => {
  const items = [
    { confidence: 0.95, correct: true },
    { confidence: 0.92, correct: true },
    { confidence: 0.88, correct: true },
    { confidence: 0.81, correct: false },
    { confidence: 0.75, correct: true },
    { confidence: 0.62, correct: false },
  ];

  const { ece, bins } = computeECE(items, 10);
  assert.equal(typeof ece, 'number');
  assert.ok(ece >= 0 && ece <= 1);
  assert.equal(bins.length, 10);
});

test('Report Exporter: Generates sanitized JSON and HTML without leaking raw coordinates', () => {
  const studyData = {
    studyTitle: 'Gesture Benchmark Study #42',
    participantCount: 5,
    trials: [
      { groundTruth: 'connect', prediction: 'connect', confidence: 0.95 },
      { groundTruth: 'move', prediction: 'move', confidence: 0.88 },
      { groundTruth: 'lasso_select', prediction: 'select_region', confidence: 0.60 },
    ],
    oodTrials: [
      { intent: 'unknown', accepted: false, confidence: 0.1 },
    ],
  };

  const { json, html } = exportValidationReport(studyData);

  assert.equal(json.title, 'Gesture Benchmark Study #42');
  assert.equal(json.totalTrials, 3);
  assert.ok(json.rawAccuracy > 0.6);
  assert.ok(html.includes('Gesture Benchmark Study #42'));
  assert.ok(html.includes('<!doctype html>'));

  // Assert zero coordinate/raw point leakage
  assert.doesNotMatch(html, /pointer_id|clientX|clientY|points|time_ms/);
  assert.doesNotMatch(JSON.stringify(json), /pointer_id|clientX|clientY|points|time_ms/);
});
