import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import {
  createHistoryExport,
  importHistoryArchive,
  computeSha256,
  DEFAULT_HISTORY_CONFIG,
  RETENTION_OPTIONS,
  normalizeHistoryConfig,
  getHistoryCutoff,
  isHistoryItemExpired,
  pruneExpiredHistory,
  appendHistoryItem,
} from '../src/components/workspace/workspaceHistoryModel.mjs';
import { hydrateWorkspace } from '../../gesture/shared/operation-lifecycle.mjs';

const samplePngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const sampleJpgDataUrl =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

test('history export produces a portable named ZIP archive with correct metadata', async () => {
  const result = await createHistoryExport({
    id: 'snapshot-1',
    timestamp: Date.parse('2026-09-01T10:00:00.000Z'),
    nodes: [{ id: 'asset-1', data: { kind: 'image', dataUrl: samplePngDataUrl } }],
    edges: [],
    gestureOperations: [],
  });

  assert.equal(result.filename, 'viscue-workspace-2026-09-01T10-00-00-000Z.zip');
  assert.equal(result.mimeType, 'application/zip');
  assert.ok(result.contents instanceof Uint8Array);
  assert.ok(result.contents.byteLength > 0);
});

test('round-trip export and import exactly preserves nodes, edges, gesture ops, and deduplicates data URLs', async () => {
  const originalSnapshot = {
    id: 'orig-id',
    timestamp: 1788256800000,
    nodes: [
      {
        id: 'node-1',
        type: 'asset',
        position: { x: 100, y: 200 },
        data: { name: 'Image 1', dataUrl: samplePngDataUrl, remoteUrl: 'https://example.com/photo.jpg' },
      },
      {
        id: 'node-2',
        type: 'asset',
        position: { x: 300, y: 400 },
        data: { name: 'Duplicate Image 1', dataUrl: samplePngDataUrl }, // identical dataUrl
      },
      {
        id: 'node-3',
        type: 'asset',
        position: { x: 500, y: 600 },
        data: { name: 'Image 2', dataUrl: sampleJpgDataUrl },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
    ],
    gestureOperations: [
      { id: 'op-1', kind: 'connect', source: 'node-1', target: 'node-2' },
    ],
  };

  const exported = await createHistoryExport(originalSnapshot);
  assert.equal(exported.mimeType, 'application/zip');

  const imported = await importHistoryArchive(exported.contents);

  assert.equal(imported.id, originalSnapshot.id);
  assert.equal(imported.timestamp, originalSnapshot.timestamp);
  assert.equal(imported.nodes.length, 3);
  assert.equal(imported.nodes[0].data.dataUrl, samplePngDataUrl);
  assert.equal(imported.nodes[1].data.dataUrl, samplePngDataUrl);
  assert.equal(imported.nodes[0].data.remoteUrl, 'https://example.com/photo.jpg');
  assert.equal(imported.nodes[2].data.dataUrl, sampleJpgDataUrl);
  assert.deepEqual(imported.edges, originalSnapshot.edges);
  assert.deepEqual(imported.gestureOperations, originalSnapshot.gestureOperations);

  // Verify hydrateWorkspace succeeds with imported snapshot
  const hydrated = hydrateWorkspace(imported);
  assert.equal(hydrated.nodes.length, 3);
  assert.equal(hydrated.edges.length, 1);
  assert.equal(hydrated.gestureOperations.length, 1);
});

test('rejects corrupt ZIP archive', async () => {
  const badBytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
  await assert.rejects(
    () => importHistoryArchive(badBytes),
    /Corrupt or invalid ZIP archive/i
  );
});

test('rejects archive with path traversal in filenames', async () => {
  const badZip = zipSync({
    'manifest.json': strToU8(JSON.stringify({ app: 'viscue', formatVersion: 1, workspaceDigest: 'dummy' })),
    'workspace.json': strToU8(JSON.stringify({ nodes: [], edges: [] })),
    '../evil.txt': strToU8('evil'),
  });

  await assert.rejects(
    () => importHistoryArchive(badZip),
    /Path traversal or invalid path detected/i
  );
});

test('rejects archive with workspace digest mismatch', async () => {
  const workspaceJson = JSON.stringify({ nodes: [], edges: [], gestureOperations: [] });
  const badZip = zipSync({
    'manifest.json': strToU8(JSON.stringify({
      app: 'viscue',
      formatVersion: 1,
      workspaceDigest: '0000000000000000000000000000000000000000000000000000000000000000',
    })),
    'workspace.json': strToU8(workspaceJson),
  });

  await assert.rejects(
    () => importHistoryArchive(badZip),
    /Workspace integrity digest mismatch/i
  );
});

test('rejects archive with unsupported format version', async () => {
  const workspaceBytes = strToU8(JSON.stringify({ nodes: [], edges: [] }));
  const digest = await computeSha256(workspaceBytes);
  const badZip = zipSync({
    'manifest.json': strToU8(JSON.stringify({
      app: 'viscue',
      formatVersion: 99,
      workspaceDigest: digest,
    })),
    'workspace.json': workspaceBytes,
  });

  await assert.rejects(
    () => importHistoryArchive(badZip),
    /Unsupported format version: 99/i
  );
});

test('rejects archive referencing missing assets', async () => {
  const snapshot = {
    nodes: [{ id: '1', data: { dataUrl: 'viscue-asset://0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png' } }],
    edges: [],
    gestureOperations: [],
  };
  const workspaceBytes = strToU8(JSON.stringify(snapshot));
  const digest = await computeSha256(workspaceBytes);

  const badZip = zipSync({
    'manifest.json': strToU8(JSON.stringify({
      app: 'viscue',
      formatVersion: 1,
      workspaceDigest: digest,
    })),
    'workspace.json': workspaceBytes,
  });

  await assert.rejects(
    () => importHistoryArchive(badZip),
    /Referenced asset missing from archive/i
  );
});

test('rejects oversized compressed archive', async () => {
  const oversizeBytes = new Uint8Array(51 * 1024 * 1024);
  await assert.rejects(
    () => importHistoryArchive(oversizeBytes),
    /Archive exceeds maximum compressed size limit/i
  );
});

test('normalizeHistoryConfig preserves valid retention periods and falls back safely', () => {
  assert.deepEqual(normalizeHistoryConfig(24), { autoDeleteHours: 24 });
  assert.deepEqual(normalizeHistoryConfig(48), { autoDeleteHours: 48 });
  assert.deepEqual(normalizeHistoryConfig(168), { autoDeleteHours: 168 });
  assert.deepEqual(normalizeHistoryConfig(720), { autoDeleteHours: 720 });
  assert.deepEqual(normalizeHistoryConfig(-1), { autoDeleteHours: -1 });

  assert.deepEqual(normalizeHistoryConfig({ autoDeleteHours: 48 }), { autoDeleteHours: 48 });
  assert.deepEqual(normalizeHistoryConfig({ autoDeleteHours: -1 }), { autoDeleteHours: -1 });
  assert.deepEqual(normalizeHistoryConfig({ autoDeleteHours: '168' }), { autoDeleteHours: 168 });

  // Invalid fallbacks
  assert.deepEqual(normalizeHistoryConfig(null), { autoDeleteHours: 24 });
  assert.deepEqual(normalizeHistoryConfig(undefined), { autoDeleteHours: 24 });
  assert.deepEqual(normalizeHistoryConfig({}), { autoDeleteHours: 24 });
  assert.deepEqual(normalizeHistoryConfig('invalid'), { autoDeleteHours: 24 });
  assert.deepEqual(normalizeHistoryConfig(NaN), { autoDeleteHours: 24 });
});

test('getHistoryCutoff computes correct timestamp boundaries', () => {
  const now = 1788256800000;
  assert.equal(getHistoryCutoff(24, now), now - (24 * 3600 * 1000));
  assert.equal(getHistoryCutoff(48, now), now - (48 * 3600 * 1000));
  assert.equal(getHistoryCutoff(168, now), now - (168 * 3600 * 1000));
  assert.equal(getHistoryCutoff(720, now), now - (720 * 3600 * 1000));

  // Disabled / Never
  assert.equal(getHistoryCutoff(-1, now), null);
  assert.equal(getHistoryCutoff(0, now), null);
  assert.equal(getHistoryCutoff(-99, now), null);
});

test('isHistoryItemExpired detects items exceeding retention window', () => {
  const now = 1788256800000;
  const oneHourAgo = now - 3600 * 1000;
  const twentyFiveHoursAgo = now - 25 * 3600 * 1000;
  const fortyNineHoursAgo = now - 49 * 3600 * 1000;

  // Never expires with autoDeleteHours = -1
  assert.equal(isHistoryItemExpired({ timestamp: twentyFiveHoursAgo }, -1, now), false);
  assert.equal(isHistoryItemExpired({ timestamp: fortyNineHoursAgo }, -1, now), false);

  // 24 hours retention
  assert.equal(isHistoryItemExpired({ timestamp: oneHourAgo }, 24, now), false);
  assert.equal(isHistoryItemExpired({ timestamp: twentyFiveHoursAgo }, 24, now), true);

  // 48 hours retention
  assert.equal(isHistoryItemExpired({ timestamp: twentyFiveHoursAgo }, 48, now), false);
  assert.equal(isHistoryItemExpired({ timestamp: fortyNineHoursAgo }, 48, now), true);

  // ISO string timestamp format
  assert.equal(isHistoryItemExpired({ timestamp: new Date(oneHourAgo).toISOString() }, 24, now), false);
  assert.equal(isHistoryItemExpired({ timestamp: new Date(twentyFiveHoursAgo).toISOString() }, 24, now), true);

  // Fallback timestamp properties
  assert.equal(isHistoryItemExpired({ importedAt: twentyFiveHoursAgo }, 24, now), true);
  assert.equal(isHistoryItemExpired({ createdAt: twentyFiveHoursAgo }, 24, now), true);

  // Missing or corrupt timestamp is not expired (preserves user data)
  assert.equal(isHistoryItemExpired({}, 24, now), false);
  assert.equal(isHistoryItemExpired({ timestamp: 'not-a-date' }, 24, now), false);
});

test('pruneExpiredHistory removes expired items and preserves valid ones', () => {
  const now = 1788256800000;
  const fresh = { id: 'fresh', timestamp: now - 3600 * 1000 };
  const dayOld = { id: 'day-old', timestamp: now - 26 * 3600 * 1000 };
  const weekOld = { id: 'week-old', timestamp: now - 8 * 24 * 3600 * 1000 };
  const monthOld = { id: 'month-old', timestamp: now - 32 * 24 * 3600 * 1000 };

  const allItems = [fresh, dayOld, weekOld, monthOld];

  // 24 hours retention keeps only fresh
  const pruned24 = pruneExpiredHistory(allItems, 24, now);
  assert.deepEqual(pruned24.map(i => i.id), ['fresh']);

  // 48 hours retention keeps fresh and dayOld
  const pruned48 = pruneExpiredHistory(allItems, 48, now);
  assert.deepEqual(pruned48.map(i => i.id), ['fresh', 'day-old']);

  // 7 days (168h) keeps fresh and dayOld
  const pruned7d = pruneExpiredHistory(allItems, 168, now);
  assert.deepEqual(pruned7d.map(i => i.id), ['fresh', 'day-old']);

  // 30 days (720h) keeps fresh, dayOld, weekOld
  const pruned30d = pruneExpiredHistory(allItems, 720, now);
  assert.deepEqual(pruned30d.map(i => i.id), ['fresh', 'day-old', 'week-old']);

  // Never (-1) keeps all items
  const prunedNever = pruneExpiredHistory(allItems, -1, now);
  assert.deepEqual(prunedNever.map(i => i.id), ['fresh', 'day-old', 'week-old', 'month-old']);
});

test('appendHistoryItem prepends new snapshot and prunes expired ones automatically', () => {
  const now = 1788256800000;
  const oldItem = { id: 'old', timestamp: now - 25 * 3600 * 1000 };
  const existingItem = { id: 'existing', timestamp: now - 2 * 3600 * 1000 };

  const result = appendHistoryItem([existingItem, oldItem], { nodes: [{ id: 'n1' }] }, 24, now);

  assert.equal(result.length, 2);
  assert.equal(result[0].nodes[0].id, 'n1');
  assert.equal(result[0].timestamp, now);
  assert.ok(result[0].id);
  assert.equal(result[1].id, 'existing');
  // 'old' was auto-deleted because it exceeded 24 hours
  assert.ok(!result.some(i => i.id === 'old'));
});

