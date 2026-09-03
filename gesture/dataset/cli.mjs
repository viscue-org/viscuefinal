import fs from 'node:fs/promises';
import path from 'node:path';
import { buildDataset, freezeManifest, verifyManifest } from './manifest.mjs';
import { auditDatasetDirectory } from './audit.mjs';

function usage() { return 'Usage: node gesture/dataset/cli.mjs <generate|audit|freeze> [--personas N --samples N --seed N --out DIR | --dataset DIR]'; }
function parseArguments(argumentsList) {
  const [command, ...rest] = argumentsList; if (!['generate', 'audit', 'freeze'].includes(command)) throw new Error(usage());
  const allowed = command === 'generate' ? new Set(['--personas', '--samples', '--seed', '--out', '--shard-size']) : new Set(['--dataset']);
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index]; const value = rest[index + 1];
    if (!allowed.has(key) || value === undefined || Object.hasOwn(values, key)) throw new Error(usage());
    values[key] = value;
  }
  if (command === 'generate' && !['--personas', '--samples', '--seed', '--out'].every(key => Object.hasOwn(values, key))) throw new Error(usage());
  if (command !== 'generate' && !Object.hasOwn(values, '--dataset')) throw new Error(usage());
  return { command, values };
}
async function main(argumentsList) {
  const { command, values } = parseArguments(argumentsList);
  if (command === 'generate') {
    const manifest = await buildDataset({ dir: values['--out'], personas: values['--personas'], samples: values['--samples'], seed: values['--seed'], shardSize: values['--shard-size'] });
    console.log(JSON.stringify({ dataset: path.resolve(values['--out']), total_samples: manifest.total_samples, shards: manifest.shards.length, manifest: 'manifest.json' }));
    return;
  }
  const directory = path.resolve(values['--dataset']);
  if (command === 'audit') {
    const { report } = await auditDatasetDirectory(directory);
    console.log(JSON.stringify(report));
    if (report.blocking_findings.length) process.exitCode = 1;
    return;
  }
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const audit = JSON.parse(await fs.readFile(path.join(directory, 'audit-report.json'), 'utf8'));
  const frozen = await freezeManifest(manifest, { dir: directory, auditReport: audit, requireFreshAudit: true });
  await verifyManifest(frozen, { dir: directory, requireFreeze: true });
  console.log(JSON.stringify({ dataset: directory, frozen: true, manifest_sha256: frozen.freeze.manifest_sha256 }));
}

main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
