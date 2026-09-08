/**
 * Local Human Gesture Validation Lab for VIS CUE.
 *
 * Provides local statistical evaluation:
 * - Wilson 95% Confidence Intervals for selective classification
 * - Macro F1 scoring across gesture taxonomy
 * - Selective Precision vs Coverage trade-offs
 * - Out-of-Distribution (OOD) False Accept Rate calculation
 * - Expected Calibration Error (ECE) for model confidence
 * - Sanitized JSON and standalone HTML reporting
 *
 * PRIVACY GUARANTEE:
 * All calculations and exports operate strictly on classified intent labels and confidence values.
 * Raw stroke coordinates, point arrays, and imagery NEVER leave the local client.
 */

import { INTENTS } from '../shared/taxonomy.mjs';

/**
 * Computes the Wilson score confidence interval for a binomial proportion.
 * @param {number} successes - Count of correct classifications
 * @param {number} total - Total trials
 * @param {number} confidence - Confidence level (default 0.95 -> z ~ 1.96)
 * @returns {{ lower: number, upper: number, center: number }}
 */
export function computeWilsonScoreInterval(successes, total, confidence = 0.95) {
  if (total <= 0) return { lower: 0, upper: 0, center: 0 };
  const zValues = {
    0.90: 1.6448536269514722,
    0.95: 1.959963984540054,
    0.99: 2.5758293035489004,
  };
  const z = zValues[confidence] || 1.959963984540054;
  const p = Math.max(0, Math.min(1, successes / total));
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const factor = (z / denominator) * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);

  return {
    lower: Math.max(0, Number((center - factor).toFixed(4))),
    upper: Math.min(1, Number((center + factor).toFixed(4))),
    center: Number(center.toFixed(4)),
  };
}

/**
 * Computes Macro-averaged Precision, Recall, and F1 across target classes.
 * @param {Array<string>} groundTruths
 * @param {Array<string>} predictions
 * @param {Array<string>} labels
 */
