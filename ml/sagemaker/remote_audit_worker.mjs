import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';

const [sourceDirectory, manifestFile, generationSourceSha256, reportFile] = process.argv.slice(2);
if (![sourceDirectory, manifestFile, generationSourceSha256, reportFile].every(Boolean)) {
  throw new Error('remote audit worker requires source, manifest, generation hash, and report paths');
}

const auditModule = pathToFileURL(path.join(sourceDirectory, 'gesture/dataset/audit.mjs')).href;
const audit = await import(`${auditModule}?recovery=1`);
const manifestBytes = await fs.readFile(manifestFile);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const session = await audit.beginIncrementalAudit(manifestBytes, {
  verifiedGenerationSourceTreeSha256: generationSourceSha256,
});

for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  if (line.trim()) audit.pushIncrementalRecord(session, JSON.parse(line));
}

const shardHashes = Object.fromEntries(manifest.shards.map(shard => [shard.path, shard.sha256]));
const report = audit.finishIncrementalAudit(session, shardHashes);
await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
