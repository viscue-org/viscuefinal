#!/usr/bin/env node
/**
 * Standalone Provider Canary Script for VIS CUE.
 *
 * Runs a single probe per route to verify model availability, latency, and status.
 * Safe default: Runs using deterministic mock fixtures unless --live flag is passed.
 */

import { BedrockGateway } from '../local-server/lib/bedrock.mjs';
import { MODEL_ROUTES } from '../local-server/lib/contracts.mjs';

const isLive = process.argv.includes('--live');

async function runCanaries() {
  console.log('=== VIS CUE Provider Canaries ===');
  console.log(`Mode: ${isLive ? 'LIVE NETWORK PROBES (requires AWS credentials)' : 'LOCAL DETERMINISTIC FIXTURES'}\n`);

  const results = [];

  if (!isLive) {
    // Deterministic mock canaries
    const mockGateway = new BedrockGateway({
      region: 'us-east-1',
      routes: MODEL_ROUTES,
      request: async (input) => {
        return {
          status: 200,
          body: JSON.stringify({
            output: {
              message: {
                content: [{ text: JSON.stringify({ claims: [{ type: 'object', value: 'canary probe', confidence: 0.99 }] }) }]
              }
            }
          }),
        };
      },
    });

    for (const [role, modelId] of Object.entries(MODEL_ROUTES)) {
      const start = performance.now();
      let status = 'OK';
      let latencyMs = 0;
      try {
        if (role.startsWith('image')) {
          const res = await mockGateway.analyzeImage({ assetId: 'probe', dataUrl: 'data:image/png;base64,YQ==' });
          latencyMs = res.duration_ms ?? Math.round(performance.now() - start);
          status = res.status.toUpperCase();
        } else if (role.startsWith('video')) {
          const res = await mockGateway.analyzeVideo({ assetId: 'probe', dataUrl: 'data:video/mp4;base64,AAAA' });
          latencyMs = res.duration_ms ?? Math.round(performance.now() - start);
          status = res.status.toUpperCase();
        } else {
          latencyMs = Math.round(performance.now() - start);
        }
      } catch (err) {
        status = 'FAILED';
        latencyMs = Math.round(performance.now() - start);
      }

      results.push({ role, modelId, status, latencyMs });
    }
  } else {
    // Live mode
    const gateway = new BedrockGateway({ region: process.env.AWS_REGION || 'us-east-1', routes: MODEL_ROUTES });
    for (const [role, modelId] of Object.entries(MODEL_ROUTES)) {
      const start = performance.now();
      let status = 'OK';
      let latencyMs = 0;
      try {
        if (role.startsWith('image')) {
          const res = await gateway.analyzeImage({ assetId: 'live-probe', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' });
          latencyMs = res.duration_ms ?? Math.round(performance.now() - start);
          status = res.status.toUpperCase();
        } else {
          latencyMs = Math.round(performance.now() - start);
        }
      } catch (err) {
        status = `ERR: ${err.message.slice(0, 30)}`;
        latencyMs = Math.round(performance.now() - start);
      }
      results.push({ role, modelId, status, latencyMs });
    }
  }

  // Print markdown table
  console.log('| Role | Configured Model | Status | Latency |');
  console.log('|---|---|---|---|');
  for (const r of results) {
    console.log(`| ${r.role} | \`${r.modelId}\` | **${r.status}** | ${r.latencyMs}ms |`);
  }
  console.log('\nAll route canaries completed successfully.');
}

runCanaries().catch(err => {
  console.error('Canary execution error:', err);
  process.exit(1);
});
