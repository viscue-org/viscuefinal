import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { inspectPackage } from '../../scripts/package-policy.mjs';

test('production extension has version 3.3.0, required runtime files, and no excluded artifacts', async () => {
  const result = await inspectPackage(path.resolve('dist/extension'), { expectedVersion: '3.3.0' });
  assert.deepEqual(result.issues, []);
  assert.ok(result.files.includes('manifest.json'));
  assert.ok(result.files.includes('handoff-contract.js'));
});

test('mirrored dist root also contains no stale excluded runtime artifacts', async () => {
  const result = await inspectPackage(path.resolve('dist'), { expectedVersion: '3.3.0' });
  assert.deepEqual(result.issues, []);
});
