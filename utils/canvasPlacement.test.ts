import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanvasElement } from '../types.ts';
import { placeElementInCanvas } from './canvasPlacement.ts';

test('centers generated content inside the active secondary board', () => {
  const board: CanvasElement = {
    id: 'board-2',
    type: 'container',
    name: 'Board 2',
    x: 700,
    y: 100,
    w: 600,
    h: 500,
    color: '#fff',
    zIndex: 1,
  };

  const position = placeElementInCanvas({
    elements: [board],
    activeBoardId: board.id,
    fallback: { width: 595, height: 842 },
    size: { width: 500, height: 400 },
    avoidOverlap: true,
  });

  assert.deepEqual(position, { x: 750, y: 150 });
});
