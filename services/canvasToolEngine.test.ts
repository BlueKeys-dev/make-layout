import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanvasElement } from '../types.ts';
import { executeCanvasTool } from './canvasToolEngine.ts';
import type { CanvasToolExecutionContext } from './canvasToolEngine.ts';

const canvasConfig = {
  width: 595,
  height: 842,
  mode: 'page' as const,
  presetName: 'A4',
  isFlipbook: false,
  borderRadius: 0,
  backgroundColor: '#ffffff',
  bleed: 0,
  showGuides: false,
  gridRows: 0,
  gridCols: 0,
  showGrid: false,
};

const contextWith = (elements: CanvasElement[]): CanvasToolExecutionContext => ({
  elements,
  canvasConfig,
  currentPage: 0,
  pageCount: 1,
  selectedIds: [],
  activeBoardId: null,
  revision: 1,
  uiLocked: false,
  requireUiLock: true,
});

test('analyzes elements in their owning board coordinates and excludes board containers', async () => {
  const context = contextWith([
    { id: 'board-2', type: 'container', name: 'Board 2', x: 700, y: 0, w: 400, h: 300, color: '#fff', zIndex: 1 },
    { id: 'inside', type: 'shape', name: 'Inside', x: 750, y: 50, w: 100, h: 100, color: '#00f', zIndex: 2 },
    { id: 'outside', type: 'shape', name: 'Outside', x: 1050, y: 50, w: 100, h: 100, color: '#00f', zIndex: 3 },
  ]);

  const outcome = await executeCanvasTool('analyze_current_layout', { focusArea: 'balance' }, context);

  assert.equal(outcome.success, true);
  assert.equal(outcome.data?.issueCount, 1);
  assert.deepEqual(outcome.data?.issues, ['Board 2: Outside: Exceeds right boundary']);
});

test('limits deterministic checks to the requested focus area', async () => {
  const context = contextWith([
    { id: 'narrow', type: 'text', name: 'Narrow text', x: 10, y: 10, w: 100, h: 40, color: '#000', zIndex: 1 },
  ]);

  const overlaps = await executeCanvasTool('analyze_current_layout', { focusArea: 'overlaps' }, context);
  const readability = await executeCanvasTool('analyze_current_layout', { focusArea: 'readability' }, context);

  assert.equal(overlaps.data?.issueCount, 0);
  assert.equal(readability.data?.issueCount, 1);
  assert.deepEqual(readability.data?.issues, ['Main Board: Narrow text: Text container too narrow (100pt < 150pt)']);
});