export function computeMacroF1(groundTruths = [], predictions = [], labels = null) {
  if (groundTruths.length === 0 || groundTruths.length !== predictions.length) {
    return { macroF1: 0, macroPrecision: 0, macroRecall: 0, classes: {} };
  }

  const uniqueLabels = labels || [...new Set([...groundTruths, ...predictions])];
  const classMetrics = {};

  let totalPrecision = 0;
  let totalRecall = 0;
  let totalF1 = 0;
  let evaluatedClasses = 0;

  for (const label of uniqueLabels) {
    let tp = 0;
    let fp = 0;
    let fn = 0;

    for (let i = 0; i < groundTruths.length; i++) {
      const gt = groundTruths[i];
      const pred = predictions[i];
      if (pred === label && gt === label) tp++;
      else if (pred === label && gt !== label) fp++;
      else if (pred !== label && gt === label) fn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const support = tp + fn;

    classMetrics[label] = {
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      support,
    };

    if (support > 0 || fp > 0) {
      totalPrecision += precision;
      totalRecall += recall;
      totalF1 += f1;
      evaluatedClasses++;
    }
  }

  const count = Math.max(1, evaluatedClasses);
  return {
    macroF1: Number((totalF1 / count).toFixed(4)),
    macroPrecision: Number((totalPrecision / count).toFixed(4)),
    macroRecall: Number((totalRecall / count).toFixed(4)),
    classes: classMetrics,
  };
}

/**
 * Evaluates Selective Precision and Coverage above a confidence threshold.
 * @param {Array<{ groundTruth: string, prediction: string, confidence: number }>} trials
 * @param {number} threshold
 */
export function computeSelectivePrecision(trials = [], threshold = 0.7) {
  if (!trials.length) return { coverage: 0, precision: 0, count: 0, total: 0 };
  const qualified = trials.filter(t => (t.confidence ?? 1) >= threshold);
  const correct = qualified.filter(t => t.groundTruth === t.prediction).length;

  const coverage = Number((qualified.length / trials.length).toFixed(4));
  const precision = qualified.length > 0 ? Number((correct / qualified.length).toFixed(4)) : 0;

  return {
    threshold,
    coverage,
    precision,
    count: qualified.length,
    total: trials.length,
  };
}

/**
 * Computes the Out-of-Distribution (OOD) False Accept Rate.
 * OOD trials are non-gesture / accidental movements that should be abstained.
 * @param {Array<{ confidence: number, accepted?: boolean, intent?: string }>} oodTrials
 * @param {number} threshold
 */
export function computeOODFalseAcceptRate(oodTrials = [], threshold = 0.7) {
  if (!oodTrials.length) return { falseAcceptRate: 0, falseAcceptCount: 0, total: 0 };
  const falseAccepts = oodTrials.filter(t => {
    const isAccepted = t.accepted !== false && t.intent && t.intent !== 'unknown';
    const isConfident = (t.confidence ?? 0) >= threshold;
    return isAccepted && isConfident;
  }).length;

  return {
    threshold,
    falseAcceptCount: falseAccepts,
    total: oodTrials.length,
    falseAcceptRate: Number((falseAccepts / oodTrials.length).toFixed(4)),
  };
}

/**
 * Computes Expected Calibration Error (ECE) across confidence bins.
 * @param {Array<{ confidence: number, correct: boolean }>} items
 * @param {number} numBins
 */
export function computeECE(items = [], numBins = 10) {
  if (!items.length) return { ece: 0, bins: [] };

  const bins = Array.from({ length: numBins }, (_, i) => ({
    binIndex: i,
    lower: i / numBins,
    upper: (i + 1) / numBins,
    items: [],
  }));

  for (const item of items) {
    const conf = Math.max(0, Math.min(1, item.confidence ?? 0));
    const binIdx = Math.min(numBins - 1, Math.floor(conf * numBins));
    bins[binIdx].items.push(item);
  }

  let totalEce = 0;
  const processedBins = bins.map(bin => {
    const count = bin.items.length;
    if (count === 0) {
      return { ...bin, count: 0, avgConfidence: 0, accuracy: 0, calibrationError: 0 };
    }
    const avgConfidence = bin.items.reduce((s, it) => s + (it.confidence ?? 0), 0) / count;
    const correctCount = bin.items.filter(it => it.correct === true).length;
    const accuracy = correctCount / count;
    const calibrationError = Math.abs(accuracy - avgConfidence);

    totalEce += (count / items.length) * calibrationError;

    return {
      lower: bin.lower,
      upper: bin.upper,
      count,
      avgConfidence: Number(avgConfidence.toFixed(4)),
      accuracy: Number(accuracy.toFixed(4)),
      calibrationError: Number(calibrationError.toFixed(4)),
    };
  });

  return {
    ece: Number(totalEce.toFixed(4)),
    bins: processedBins,
  };
}

/**
 * Generates sanitized JSON and standalone HTML reports from validation study data.
 */
export function exportValidationReport(studyData = {}, options = {}) {
  const {
    trials = [],
    oodTrials = [],
    studyTitle = 'VIS CUE Human Gesture Validation Study',
    participantCount = 1,
    modelVersion = 'gesture-resolver-v1',
  } = studyData;

  const total = trials.length;
  const correct = trials.filter(t => t.groundTruth === t.prediction).length;
  const wilson = computeWilsonScoreInterval(correct, total, 0.95);

  const groundTruths = trials.map(t => t.groundTruth);
  const predictions = trials.map(t => t.prediction);
  const macro = computeMacroF1(groundTruths, predictions);

  const selective70 = computeSelectivePrecision(trials, 0.7);
  const selective85 = computeSelectivePrecision(trials, 0.85);
  const ood = computeOODFalseAcceptRate(oodTrials, 0.7);

  const calibrationItems = trials.map(t => ({
    confidence: t.confidence ?? 1,
    correct: t.groundTruth === t.prediction,
  }));
  const calibration = computeECE(calibrationItems, 10);

  const sanitizedJson = {
    title: studyTitle,
    modelVersion,
    timestamp: new Date().toISOString(),
    participants: participantCount,
    totalTrials: total,
    rawAccuracy: total > 0 ? Number((correct / total).toFixed(4)) : 0,
    wilsonInterval95: wilson,
    macroF1: macro.macroF1,
    macroPrecision: macro.macroPrecision,
    macroRecall: macro.macroRecall,
    selectivePrecision: {
      threshold_0_70: selective70,
      threshold_0_85: selective85,
    },
    oodFalseAcceptRate: ood,
    expectedCalibrationError: calibration.ece,
    classes: macro.classes,
  };

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(studyTitle)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b131e; color: #e2e8f0; margin: 0; padding: 32px 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 4px; color: #ffffff; }
    .meta { color: #94a3b8; font-size: 13px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .card { background: #162232; border: 1px solid #233549; border-radius: 10px; padding: 16px; }
    .card-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 6px; }
    .card-value { font-size: 26px; font-weight: 700; color: #ffffff; }
    .card-sub { font-size: 12px; color: #38bdf8; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; background: #162232; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #233549; }
    th { background: #1c2b3e; color: #94a3b8; font-size: 11px; text-transform: uppercase; }
    .privacy-notice { margin-top: 40px; padding: 12px 16px; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px; font-size: 12px; color: #7dd3fc; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(studyTitle)}</h1>
    <div class="meta">Model: <strong>${escapeHtml(modelVersion)}</strong> • Evaluated on: ${new Date().toLocaleDateString()} • Participants: ${participantCount}</div>

    <div class="grid">
      <div class="card">
        <div class="card-label">Accuracy (95% CI)</div>
        <div class="card-value">${(sanitizedJson.rawAccuracy * 100).toFixed(1)}%</div>
        <div class="card-sub">[${(wilson.lower * 100).toFixed(1)}%, ${(wilson.upper * 100).toFixed(1)}%]</div>
      </div>
      <div class="card">
        <div class="card-label">Macro F1 Score</div>
        <div class="card-value">${(sanitizedJson.macroF1 * 100).toFixed(1)}%</div>
        <div class="card-sub">Precision: ${(sanitizedJson.macroPrecision * 100).toFixed(1)}%</div>
      </div>
      <div class="card">
        <div class="card-label">Selective Prec. (&ge;0.70)</div>
        <div class="card-value">${(selective70.precision * 100).toFixed(1)}%</div>
        <div class="card-sub">Coverage: ${(selective70.coverage * 100).toFixed(1)}%</div>
      </div>
      <div class="card">
        <div class="card-label">OOD False Accept Rate</div>
        <div class="card-value">${(ood.falseAcceptRate * 100).toFixed(1)}%</div>
        <div class="card-sub">${ood.falseAcceptCount} / ${ood.total} accidental</div>
      </div>
      <div class="card">
        <div class="card-label">Expected Calib. Error</div>
        <div class="card-value">${(calibration.ece * 100).toFixed(2)}%</div>
        <div class="card-sub">10-bin calibration</div>
      </div>
    </div>

    <h2>Per-Class Evaluation</h2>
    <table>
      <thead>
        <tr><th>Class Intent</th><th>Precision</th><th>Recall</th><th>F1 Score</th><th>Support</th></tr>
      </thead>
      <tbody>
        ${Object.entries(macro.classes).map(([label, metrics]) => `
          <tr>
            <td><strong>${escapeHtml(label)}</strong></td>
            <td>${(metrics.precision * 100).toFixed(1)}%</td>
            <td>${(metrics.recall * 100).toFixed(1)}%</td>
            <td>${(metrics.f1 * 100).toFixed(1)}%</td>
            <td>${metrics.support}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="privacy-notice">
      🔒 <strong>Privacy Assurance:</strong> This report was computed entirely in local memory on this workstation. No stroke coordinate streams, point sequences, or raw imagery are stored or transmitted.
    </div>
  </div>
</body>
</html>`;

  return { json: sanitizedJson, html };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
