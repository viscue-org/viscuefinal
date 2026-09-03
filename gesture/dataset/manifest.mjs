import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateDataset } from './generate.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const canonical = value => `${JSON.stringify(value, null, 2)}\n`;
const unsignedManifest = manifest => {
  const { freeze: ignored, ...unsigned } = manifest;
  return unsigned;
};

export async function writeJsonAtomically(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  try { await fs.writeFile(temporary, canonical(value)); await fs.rename(temporary, file); }
  catch (error) { await fs.rm(temporary, { force: true }); throw error; }
}

export async function buildDataset(config) {
  const generated = await generateDataset(config);
  const manifest = {
    schema_version: 'dataset-manifest/1.0', dataset_version: config.datasetVersion ?? 'gesture-smoke-v1', status: 'generated', total_samples: generated.configuration.samples,
    configuration: generated.configuration,
    generator: { version: 'gesture-simulator/1.0', geometry_version: 'gesture-geometry/1.0', ...generated.hashes },
    shards: generated.shards, splits: generated.splits, intent_distribution: generated.intent_distribution,
  };
  await writeJsonAtomically(path.join(generated.directory, 'manifest.json'), manifest);
  // A byte-identical resumable run remains frozen. Any changed manifest loses
  // its marker only after every replacement shard and the new manifest exist.
  try {
    const freeze = JSON.parse(await fs.readFile(path.join(generated.directory, 'frozen.json'), 'utf8'));
    if (freeze.manifest_sha256 !== sha256(await fs.readFile(path.join(generated.directory, 'manifest.json')))) await fs.rm(path.join(generated.directory, 'frozen.json'), { force: true });
  } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  return manifest;
}

export async function freezeManifest(manifest, options = {}) {
  const directory = path.resolve(options.dir ?? '.');
  // The caller's object is deliberately ignored: freezing is a disk-bound
  // publication gate and cannot be authorized by a forged in-memory report.
  let auditBytes;
  const { auditDatasetDirectory } = await import('./audit.mjs');
  await auditDatasetDirectory(directory);
  auditBytes = await fs.readFile(path.join(directory, 'audit-report.json'));
  const audit = JSON.parse(auditBytes.toString('utf8'));
  const manifestBytes = await fs.readFile(path.join(directory, 'manifest.json'));
  const manifestHash = sha256(manifestBytes);
  const expectedShardHashes = Object.fromEntries(manifest.shards.map(shard => [shard.path, shard.sha256]));
  if (!audit || audit.schema_version !== 'audit-report/1.0' || audit.record_count !== manifest.total_samples || audit.dataset_manifest_sha256 !== manifestHash || JSON.stringify(audit.shard_hashes) !== JSON.stringify(expectedShardHashes)) throw new Error('audit report is not a fresh binding for this manifest');
  if ((audit.warnings?.length ?? 0) > 0 && (!Array.isArray(audit.warning_dispositions) || audit.warning_dispositions.length < audit.warnings.length)) throw new Error('cannot freeze dataset with unresolved audit warnings');
  const blocking = audit.blocking_findings ?? [];
  if (blocking.length) throw new Error(`cannot freeze dataset: fresh audit has blocking findings: ${blocking.join('; ')}`);
  await verifyManifest(manifest, { dir: directory, requireFreeze: false });
  const freeze = { schema_version: 'dataset-freeze/1.0', manifest_sha256: manifestHash, shard_hashes: expectedShardHashes, audit_sha256: sha256(auditBytes) };
  await writeJsonAtomically(path.join(directory, 'frozen.json'), freeze);
  return { ...manifest, freeze };
}

export async function verifyManifest(manifest, options = {}) {
  const directory = path.resolve(options.dir ?? '.');
  const diskManifestBytes = await fs.readFile(path.join(directory, 'manifest.json'));
  const diskManifest = JSON.parse(diskManifestBytes.toString('utf8'));
  const suppliedUnsigned = unsignedManifest(manifest);
  if (JSON.stringify(suppliedUnsigned) !== JSON.stringify(diskManifest)) throw new Error('manifest object does not match on-disk manifest');
  for (const shard of manifest.shards ?? []) {
    const actual = sha256(await fs.readFile(path.join(directory, shard.path)));
    if (actual !== shard.sha256) throw new Error(`hash mismatch for shard ${shard.path}`);
  }
  const freezeFile = path.join(directory, 'frozen.json');
  try {
    const freeze = JSON.parse(await fs.readFile(freezeFile, 'utf8'));
    if (freeze.manifest_sha256 !== sha256(diskManifestBytes)) throw new Error('hash mismatch for frozen manifest');
    if (JSON.stringify(freeze.shard_hashes) !== JSON.stringify(Object.fromEntries((manifest.shards ?? []).map(shard => [shard.path, shard.sha256])))) throw new Error('hash mismatch for frozen shard map');
    if (freeze.audit_sha256 !== null) {
      const auditBytes = await fs.readFile(path.join(directory, 'audit-report.json'));
      if (freeze.audit_sha256 !== sha256(auditBytes)) throw new Error('hash mismatch for frozen audit report');
    } else if (options.requireFreeze) throw new Error('frozen manifest has no audit binding');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    if (options.requireFreeze) throw new Error('dataset is not frozen');
  }
  return true;
}
