import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

test('Repository Hygiene: tracked files checks', () => {
  const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);

  // 1. No node_modules tracked
  const nodeModules = tracked.filter(f => f.includes('node_modules'));
  assert.equal(nodeModules.length, 0, `Tracked node_modules detected: ${nodeModules.join(', ')}`);

  // 2. No .env secrets tracked
  const envFiles = tracked.filter(f => f.endsWith('.env') || f.includes('.env.local') || f.includes('.env.production'));
  assert.equal(envFiles.length, 0, `Tracked env secret files detected: ${envFiles.join(', ')}`);

  // 3. No large zip or binary bundle files > 50MB tracked in git
  for (const file of tracked) {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      assert.ok(stats.size < 50 * 1024 * 1024, `File ${file} exceeds 50MB (${stats.size} bytes)`);
    }
  }
});
