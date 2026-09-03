import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelNodeMotion,
  finishNodeMotion,
  removeNodeMotion,
  startNodeMotion,
} from '../src/components/nodes/motionModel.mjs';

const savedMotion = {
  active: false,
  startPos: { x: 10, y: 20 },
  path: [{ dx: 0, dy: 0, timeMs: 0 }, { dx: 40, dy: 25, timeMs: 240 }],
};

test('starting motion records from the selected visual position', () => {
  const node = startNodeMotion({ id: 'asset-1', position: { x: 50, y: 70 }, data: { motion: null } });

  assert.deepEqual(node.data.motion, {
    active: true,
    startPos: { x: 50, y: 70 },
    path: [],
    currentDx: 0,
    currentDy: 0,
    previousMotion: null,
  });
});

test('cancelling a re-record restores the previously saved motion and position', () => {
  const recording = startNodeMotion({ id: 'asset-1', position: { x: 90, y: 110 }, data: { motion: savedMotion } });
  const moved = { ...recording, position: { x: 180, y: 210 } };

  const cancelled = cancelNodeMotion(moved);

  assert.deepEqual(cancelled.position, { x: 90, y: 110 });
  assert.deepEqual(cancelled.data.motion, savedMotion);
});

test('finishing motion saves the recorded path without temporary re-record state', () => {
  const node = {
    id: 'asset-1',
    position: { x: 90, y: 110 },
    data: { motion: { ...savedMotion, active: true, previousMotion: savedMotion } },
  };

  const finished = finishNodeMotion(node);

  assert.equal(finished.data.motion.active, false);
  assert.equal('previousMotion' in finished.data.motion, false);
  assert.equal(finished.data.motion.path.length, 2);
});

test('removing motion leaves the selected visual in place', () => {
  const node = { id: 'asset-1', position: { x: 90, y: 110 }, data: { motion: savedMotion } };

  assert.deepEqual(removeNodeMotion(node), {
    id: 'asset-1',
    position: { x: 90, y: 110 },
    data: { motion: null },
  });
});
