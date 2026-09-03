import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { buildDataset, freezeManifest, verifyManifest } from '../dataset/manifest.mjs';
import { auditDatasetDirectory } from '../dataset/audit.mjs';

const temporaryDirectory = async () => fs.mkdtemp(path.join(os.tmpdir(), 'viscue-dataset-'));

function assertDisjoint(left, right) {
  assert.equal([...left].filter(value => right.has(value)).length, 0);
}

async function readRecords(directory, shardPath) {
  return gunzipSync(await fs.readFile(path.join(directory, shardPath))).toString('utf8').trim().split('\n').map(line => JSON.parse(line));
}

test('buildDataset creates deterministic gzip shards with protected group splits', async t => {
  const first = await temporaryDirectory();
  const second = await temporaryDirectory();
  t.after(async () => Promise.all([fs.rm(first, { recursive: true, force: true }), fs.rm(second, { recursive: true, force: true })]));
  const options = { dir: first, personas: 12, samples: 120, seed: 73, shardSize: 25 };
  const manifest = await buildDataset(options);
  const repeated = await buildDataset({ ...options, dir: second });

  assert.equal(manifest.schema_version, 'dataset-manifest/1.0');
  assert.equal(manifest.total_samples, 120);
  assert.equal(manifest.shards.reduce((total, shard) => total + shard.records, 0), 120);
  assert.deepEqual(manifest.shards.map(shard => shard.sha256), repeated.shards.map(shard => shard.sha256));
  assertDisjoint(new Set(manifest.splits.train.persona_groups), new Set(manifest.splits.test.persona_groups));
  assertDisjoint(new Set(manifest.splits.train.world_groups), new Set(manifest.splits.ood.world_groups));
  assertDisjoint(new Set(manifest.splits.train.template_groups), new Set(manifest.splits.template_holdout.template_groups));
  assert.ok(manifest.shards.every(shard => shard.path.endsWith('.jsonl.gz')));
  assert.ok(manifest.intent_distribution.connect > 0);
});

test('frozen manifest detects shard mutation', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const manifest = await buildDataset({ dir: directory, personas: 12, samples: 120, seed: 91 });
  const frozen = await freezeManifest(manifest, { dir: directory, auditReport: { blocking_findings: [] } });
  await verifyManifest(frozen, { dir: directory });
  await fs.appendFile(path.join(directory, frozen.shards[0].path), 'mutation');
  await assert.rejects(() => verifyManifest(frozen, { dir: directory }), /hash mismatch/i);
});

test('generated corpus passes its real leakage and coverage audit', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await buildDataset({ dir: directory, personas: 30, samples: 120, seed: 314 });
  const { report } = await auditDatasetDirectory(directory);
  assert.deepEqual(report.blocking_findings, []);
  assert.equal(report.coverage.intents.length, 30);
});

test('freeze ignores a forged caller audit and requires a fresh on-disk audit', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const manifest = await buildDataset({ dir: directory, personas: 12, samples: 120, seed: 701 });
  await fs.appendFile(path.join(directory, manifest.shards[0].path), 'forged mutation');
  await assert.rejects(
    () => freezeManifest(manifest, { dir: directory, auditReport: { schema_version: 'audit-report/1.0', record_count: 120, blocking_findings: [] }, requireFreshAudit: true }),
    /fresh.*audit|on-disk|audit report/i,
  );
});

