#!/usr/bin/env node
/**
 * Provider Latency & Reliability Benchmark Runner for VIS CUE.
 *
 * Measures warmup, p50/p95 latency, fallback rate, and error rate across routes.
 * Safe default: Runs using deterministic synthetic benchmarks unless --live flag is passed.
 */

import { BedrockGateway } from '../local-server/lib/bedrock.mjs';
import { MODEL_ROUTES } from '../local-server/lib/contracts.mjs';

const args = process.argv.slice(2);
const isLive = args.includes('--live');
const trialsArg = args.find(a => a.startsWith('--trials='));
const TRIALS = trialsArg ? Math.max(2, parseInt(trialsArg.slice(9), 10) || 5) : 5;

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function runBenchmark() {
  console.log('=== VIS CUE Provider Benchmark Runner ===');
  console.log(`Mode: ${isLive ? 'LIVE NETWORK (AWS Bedrock)' : 'SYNTHETIC LOCAL FIXTURES'}`);
  console.log(`Trials per route: ${TRIALS} (+ 1 discarded warmup)\n`);

  let gateway;
  if (!isLive) {
    gateway = new BedrockGateway({
      region: 'us-east-1',
      routes: MODEL_ROUTES,
      request: async (input) => {
        // Simulate realistic variance in latency
        const baseLatency = input.modelId.includes('qwen') ? 80 : 45;
        const jitter = Math.floor(Math.random() * 25);
        await new Promise(r => setTimeout(r, baseLatency + jitter));

        return {
          status: 200,
          body: JSON.stringify({
            output: {
              message: {
                content: [{ text: JSON.stringify({ claims: [{ type: 'object', value: 'benchmark item', confidence: 0.95 }] }) }]
              }
            }
          }),
        };
      },
    });
  } else {
    gateway = new BedrockGateway({
      region: process.env.AWS_REGION || 'us-east-1',
      routes: MODEL_ROUTES,
    });
  }

  const routesToTest = [
    { name: 'Visual Perception (Primary)', role: 'imagePrimary', run: () => gateway.analyzeImage({ assetId: 'bench-1', dataUrl: 'data:image/png;base64,YQ==' }) },
    { name: 'Visual Perception (Fallback)', role: 'imageFallback', run: () => gateway.analyzeImage({ assetId: 'bench-fb', dataUrl: 'data:image/png;base64,YQ==' }) },
    { name: 'Video Perception', role: 'videoPrimary', run: () => gateway.analyzeVideo({ assetId: 'bench-vid', dataUrl: 'data:video/mp4;base64,AAAA' }) },
  ];

  const results = [];

  for (const route of routesToTest) {
    process.stdout.write(`Benchmarking ${route.name}... `);

    // Warmup (discarded)
    try {
      await route.run();
    } catch { /* ignore warmup error */ }

    const latencies = [];
    let fallbacks = 0;
    let errors = 0;

    for (let i = 0; i < TRIALS; i++) {
      const start = performance.now();
      try {
        const res = await route.run();
        const duration = res?.duration_ms ?? Math.round(performance.now() - start);
        latencies.push(duration);
        if (res?.fallback) fallbacks++;
      } catch (err) {
        errors++;
        latencies.push(Math.round(performance.now() - start));
      }
    }

    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    const fallbackRate = `${((fallbacks / TRIALS) * 100).toFixed(0)}%`;
    const errorRate = `${((errors / TRIALS) * 100).toFixed(0)}%`;

    results.push({
      name: route.name,
      model: MODEL_ROUTES[route.role],
      p50,
      p95,
      fallbackRate,
      errorRate,
    });

    console.log('done.');
  }

  console.log('\n### Benchmark Results\n');
  console.log('| Route | Model | p50 Latency | p95 Latency | Fallback Rate | Error Rate |');
  console.log('|---|---|---|---|---|---|');
  for (const r of results) {
    console.log(`| ${r.name} | \`${r.model}\` | ${r.p50}ms | ${r.p95}ms | ${r.fallbackRate} | ${r.errorRate} |`);
  }
  console.log('');
}

runBenchmark().catch(err => {
  console.error('Benchmark runner failed:', err);
  process.exit(1);
});
