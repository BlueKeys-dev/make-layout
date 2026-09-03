import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanvasElement } from '../types.ts';
import { executeCanvasTool } from './canvasToolEngine.ts';
import type { CanvasToolExecutionContext } from './canvasToolEngine.ts';
import { CANVAS_TOOL_CATALOG } from './canvasToolCatalog.ts';

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

const contextWith = (
  elements: CanvasElement[],
  overrides: Partial<CanvasToolExecutionContext> = {},
): CanvasToolExecutionContext => ({
  elements,
  canvasConfig,
  currentPage: 0,
  pageCount: 1,
  selectedIds: [],
  activeBoardId: null,
  revision: 1,
  uiLocked: false,
  requireUiLock: true,
  scale: 1,
  ...overrides,
});

test('describes complete schemas for one or up to ten requested tools', async () => {
  const one = await executeCanvasTool('describe_tools', { names: 'add_element' }, contextWith([]));
  const requestedNames = CANVAS_TOOL_CATALOG.slice(0, 11).map(tool => tool.name);
  const capped = await executeCanvasTool('describe_tools', { names: requestedNames }, contextWith([]));

  const described = (one.data?.tools as Array<Record<string, any>>)[0];
  assert.equal(described.name, 'add_element');
  assert.equal(described.inputSchema.properties.textStyle.type, 'object');
  assert.match(described.inputSchema.properties.color.description, /textStyle\.color/);
  assert.equal((capped.data?.tools as unknown[]).length, 10);
});

test('guards page creation and emits one page addition for the current revision', async () => {
  const unlocked = await executeCanvasTool('add_page', { expectedRevision: 1 }, contextWith([]));
  const stale = await executeCanvasTool('add_page', { expectedRevision: 0 }, contextWith([], { uiLocked: true }));
  const valid = await executeCanvasTool('add_page', { expectedRevision: 1 }, contextWith([], { uiLocked: true }));

  assert.equal(unlocked.error?.code, 'UI_NOT_LOCKED');
  assert.equal(stale.error?.code, 'STALE_CANVAS');
  assert.deepEqual(valid.effects?.pageToAdd, { index: 1 });
  assert.deepEqual(valid.data, { pageIndex: 1, pageCount: 2 });
});

test('configures supplied canvas fields without replacing unspecified settings', async () => {
  const context = contextWith([], { uiLocked: true });
  const valid = await executeCanvasTool('configure_canvas', {
    expectedRevision: 1,
    backgroundColor: '#101827',
    width: 960,
  }, context);
  const invalid = await executeCanvasTool('configure_canvas', {
    expectedRevision: 1,
    showGuides: 'yes',
  }, context);

  assert.deepEqual(valid.effects?.canvasConfigUpdates, { width: 960, backgroundColor: '#101827' });
  assert.equal((valid.data?.canvas as typeof canvasConfig).bleed, canvasConfig.bleed);
  assert.equal((valid.data?.canvas as typeof canvasConfig).showGuides, canvasConfig.showGuides);
  assert.equal(invalid.error?.code, 'INVALID_INPUT');
});

test('adds text typography and rejects textStyle on non-text elements', async () => {
  const base = {
    expectedRevision: 1,
    name: 'Title',
    x: 10,
    y: 20,
    width: 300,
    height: 80,
  };
  const originalDocument = globalThis.document;
  const template = {
    content: { querySelectorAll: () => [] },
    innerHTML: '',
  };
  globalThis.document = { createElement: () => template } as unknown as Document;
  let styledText;
  let styledShape;
  try {
    styledText = await executeCanvasTool('add_element', {
      ...base,
      elementType: 'text',
      content: 'Hello',
      textStyle: { fontSize: 36, fontWeight: '700', textAlign: 'center', color: '#ffffff' },
    }, contextWith([], { uiLocked: true }));
    styledShape = await executeCanvasTool('add_element', {
      ...base,
      elementType: 'shape',
      textStyle: { fontSize: 36 },
    }, contextWith([], { uiLocked: true }));
  } finally {
    globalThis.document = originalDocument;
  }

  assert.deepEqual(styledText.effects?.elementToAdd?.textStyle, {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    color: '#ffffff',
  });
  assert.equal(styledShape.error?.code, 'INVALID_INPUT');
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

test('reports off-board elements only for balance-oriented analysis', async () => {
  const context = contextWith([
    { id: 'unowned', type: 'shape', name: 'Detached', x: 900, y: 900, w: 100, h: 100, color: '#00f', zIndex: 1 },
  ]);

  const balance = await executeCanvasTool('analyze_current_layout', { focusArea: 'balance' }, context);
  const overlaps = await executeCanvasTool('analyze_current_layout', { focusArea: 'overlaps' }, context);

  assert.equal(balance.data?.isValid, false);
  assert.equal(balance.data?.issueCount, 1);
  assert.deepEqual(balance.data?.issues, ['Unassigned: Detached: Not inside any board']);
  assert.equal(overlaps.data?.issueCount, 0);
  assert.deepEqual(overlaps.data?.issues, []);
});

test('zooms the viewport in constant steps without touching canvas revision', async () => {
  const locked = { uiLocked: true };

  const unlocked = await executeCanvasTool('zoom_canvas', { direction: 'out' }, contextWith([]));
  const zoomedOut = await executeCanvasTool('zoom_canvas', { direction: 'out', steps: 3 }, contextWith([], locked));
  const zoomedIn = await executeCanvasTool('zoom_canvas', { direction: 'in' }, contextWith([], { ...locked, scale: 0.25 }));
  const reset = await executeCanvasTool('zoom_canvas', { direction: 'reset' }, contextWith([], { ...locked, scale: 2.4 }));
  const floored = await executeCanvasTool('zoom_canvas', { direction: 'out', steps: 10 }, contextWith([], { ...locked, scale: 0.25 }));
  const noChange = await executeCanvasTool('zoom_canvas', { direction: 'in', steps: 1 }, contextWith([], { ...locked, scale: 3 }));
  const badDirection = await executeCanvasTool('zoom_canvas', { direction: 'sideways' }, contextWith([], locked));

  assert.equal(unlocked.error?.code, 'UI_NOT_LOCKED');
  assert.deepEqual(zoomedOut.effects?.zoomToScale, 0.7);
  assert.equal(zoomedOut.data?.previousScale, 1);
  assert.deepEqual(zoomedIn.effects?.zoomToScale, 0.35);
  assert.deepEqual(reset.effects?.zoomToScale, 1);
  assert.deepEqual(floored.effects?.zoomToScale, 0.2);
  assert.equal(noChange.effects?.zoomToScale, undefined);
  assert.match(noChange.message || '', /already at scale 3/);
  assert.equal(badDirection.error?.code, 'INVALID_INPUT');
});