test('audit rejects stale extra shards and forged split membership', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const manifest = await buildDataset({ dir: directory, personas: 12, samples: 120, seed: 702 });
  await fs.copyFile(path.join(directory, manifest.shards[0].path), path.join(directory, 'shards/stale.jsonl.gz'));
  const changed = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  changed.splits.train.sample_ids[0] = 'not-a-real-sample';
  await fs.writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify(changed, null, 2)}\n`);
  const { report } = await auditDatasetDirectory(directory);
  assert.ok(report.blocking_findings.some(finding => /stale.*extra shard/i.test(finding)));
  assert.ok(report.blocking_findings.some(finding => /split membership mismatch/i.test(finding)));
});

test('generation bounds shard size to the documented safe maximum', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await assert.rejects(() => buildDataset({ dir: directory, personas: 12, samples: 12, seed: 703, shardSize: 1001 }), /shardSize.*1000/i);
});

test('verify rejects mutation of the bound audit and frozen shard map', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const manifest = await buildDataset({ dir: directory, personas: 12, samples: 120, seed: 704 });
  await auditDatasetDirectory(directory);
  const frozen = await freezeManifest(manifest, { dir: directory });
  const auditPath = path.join(directory, 'audit-report.json');
  await fs.appendFile(auditPath, 'mutation');
  await assert.rejects(() => verifyManifest(frozen, { dir: directory, requireFreeze: true }), /frozen audit/i);
  const map = JSON.parse(await fs.readFile(path.join(directory, 'frozen.json'), 'utf8'));
  map.shard_hashes['shards/fake.jsonl.gz'] = '0'.repeat(64);
  await fs.writeFile(path.join(directory, 'frozen.json'), `${JSON.stringify(map, null, 2)}\n`);
  await assert.rejects(() => verifyManifest(frozen, { dir: directory, requireFreeze: true }), /frozen shard map/i);
});

test('OOD audit rejects an ordinary complete gesture relabeled as miss', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const manifest = await buildDataset({ dir: directory, personas: 12, samples: 120, seed: 705 });
  const records = await readRecords(directory, manifest.shards[0].path);
  const ordinary = records.find(record => record.split !== 'ood' && record.quality_flags.outcome === 'complete' && record.ground_truth.intent === 'pan');
  assert.ok(ordinary);
  const forged = JSON.parse(JSON.stringify(ordinary));
  forged.split = 'ood';
  forged.simulator_provenance.mechanism_id = 'executor-ood-v1';
  forged.simulator_provenance.scenario = { kind: 'ood', rare: true };
  forged.ground_truth = { family: 'abstention', intent: 'unknown', accepted: false };
  forged.quality_flags = { ...forged.quality_flags, ood: true, outcome: 'miss', accidental: true, incomplete: false, cancelled: false, release_failure: false, pair: null };
  const report = (await import('../dataset/audit.mjs')).auditDataset({ records: [forged] });
  assert.ok(report.blocking_findings.some(finding => /OOD split lacks real failure/i.test(finding)));
});

test('audit blocks manifest metadata mutations', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const manifest = await buildDataset({ dir: directory, personas: 12, samples: 120, seed: 706 });
  for (const mutate of [
    value => { value.dataset_version = 'forged-version'; },
    value => { value.status = 'frozen'; },
    value => { value.generator.geometry_version = 'forged-geometry/9'; },
    value => { value.generator.source_tree_sha256 = '0'.repeat(64); },
  ]) {
    const changed = JSON.parse(JSON.stringify(manifest));
    mutate(changed);
    await fs.writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify(changed, null, 2)}\n`);
    const { report } = await auditDatasetDirectory(directory);
    assert.ok(report.blocking_findings.length > 0);
  }
});

test('forged pair metadata cannot suppress ordinary duplicate records', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const manifest = await buildDataset({ dir: directory, personas: 12, samples: 120, seed: 707 });
  const records = await readRecords(directory, manifest.shards[0].path);
  const first = records[0];
  const duplicate = JSON.parse(JSON.stringify(first));
  duplicate.sample_id = `${first.sample_id}-forged-pair`;
  duplicate.quality_flags.pair = { pair_id: 'forged', role: 'source', source_sample_id: first.sample_id, replacement_sample_id: duplicate.sample_id, geometry_distance: 0, geometry_threshold: 0.001, mechanism: 'executor-core-v1' };
  const report = (await import('../dataset/audit.mjs')).auditDataset({ records: [first, duplicate] });
  assert.ok(report.blocking_findings.some(finding => /pair metadata.*hard|pair.*outside/i.test(finding)));
  assert.ok(report.blocking_findings.some(finding => /exact raw duplicate/i.test(finding)));
});

test('audit rejects inconsistent ordinary unknown evidence', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const manifest = await buildDataset({ dir: directory, personas: 12, samples: 120, seed: 708 });
  const records = await readRecords(directory, manifest.shards[0].path);
  const unknown = records.find(record => record.split === 'train' && record.ground_truth.intent === 'unknown');
  assert.ok(unknown);
  const forged = JSON.parse(JSON.stringify(unknown));
  forged.simulator_provenance.scenario = { kind: 'ood', rare: true };
  forged.quality_flags.ambiguous = false;
  forged.quality_flags.cancelled = true;
  const report = (await import('../dataset/audit.mjs')).auditDataset({ records: [forged] });
  assert.ok(report.blocking_findings.some(finding => /ordinary unknown row has inconsistent ambiguity/i.test(finding)));
});

test('near-sequence detection survives a deterministic LSH bucket boundary', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const manifest = await buildDataset({ dir: directory, personas: 12, samples: 120, seed: 709 });
  const [first] = await readRecords(directory, manifest.shards[0].path);
  const second = JSON.parse(JSON.stringify(first));
  second.sample_id = `${first.sample_id}-near-boundary`;
  second.raw_strokes.strokes[0].points[0].x = Math.min(0.99, second.raw_strokes.strokes[0].points[0].x + 0.00001);
  const report = (await import('../dataset/audit.mjs')).auditDataset({ records: [first, second] });
  assert.ok(report.near_duplicate_totals.raw > 0);
});

