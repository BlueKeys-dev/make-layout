import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CANVAS_CONFIG, parseCanvasConfig } from './canvasDefaults';

test('accepts a valid persisted canvas config', () => {
  const config = {
    ...DEFAULT_CANVAS_CONFIG,
    _v: 1,
    width: 800,
    height: 600,
    mode: 'slide',
    presetName: 'Custom slide',
    bleed: 0,
    showGuides: false,
  };

  assert.deepEqual(parseCanvasConfig(config), {
    ...DEFAULT_CANVAS_CONFIG,
    width: 800,
    height: 600,
    mode: 'slide',
    presetName: 'Custom slide',
    bleed: 0,
    showGuides: false,
  });
});

test('falls back per field for invalid dimensions and grid values', () => {
  const config = parseCanvasConfig({
    ...DEFAULT_CANVAS_CONFIG,
    _v: 1,
    width: 'bad',
    height: -1,
    gridRows: 2.5,
    gridCols: 0,
  });

  assert.equal(config.width, DEFAULT_CANVAS_CONFIG.width);
  assert.equal(config.height, DEFAULT_CANVAS_CONFIG.height);
  assert.equal(config.gridRows, DEFAULT_CANVAS_CONFIG.gridRows);
  assert.equal(config.gridCols, DEFAULT_CANVAS_CONFIG.gridCols);
});

test('preserves the legacy bleed and guide migration', () => {
  const config = parseCanvasConfig({
    ...DEFAULT_CANVAS_CONFIG,
    bleed: 24,
    showGuides: false,
  });

  assert.equal(config.bleed, DEFAULT_CANVAS_CONFIG.bleed);
  assert.equal(config.showGuides, DEFAULT_CANVAS_CONFIG.showGuides);
});
