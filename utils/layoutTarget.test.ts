import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanvasElement } from '../types';
import { resolveLayoutTargetRect } from './layoutTarget';

const board: CanvasElement = {
  id: 'board-1',
  type: 'container',
  x: 10,
  y: 20,
  w: 300,
  h: 400,
  color: '#ffffff',
  zIndex: 0,
  name: 'Board 1',
};

test('uses the primary canvas when no board is active', () => {
  assert.deepEqual(resolveLayoutTargetRect([board], null, { width: 595, height: 842 }), {
    x: 0,
    y: 0,
    width: 595,
    height: 842,
  });
});

test('uses the active container bounds', () => {
  assert.deepEqual(resolveLayoutTargetRect([board], board.id, { width: 595, height: 842 }), {
    x: 10,
    y: 20,
    width: 300,
    height: 400,
  });
});

test('rejects a missing active board', () => {
  assert.throws(
    () => resolveLayoutTargetRect([board], 'missing-board', { width: 595, height: 842 }),
    /selected board no longer exists/i,
  );
});
