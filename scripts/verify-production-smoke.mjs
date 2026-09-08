#!/usr/bin/env node
/**
 * Opt-In Authenticated Production Smoke Verifier for VIS CUE.
 *
 * SAFETY CONTRACT:
 * - This script is STRICTLY OPT-IN and is NEVER executed by `npm test`.
 * - Requires explicit authentication token: VISCUE_E2E_AUTH_TOKEN env var or --auth-token.
 * - Prominently warns that exactly 1 Cue will be consumed and requires --confirm-spend or interactive confirmation.
 * - Submits a bounded, single-probe synthetic text intent.
 * - Validates schema, trust banner, latency metrics, and secret redaction.
 * - Saves a sanitized audit report to artifacts/reports/production-smoke-report.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { normalizeExecutionLedger } from '../local-server/lib/execution-ledger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getArgValue = (prefix) => {
  const match = args.find(a => a.startsWith(`${prefix}=`));
  return match ? match.slice(prefix.length + 1) : null;
};

const authToken = process.env.VISCUE_E2E_AUTH_TOKEN || getArgValue('--auth-token');
const endpointUrl = process.env.VISCUE_API_URL || getArgValue('--endpoint') || 'http://127.0.0.1:8787/compile';
const confirmSpend = hasFlag('--confirm-spend');
const dryRun = hasFlag('--dry-run');

async function promptConfirmation() {
  if (confirmSpend) return true;
  if (!process.stdin.isTTY) return false;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(
      '\n[VIS CUE SMOKE VERIFIER] Running this against live production will consume exactly 1 Cue.\nAre you sure you want to proceed? (yes/no): ',
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'yes' || answer.trim().toLowerCase() === 'y');
      }
    );
  });
}

async function runProductionSmoke() {
  console.log('=== VIS CUE System Trust & Production Smoke Verifier ===\n');

  if (!authToken) {
    console.log('VISCUE_E2E_AUTH_TOKEN not set. Production smoke verification skipped (opt-in only).');
    console.log('To run live smoke verification, set VISCUE_E2E_AUTH_TOKEN=<token> and provide --confirm-spend.\n');
    process.exit(0);
  }

  if (dryRun) {
    console.log('[DRY-RUN] Auth token detected. Dry run requested — skipping network probe.');
    process.exit(0);
  }

  const confirmed = await promptConfirmation();
  if (!confirmed) {
    console.log('\nExecution aborted. No Cues were consumed.');
    process.exit(0);
  }

  console.log(`\nInitiating bounded smoke probe against ${endpointUrl}...`);
  const nonce = crypto.randomUUID().slice(0, 8);
  const probePrompt = `VIS CUE Production Smoke Verification Probe [${nonce}]`;

  const requestPayload = {
    graph: {
      items: [{ id: 'note-smoke-probe', kind: 'note', text: probePrompt, intentional: true }],
      cues: [],
      motions: [],
      relations: [],
      operations: [],
      destination: 'ChatGPT',
    },
    media: {},
    options: { plan: 'pro' },
    sessionContext: {
      chatId: `smoke-probe-${nonce}`,
      destinationFingerprint: `ChatGPT:smoke-${nonce}`,
      isNewChat: true,
    },
  };

  const startTime = performance.now();
  let response;
  let rawBody;

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(requestPayload),
    });

    rawBody = await res.text();
    const duration = Math.round(performance.now() - startTime);

    try {
      response = JSON.parse(rawBody);
    } catch {
      throw new Error(`Invalid JSON returned by ${endpointUrl} (HTTP ${res.status}): ${rawBody.slice(0, 200)}`);
    }

    if (!res.ok || response.ok === false) {
      throw new Error(`Production endpoint responded with error: ${response.error || rawBody}`);
    }

    console.log(`Response received in ${duration}ms (HTTP ${res.status}).\n`);
  } catch (err) {
    console.error(`\n✖ Smoke probe failed: ${err.message}`);
    process.exit(1);
  }

  // Schema Validation
  const errors = [];
  if (!response.execution_id && !response.executionId) errors.push('Missing execution_id in response');
  if (!response.destination_fingerprint) errors.push('Missing destination_fingerprint in response');
  if (!response.final_prompt) errors.push('Missing final_prompt in response');
  if (!response.prompt_hash && !response.promptHash) errors.push('Missing prompt_hash in response');

  // Ledger and Trust Validation
  const ledger = normalizeExecutionLedger(response.ledger?.stages || response.stages || []);
  if (!ledger.stages || !Array.isArray(ledger.stages)) {
    errors.push('Ledger stages array is missing or invalid');
  }

  // Redaction check: ensure auth token is never leaked in stage messages
  const leakedToken = ledger.stages.some(s => s.message && s.message.includes(authToken));
  if (leakedToken) {
    errors.push('CRITICAL: Auth token leaked in execution ledger message!');
  }

  if (errors.length > 0) {
    console.error('✖ Schema validation failures:');
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  console.log('✔ Execution ID:', response.execution_id || response.executionId);
  console.log('✔ Destination Fingerprint:', response.destination_fingerprint);
  console.log('✔ Trust Banner:', ledger.trust.banner, `(${ledger.trust.level})`);
  console.log('✔ Stages Executed:', ledger.stages.length);
  for (const stage of ledger.stages) {
    console.log(`    [${stage.status.toUpperCase()}] ${stage.name} - ${stage.duration_ms ?? 0}ms (${stage.provider || 'deterministic'})`);
  }

  // Export report to artifacts/reports/production-smoke-report.json
  const reportDir = path.join(ROOT_DIR, 'artifacts', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'production-smoke-report.json');

  const report = {
    timestamp: new Date().toISOString(),
    endpoint: endpointUrl,
    nonce,
    verified: true,
    execution_id: response.execution_id || response.executionId,
    destination_fingerprint: response.destination_fingerprint,
    trust: ledger.trust,
    stages_summary: ledger.stages.map(s => ({
      name: s.name,
      status: s.status,
      provider: s.provider,
      model: s.model,
      duration_ms: s.duration_ms,
      fallback: s.fallback,
    })),
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n✔ Smoke report saved to: ${reportPath}`);
  console.log('=== Production smoke verification passed! ===\n');
}

runProductionSmoke();
