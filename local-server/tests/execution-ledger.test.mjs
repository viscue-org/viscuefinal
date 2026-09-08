import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStageEntry,
  deriveTrustBanner,
  groupLedgerStages,
  normalizeExecutionLedger,
  redactSensitiveText,
} from '../lib/execution-ledger.mjs';

test('normalizeStageEntry enforces redacted schema with fallbacks and attempts', () => {
  const raw = {
    name: 'perception.asset-123',
    status: 'ok',
    provider: 'aws-bedrock',
    model: 'qwen.qwen3-vl-235b-a22b',
    duration_ms: 3720.4,
    evidence_count: 4,
    fallback: false,
    attempt: 1,
  };

  const normalized = normalizeStageEntry(raw);
  assert.equal(normalized.name, 'perception.asset-123');
  assert.equal(normalized.role, 'visual perception');
  assert.equal(normalized.status, 'ok');
  assert.equal(normalized.provider, 'aws-bedrock');
  assert.equal(normalized.model, 'qwen.qwen3-vl-235b-a22b');
  assert.equal(normalized.duration_ms, 3720);
  assert.equal(normalized.evidence_count, 4);
  assert.equal(normalized.fallback, false);
  assert.equal(normalized.fallback_from, null);
  assert.equal(normalized.attempt, 1);
  assert.equal(normalized.message, '4 grounded observations');
});

test('normalizeStageEntry redacts bearer tokens, API keys, and stack traces', () => {
  const raw = {
    name: 'compiler.mistral',
    status: 'degraded',
    message: 'Error with Bearer sk-secret123456789\n  at callBedrock (file:///bedrock.mjs:42:10)',
    warning: 'api_key=my_secret_token_123',
  };

  const normalized = normalizeStageEntry(raw);
  assert.ok(!normalized.message.includes('sk-secret'));
  assert.ok(!normalized.message.includes('file:///bedrock.mjs'));
  assert.ok(normalized.message.includes('[REDACTED]'));
});

test('deriveTrustBanner produces "All AI stages completed" when models succeed without fallback', () => {
  const ledger = [
    { name: 'plan.selection', status: 'ok', provider: 'deterministic' },
    { name: 'perception.img1', status: 'ok', provider: 'qwen', model: 'qwen.qwen3-vl-235b-a22b', fallback: false },
    { name: 'compiler.mistral', status: 'ok', provider: 'mistral', model: 'mistral-large', fallback: false },
  ];
  const trust = deriveTrustBanner(ledger);
  assert.equal(trust.banner, 'All AI stages completed');
  assert.equal(trust.level, 'ok');
});

test('deriveTrustBanner produces "Completed with fallback" when any model falls back or degrades', () => {
  const ledger = [
    { name: 'plan.selection', status: 'ok', provider: 'deterministic' },
    { name: 'perception.img1', status: 'degraded', provider: 'nova-pro', fallback: true, fallback_from: 'qwen' },
    { name: 'compiler.mistral', status: 'ok', provider: 'mistral' },
  ];
  const trust = deriveTrustBanner(ledger);
  assert.equal(trust.banner, 'Completed with fallback');
  assert.equal(trust.level, 'fallback');
});

test('deriveTrustBanner produces "Deterministic only" when all AI models are skipped or deterministic', () => {
  const ledger = [
    { name: 'plan.selection', status: 'ok', provider: 'deterministic' },
    { name: 'perception.img1', status: 'skipped', provider: 'deterministic' },
    { name: 'compiler.brief', status: 'ok', provider: 'deterministic' },
  ];
  const trust = deriveTrustBanner(ledger);
  assert.equal(trust.banner, 'Deterministic only');
  assert.equal(trust.level, 'deterministic');
});

test('deriveTrustBanner produces "Action required" when a stage is blocked', () => {
  const ledger = [
    { name: 'plan.selection', status: 'blocked', message: 'Visual references exceed free plan limit of 2' },
  ];
  const trust = deriveTrustBanner(ledger);
  assert.equal(trust.banner, 'Action required');
  assert.equal(trust.level, 'blocked');
});

test('groupLedgerStages groups stages into visual, relevance, compilation, safety', () => {
  const ledger = [
    { name: 'plan.selection', role: 'plan selection' },
    { name: 'perception.asset1', role: 'visual perception' },
    { name: 'font.asset1', role: 'font identification' },
    { name: 'relevance.titan', role: 'relevance' },
    { name: 'compiler.mistral', role: 'instruction compilation' },
    { name: 'verification.safety', role: 'safety verification' },
  ];
  const groups = groupLedgerStages(ledger);
  assert.equal(groups.visual.length, 2); // perception + font
  assert.equal(groups.relevance.length, 1);
  assert.equal(groups.compilation.length, 1);
  assert.equal(groups.safety.length, 2); // plan + verification
});

test('normalizeExecutionLedger produces a complete ledger bundle with total duration', () => {
  const rawStages = [
    { name: 'perception.1', status: 'ok', duration_ms: 1200, provider: 'qwen', evidence_count: 2 },
    { name: 'compiler.1', status: 'ok', duration_ms: 800, provider: 'mistral' },
  ];
  const result = normalizeExecutionLedger(rawStages);
  assert.equal(result.stages.length, 2);
  assert.equal(result.total_duration_ms, 2000);
  assert.equal(result.trust.banner, 'All AI stages completed');
  assert.ok(result.timestamp);
});
