import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

const MAX_COMPRESSED_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024; // 150MB

const MIME_TO_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/json': 'json',
};

const EXT_TO_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  txt: 'text/plain',
  json: 'application/json',
};

export function extensionFromMime(mime = '') {
  return MIME_TO_EXT[mime.toLowerCase()] || 'bin';
}

export function mimeFromExtension(ext = '') {
  return EXT_TO_MIME[ext.toLowerCase()] || 'application/octet-stream';
}

export async function computeSha256(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return null;

  const header = dataUrl.slice(5, commaIndex);
  const data = dataUrl.slice(commaIndex + 1);
  const isBase64 = header.includes(';base64');
  const mime = (isBase64 ? header.replace(';base64', '') : header) || 'application/octet-stream';

  let bytes;
  if (isBase64) {
    const binary = atob(data);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(data));
  }

  return { mime, bytes };
}

export function bytesToDataUrl(bytes, mime = 'application/octet-stream') {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Creates an async portable history export ZIP package.
 * Returns { filename, mimeType, contents: Uint8Array }.
 */
export async function createHistoryExport(snapshot) {
  const timestamp = Number.isFinite(snapshot?.timestamp) ? snapshot.timestamp : Date.now();
  const safeTimestamp = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
  const filename = `viscue-workspace-${safeTimestamp}.zip`;

  const copy = JSON.parse(JSON.stringify(snapshot));
  const assetsMap = new Map();

  async function walkAndExtract(val) {
    if (!val || typeof val !== 'object') return val;
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        val[i] = await walkAndExtract(val[i]);
      }
      return val;
    }

    for (const [k, v] of Object.entries(val)) {
      if (typeof v === 'string' && v.startsWith('data:')) {
        const parsed = parseDataUrl(v);
        if (parsed) {
          const hash = await computeSha256(parsed.bytes);
          const ext = extensionFromMime(parsed.mime);
          const assetName = `${hash}.${ext}`;
          const assetPath = `assets/${assetName}`;
          if (!assetsMap.has(assetPath)) {
            assetsMap.set(assetPath, parsed.bytes);
          }
          val[k] = `viscue-asset://${assetName}`;
        }
      } else if (typeof v === 'object' && v !== null) {
        val[k] = await walkAndExtract(v);
      }
    }
    return val;
  }

  await walkAndExtract(copy);

  const workspaceJsonStr = JSON.stringify(copy, null, 2);
  const workspaceBytes = strToU8(workspaceJsonStr);
  const workspaceDigest = await computeSha256(workspaceBytes);

  const manifest = {
    app: 'viscue',
    formatVersion: 1,
    exportTimestamp: new Date(timestamp).toISOString(),
    workspaceDigest,
    assetCount: assetsMap.size,
  };
  const manifestBytes = strToU8(JSON.stringify(manifest, null, 2));

  const zipEntries = {
    'manifest.json': manifestBytes,
    'workspace.json': workspaceBytes,
  };

  for (const [path, bytes] of assetsMap.entries()) {
    zipEntries[path] = bytes;
  }

  const zipped = zipSync(zipEntries, { level: 6 });

  return {
    filename,
    mimeType: 'application/zip',
    contents: zipped,
  };
}

/**
 * Validates and restores a workspace snapshot from history ZIP archive bytes.
 */
export async function importHistoryArchive(bytes) {
  if (!bytes) {
    throw new Error('No archive bytes provided');
  }

  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.byteLength > MAX_COMPRESSED_BYTES) {
    throw new Error('Archive exceeds maximum compressed size limit of 50MB');
  }

  let entries;
  try {
    entries = unzipSync(u8);
  } catch (err) {
    throw new Error(`Corrupt or invalid ZIP archive: ${err.message}`);
  }

  let totalUncompressed = 0;
  for (const name of Object.keys(entries)) {
    if (name.includes('..') || name.startsWith('/') || name.startsWith('\\') || name.includes(':')) {
      throw new Error(`Path traversal or invalid path detected: ${name}`);
    }
    totalUncompressed += entries[name].byteLength;
  }

  if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
    throw new Error('Archive exceeds maximum uncompressed size limit of 150MB');
  }

  if (!entries['manifest.json']) {
    throw new Error('Archive is missing manifest.json');
  }
  if (!entries['workspace.json']) {
    throw new Error('Archive is missing workspace.json');
  }

  let manifest;
  try {
    manifest = JSON.parse(strFromU8(entries['manifest.json']));
  } catch {
    throw new Error('Invalid JSON in manifest.json');
  }

  if (manifest?.app !== 'viscue') {
    throw new Error('Archive manifest is not a valid Viscue package');
  }
  if (manifest?.formatVersion !== 1) {
    throw new Error(`Unsupported format version: ${manifest?.formatVersion}`);
  }

  const workspaceBytes = entries['workspace.json'];
  const actualDigest = await computeSha256(workspaceBytes);
  if (actualDigest !== manifest.workspaceDigest) {
    throw new Error('Workspace integrity digest mismatch');
  }

  for (const name of Object.keys(entries)) {
    if (name === 'manifest.json' || name === 'workspace.json') continue;
    if (!name.startsWith('assets/')) {
      throw new Error(`Invalid archive entry location: ${name}`);
    }
    const relative = name.slice('assets/'.length);
    if (!/^[a-f0-9]{64}\.[a-zA-Z0-9]+$/.test(relative)) {
      throw new Error(`Invalid asset filename in archive: ${name}`);
    }
  }

  let snapshot;
  try {
    snapshot = JSON.parse(strFromU8(workspaceBytes));
  } catch {
    throw new Error('Invalid JSON in workspace.json');
  }

  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Snapshot must be an object');
  }
  if (!Array.isArray(snapshot.nodes)) {
    throw new Error('Snapshot nodes must be an array');
  }
  if (!Array.isArray(snapshot.edges)) {
    throw new Error('Snapshot edges must be an array');
  }
  if (snapshot.gestureOperations !== undefined && !Array.isArray(snapshot.gestureOperations)) {
    throw new Error('Snapshot gestureOperations must be an array');
  }

  function walkAndRestore(val) {
    if (!val || typeof val !== 'object') return val;
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        val[i] = walkAndRestore(val[i]);
      }
      return val;
    }

    for (const [k, v] of Object.entries(val)) {
      if (typeof v === 'string' && v.startsWith('viscue-asset://')) {
        const assetName = v.slice('viscue-asset://'.length);
        const assetPath = `assets/${assetName}`;
        const assetBytes = entries[assetPath];
        if (!assetBytes) {
          throw new Error(`Referenced asset missing from archive: ${assetName}`);
        }
        const ext = assetName.split('.').pop() || '';
        const mime = mimeFromExtension(ext);
        val[k] = bytesToDataUrl(assetBytes, mime);
      } else if (typeof v === 'object' && v !== null) {
        val[k] = walkAndRestore(v);
      }
    }
    return val;
  }

  walkAndRestore(snapshot);

  return snapshot;
}
