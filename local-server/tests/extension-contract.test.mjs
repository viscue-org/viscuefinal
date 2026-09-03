import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVicsucRequest, normalizePlan, stageLabel } from '../../extension/src/utils/vicsuc.js';

test('buildVicsucRequest includes a normalized plan and only visual perception media', () => {
  const graph = { items: [{ id: 'image_1', kind: 'image' }, { id: 'note_1', kind: 'note' }] };
  const media = {
    image_1: { kind: 'image', dataUrl: 'data:image/jpeg;base64,YQ==' },
    note_1: { kind: 'note', dataUrl: 'not-visual' },
    absent: { kind: 'image', dataUrl: 'data:image/jpeg;base64,Yg==' },
  };
  const request = buildVicsucRequest(graph, media, { plan: 'PRO' }, { chatId: 'chat:1' });
  assert.equal(request.profile.plan, 'pro');
  assert.deepEqual(Object.keys(request.media), ['image_1']);
  assert.equal(request.session.chatId, 'chat:1');
});

test('unknown plans safely normalize to free', () => {
  assert.equal(normalizePlan('enterprise'), 'free');
  assert.equal(normalizePlan('plus'), 'plus');
});

test('stage labels distinguish fallback, blocking, skipped, and ready states', () => {
  assert.equal(stageLabel({ status: 'degraded' }), 'Fallback used');
  assert.equal(stageLabel({ status: 'blocked' }), 'Action required');
  assert.equal(stageLabel({ status: 'skipped' }), 'Skipped');
  assert.equal(stageLabel({ status: 'ok' }), 'Ready');
});
