import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const outputRoot = '/opt/ml/processing/output/dataset';
const requested = resolve(process.env.OUTPUT_PATH || outputRoot);
if (requested !== outputRoot && !requested.startsWith(`${outputRoot}/`)) {
  throw new Error('OUTPUT_PATH must stay under the SageMaker Processing output directory');
}

const values = {
  personas: Number.parseInt(process.env.PERSONAS || '1000', 10),
  samples: Number.parseInt(process.env.SAMPLES || '10000', 10),
  seed: Number.parseInt(process.env.SEED || '20260827', 10),
};
for (const [name, value] of Object.entries(values)) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive safe integer`);
}

function run(args) {
  const result = spawnSync('node', ['/app/gesture/dataset/cli.mjs', ...args], {
    cwd: '/app', stdio: 'inherit', shell: false,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(['generate', '--personas', String(values.personas), '--samples', String(values.samples), '--seed', String(values.seed), '--out', requested]);
run(['audit', '--dataset', requested]);
run(['freeze', '--dataset', requested]);
