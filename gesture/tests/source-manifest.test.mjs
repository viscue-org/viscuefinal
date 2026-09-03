import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createSourceManifest } from '../../scripts/source-manifest.mjs';

const execFile = promisify(execFileCallback);
let fixtureRoot;

before(async () => {
  fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'viscue-source-manifest-'));
  await mkdir(path.join(fixtureRoot, 'gesture', 'shared'), { recursive: true });
  await writeFile(path.join(fixtureRoot, 'gesture', 'shared', 'example.mjs'), 'export const example = true;\n');
  await mkdir(path.join(fixtureRoot, 'dist'), { recursive: true });
  await writeFile(path.join(fixtureRoot, 'dist', 'generated.js'), 'generated');
  await mkdir(path.join(fixtureRoot, 'node_modules', 'package'), { recursive: true });
  await writeFile(path.join(fixtureRoot, 'node_modules', 'package', 'index.js'), 'dependency');
  await writeFile(path.join(fixtureRoot, '.viscue-local.env'), 'SECRET=value\n');
});

after(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});

test('source manifest is stable and excludes generated or secret paths', async () => {
  const first = await createSourceManifest(fixtureRoot);
  const second = await createSourceManifest(fixtureRoot);
  assert.equal(first.tree_sha256, second.tree_sha256);
  assert.deepEqual(first.files.map(file => file.path), ['gesture/shared/example.mjs']);
});

test('source manifest excludes generated segments without excluding similarly named sources', async () => {
  const nestedRoot = await mkdtemp(path.join(os.tmpdir(), 'viscue-source-manifest-nested-'));
  try {
    await mkdir(path.join(nestedRoot, 'distribution'), { recursive: true });
    await writeFile(path.join(nestedRoot, 'distribution', 'source.mjs'), 'included');
    await mkdir(path.join(nestedRoot, 'legacy', 'artifacts', 'manifests'), { recursive: true });
    await writeFile(path.join(nestedRoot, 'legacy', 'artifacts', 'manifests', 'nested.json'), '{}');
    await mkdir(path.join(nestedRoot, 'artifacts', 'manifests'), { recursive: true });
    await writeFile(path.join(nestedRoot, 'artifacts', 'manifests', 'root.json'), '{}');
    await mkdir(path.join(nestedRoot, 'legacy', 'dist', 'chunks'), { recursive: true });
    await writeFile(path.join(nestedRoot, 'legacy', 'dist', 'chunks', 'source.js.map'), 'generated');
    await mkdir(path.join(nestedRoot, 'legacy', 'node_modules', 'package'), { recursive: true });
    await writeFile(path.join(nestedRoot, 'legacy', 'node_modules', 'package', 'index.js'), 'dependency');
    await mkdir(path.join(nestedRoot, 'legacy', '.venv-gesture'), { recursive: true });
    await writeFile(path.join(nestedRoot, 'legacy', '.venv-gesture', 'state'), 'generated');
    await mkdir(path.join(nestedRoot, 'legacy', 'ml-runs'), { recursive: true });
    await writeFile(path.join(nestedRoot, 'legacy', 'ml-runs', 'run.json'), '{}');
    await mkdir(path.join(nestedRoot, 'legacy', 'datasets'), { recursive: true });
    await writeFile(path.join(nestedRoot, 'legacy', 'datasets', 'sample.csv'), 'generated');
    await mkdir(path.join(nestedRoot, '.superpowers'), { recursive: true });
    await writeFile(path.join(nestedRoot, '.superpowers', 'controller.json'), '{}');
    await mkdir(path.join(nestedRoot, 'legacy'), { recursive: true });
    await writeFile(path.join(nestedRoot, 'legacy', '.viscue-local.env'), 'SECRET=value\n');
    await mkdir(path.join(nestedRoot, 'ml', 'sagemaker'), { recursive: true });
    await writeFile(path.join(nestedRoot, 'ml', 'sagemaker', 'config.local.json'), '{}');

    const manifest = await createSourceManifest(nestedRoot);
    assert.deepEqual(manifest.files.map(file => file.path), [
      'distribution/source.mjs',
      'legacy/artifacts/manifests/nested.json',
    ]);
  } finally {
    await rm(nestedRoot, { recursive: true, force: true });
  }
});

test('source manifest CLI writes a canonical checkpoint into an excluded path', async () => {
  const output = path.join(fixtureRoot, 'artifacts', 'manifests', 'source-current.json');
  await execFile(process.execPath, [path.resolve('scripts/source-manifest.mjs'), fixtureRoot, output]);

  const serialized = await readFile(output, 'utf8');
  const manifest = JSON.parse(serialized);
  assert.equal(serialized, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.deepEqual(manifest.files.map(file => file.path), ['gesture/shared/example.mjs']);
});

test('source manifest CLI rejects an output path in the included source set', async () => {
  const output = path.join(fixtureRoot, 'gesture', 'source-current.json');
  await assert.rejects(
    execFile(process.execPath, [path.resolve('scripts/source-manifest.mjs'), fixtureRoot, output]),
    error => error.code !== 0,
  );
});
