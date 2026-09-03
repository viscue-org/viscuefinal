import fs from 'node:fs/promises';
import path from 'node:path';

const FORBIDDEN_PATHS = [/\.env$/i, /\.csv$/i, /\.map$/i, /(^|\/)tests?(\/|$)/i, /sidepanel/i];
const FORBIDDEN_CONTENT = [/AWS_ACCESS_KEY_ID\s*=/i, /AWS_SECRET_ACCESS_KEY\s*=/i, /AWS_BEARER_TOKEN_BEDROCK\s*=/i, /FONT_PROVIDER_API_KEY\s*=/i];
const REQUIRED = ['manifest.json', 'index.html', 'index.js', 'background.js', 'content.js', 'content.css', 'popup.html', 'popup.js', 'handoff-contract.js'];

async function walk(root, current = root) {
  const files = [];
  for (const entry of await fs.readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, absolute));
    else files.push(path.relative(root, absolute).split(path.sep).join('/'));
  }
  return files.sort();
}

export async function inspectPackage(root, { expectedVersion } = {}) {
  const resolved = path.resolve(root);
  const files = await walk(resolved);
  const issues = [];
  for (const file of files) {
    if (FORBIDDEN_PATHS.some(pattern => pattern.test(file))) issues.push(`Forbidden path: ${file}`);
    const absolute = path.join(resolved, ...file.split('/'));
    const stat = await fs.stat(absolute);
    if (stat.size <= 5_000_000 && /\.(?:js|json|html|css|txt)$/i.test(file)) {
      const content = await fs.readFile(absolute, 'utf8');
      if (FORBIDDEN_CONTENT.some(pattern => pattern.test(content))) issues.push(`Credential variable assignment found in: ${file}`);
    }
  }
  for (const required of REQUIRED) if (!files.includes(required)) issues.push(`Missing runtime file: ${required}`);
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(resolved, 'manifest.json'), 'utf8'));
    if (expectedVersion && manifest.version !== expectedVersion) issues.push(`Manifest version ${manifest.version || 'missing'} does not match ${expectedVersion}.`);
  } catch { issues.push('Manifest is missing or invalid JSON.'); }
  return { root: resolved, files, issues };
}
