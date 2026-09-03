import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultExcluded = [
  'node_modules', 'dist', '.viscue-local.env', '.venv-gesture',
  'ml-runs', 'datasets', 'artifacts/manifests', 'artifacts/gesture-replays',
  '.superpowers', 'ml/sagemaker/config.local.json',
];

const nestedDirectoryExclusions = new Set([
  'node_modules', 'dist', '.venv-gesture', 'ml-runs', 'datasets',
]);
const nestedFileExclusions = new Set(['.viscue-local.env']);

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isExcluded(relativePath, excluded) {
  const pathSegments = normalizePath(relativePath).split('/').filter(Boolean);
  return excluded.some(entry => {
    const entrySegments = normalizePath(entry)
      .replace(/^\.\//, '')
      .replace(/\/$/, '')
      .split('/')
      .filter(Boolean);
    if (entrySegments.length === 1
      && (nestedDirectoryExclusions.has(entrySegments[0]) || nestedFileExclusions.has(entrySegments[0]))) {
      return pathSegments.includes(entrySegments[0]);
    }
    return entrySegments.every((segment, index) => pathSegments[index] === segment);
  });
}

async function listSourceFiles(root, excluded) {
  const files = [];

  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      const relativePath = normalizePath(path.relative(root, file));
      if (isExcluded(relativePath, excluded)) continue;
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) files.push(file);
    }
  }

  await visit(root);
  return files;
}

export async function createSourceManifest(root, options = {}) {
  const resolvedRoot = path.resolve(root);
  const excluded = options.excluded || defaultExcluded;
  const files = await listSourceFiles(resolvedRoot, excluded);
  const rows = await Promise.all(files.map(async file => ({
    path: normalizePath(path.relative(resolvedRoot, file)),
    sha256: sha256(await fs.readFile(file)),
  })));
  return {
    schema_version: 'viscue-source-manifest/1.0',
    files: rows,
    tree_sha256: sha256(JSON.stringify(rows)),
  };
}

function isWithinRoot(root, target) {
  const relativePath = path.relative(root, target);
  return !path.isAbsolute(relativePath)
    && relativePath !== '..'
    && !relativePath.startsWith(`..${path.sep}`);
}

async function writeManifest(output, manifest) {
  const directory = path.dirname(output);
  const temporaryOutput = path.join(
    directory,
    `.${path.basename(output)}.${process.pid}.${Date.now()}.tmp`,
  );
  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.writeFile(temporaryOutput, `${JSON.stringify(manifest, null, 2)}\n`);
    await fs.rename(temporaryOutput, output);
  } catch (error) {
    await fs.rm(temporaryOutput, { force: true });
    throw error;
  }
}

async function main(argumentsList) {
  if (argumentsList.length !== 2) {
    throw new Error('Usage: node scripts/source-manifest.mjs <root> <output>');
  }

  const [root, output] = argumentsList;
  const resolvedRoot = path.resolve(root);
  const resolvedOutput = path.resolve(output);
  const outputPath = normalizePath(path.relative(resolvedRoot, resolvedOutput));
  if (isWithinRoot(resolvedRoot, resolvedOutput) && !isExcluded(outputPath, defaultExcluded)) {
    throw new Error('Output path must be outside the included source set');
  }

  const manifest = await createSourceManifest(resolvedRoot);
  await writeManifest(resolvedOutput, manifest);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
