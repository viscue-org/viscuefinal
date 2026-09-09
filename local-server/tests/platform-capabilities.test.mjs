import test from 'node:test';
import assert from 'node:assert/strict';
import {
  destinationReferenceLimit,
  effectiveReferenceLimit,
  normalizePlatformCapability,
} from '../lib/platform-capabilities.mjs';

const destinationCases = [
  ['chatgpt', 'free', 2],
  ['chatgpt', 'plus', 10],
  ['chatgpt', 'pro', 20],
  ['gemini', 'free', 2],
  ['gemini', 'pro', 10],
  ['gemini', 'ultra', 10],
  ['claude', 'free', 2],
  ['claude', 'pro', 10],
  ['claude', 'max', 20],
  ['copilot', 'free', 2],
  ['copilot', 'pro', 10],
  ['copilot', 'microsoft-365', 20],
  ['perplexity', 'free', 2],
  ['perplexity', 'pro', 4],
  ['perplexity', 'max', 4],
  ['grok', 'free', 2],
  ['grok', 'supergrok', 4],
  ['grok', 'supergrok-heavy', 10],
];

test('destination subscription plans map to conservative physical visual limits', () => {
  for (const [platform, plan, want] of destinationCases) {
    assert.equal(destinationReferenceLimit({ platform, plan }).limit, want, `${platform}/${plan}`);
  }
});

test('unknown or mismatched capability values fail to the detected platform free plan', () => {
  assert.deepEqual(normalizePlatformCapability({ platform: 'Claude', plan: 'enterprise-root' }, 'claude'), {
    schemaVersion: 1,
    registryVersion: '2026-09-07',
    platform: 'claude',
    plan: 'free',
    confidence: 'verified',
  });
  assert.equal(destinationReferenceLimit({ platform: 'future-ai', plan: 'unlimited' }).limit, 2);
});

test('effective limit is the lower destination and Viscue allowance and names the constraint', () => {
  assert.deepStrictEqual(effectiveReferenceLimit({ viscuePlan: 'free', capability: { platform: 'claude', plan: 'max' } }), {
    limit: 20,
    viscueLimit: 20,
    destinationLimit: 20,
    providerCeiling: 20,
    constrainedBy: 'viscue',
    capability: normalizePlatformCapability({ platform: 'claude', plan: 'max' }, 'claude'),
  });
  assert.equal(effectiveReferenceLimit({ viscuePlan: 'plus', capability: { platform: 'perplexity', plan: 'max' } }).limit, 4);
  assert.equal(effectiveReferenceLimit({ viscuePlan: 'pro', capability: { platform: 'gemini', plan: 'ultra' } }).limit, 10);
});

test('unknown Viscue plans never grant more than free', () => {
  assert.equal(effectiveReferenceLimit({ viscuePlan: 'enterprise', capability: { platform: 'chatgpt', plan: 'pro' } }).limit, 20);
});
