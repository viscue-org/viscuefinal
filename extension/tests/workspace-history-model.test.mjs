import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import {
  createHistoryExport,
  importHistoryArchive,
  computeSha256,
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