test('near index is bounded per split while exact duplicate checks remain exhaustive', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const manifest = await buildDataset({ dir: directory, personas: 30, samples: 120, seed: 712 });
  const records = (await Promise.all(manifest.shards.map(shard => readRecords(directory, shard.path)))).flat();
  const duplicate = JSON.parse(JSON.stringify(records[0]));
  duplicate.sample_id = `${duplicate.sample_id}-after-near-cap`;

  const report = (await import('../dataset/audit.mjs')).auditDataset(
    { records: [...records, duplicate] },
    { nearIndexLimitPerSplit: 2 },
  );

  assert.equal(report.near_index.strategy, 'deterministic-stratified-bounded-lsh');
  assert.ok(Object.values(report.near_index.sampled_by_split).every(count => count <= 2));
  assert.equal(report.near_index.exact_duplicate_checks, 'exhaustive');
  assert.ok(report.blocking_findings.some(finding => /exact raw duplicate/i.test(finding)));
});

test('incremental audit produces the same clean manifest-bound result without loading all records', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const manifest = await buildDataset({ dir: directory, personas: 30, samples: 120, seed: 713 });
  const manifestBytes = await fs.readFile(path.join(directory, 'manifest.json'));
  const audit = await import('../dataset/audit.mjs');
  const session = await audit.beginIncrementalAudit(manifestBytes);
  for (const shard of manifest.shards) {
    for (const record of await readRecords(directory, shard.path)) audit.pushIncrementalRecord(session, record);
  }
  const report = audit.finishIncrementalAudit(session, Object.fromEntries(manifest.shards.map(shard => [shard.path, shard.sha256])));

  assert.equal(report.record_count, 120);
  assert.deepEqual(report.blocking_findings, []);
  assert.equal(report.dataset_manifest_sha256.length, 64);
  assert.deepEqual(report.shard_hashes, Object.fromEntries(manifest.shards.map(shard => [shard.path, shard.sha256])));
});

test('train unknown rows contain two distinct replayable candidates with varied pairs', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const manifest = await buildDataset({ dir: directory, personas: 30, samples: 600, seed: 711 });
  const records = (await Promise.all(manifest.shards.map(shard => readRecords(directory, shard.path)))).flat();
  const unknown = records.filter(record => record.split === 'train' && record.ground_truth.intent === 'unknown');
  assert.ok(unknown.length > 5);
  const pairs = new Set(unknown.map(record => `${record.simulator_provenance.ambiguity.candidate_a_intent}->${record.simulator_provenance.ambiguity.candidate_b_intent}`));
  assert.ok(pairs.size >= 3);
  for (const record of unknown.slice(0, 3)) {
    assert.notEqual(record.simulator_provenance.ambiguity.candidate_a_intent, record.simulator_provenance.ambiguity.candidate_b_intent);
    assert.equal(record.quality_flags.outcome, 'ambiguous');
    assert.equal(record.raw_strokes.strokes.length >= 2, true);
  }
  const forged = JSON.parse(JSON.stringify(unknown[0]));
  forged.raw_strokes.strokes.pop();
  const report = (await import('../dataset/audit.mjs')).auditDataset({ records: [forged] });
  assert.ok(report.blocking_findings.some(finding => /ordinary unknown row has inconsistent ambiguity/i.test(finding)));
  const identical = JSON.parse(JSON.stringify(unknown[0]));
  identical.simulator_provenance.ambiguity.candidate_b_intent = identical.simulator_provenance.ambiguity.candidate_a_intent;
  const identicalReport = (await import('../dataset/audit.mjs')).auditDataset({ records: [identical] });
  assert.ok(identicalReport.blocking_findings.some(finding => /ordinary unknown row has inconsistent ambiguity/i.test(finding)));
  const missing = JSON.parse(JSON.stringify(unknown[0]));
  delete missing.simulator_provenance.ambiguity.candidate_b_seed;
  const missingReport = (await import('../dataset/audit.mjs')).auditDataset({ records: [missing] });
  assert.ok(missingReport.blocking_findings.some(finding => /ambiguity.*candidate_b_seed|ordinary unknown row has inconsistent ambiguity/i.test(finding)));
});

test('freeze refuses an on-disk forged ordinary pair duplicate', async t => {
  const directory = await temporaryDirectory();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const manifest = await buildDataset({ dir: directory, personas: 12, samples: 120, seed: 710 });
  const shardFile = path.join(directory, manifest.shards[0].path);
  const records = await readRecords(directory, manifest.shards[0].path);
  const duplicate = JSON.parse(JSON.stringify(records[0]));
  duplicate.sample_id = `${duplicate.sample_id}-on-disk-forged`;
  duplicate.quality_flags.pair = { pair_id: 'forged-disk', role: 'source', source_sample_id: records[0].sample_id, replacement_sample_id: duplicate.sample_id, geometry_distance: 0, geometry_threshold: 0.001, mechanism: 'executor-core-v1' };
  await fs.writeFile(shardFile, gzipSync(Buffer.from([...records, duplicate].map(record => `${JSON.stringify(record)}\n`).join('')), { mtime: 0 }));
  const { report } = await auditDatasetDirectory(directory);
  assert.ok(report.blocking_findings.some(finding => /exact raw duplicate|pair metadata/i.test(finding)));
  await assert.rejects(() => freezeManifest(manifest, { dir: directory }), /fresh|blocking/i);
});
