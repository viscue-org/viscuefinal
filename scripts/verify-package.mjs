#!/usr/bin/env node
import { inspectPackage } from './package-policy.mjs';

const target = process.argv[2] || 'dist/extension';
const expectedVersion = process.argv[3] || '3.3.0';
try {
  const result = await inspectPackage(target, { expectedVersion });
  if (result.issues.length) {
    console.error(result.issues.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`Verified ${result.files.length} production files in ${result.root}.`);
  }
} catch (error) {
  console.error(`Package verification failed: ${error.message}`);
  process.exitCode = 1;
}
