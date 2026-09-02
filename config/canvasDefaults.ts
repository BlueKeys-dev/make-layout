import { CanvasConfig } from '../types';

export const CANVAS_PRESETS = {
  A4: { width: 595, height: 842, name: 'A4 Page', mode: 'page' as const },
  LETTER: { width: 612, height: 792, name: 'Letter', mode: 'page' as const },
  SLIDE_16_9: { width: 960, height: 540, name: 'Slide (16:9)', mode: 'slide' as const },
  SLIDE_4_3: { width: 800, height: 600, name: 'Slide (4:3)', mode: 'slide' as const },
  SQUARE: { width: 600, height: 600, name: 'Social Post', mode: 'custom' as const },
};

export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  width: CANVAS_PRESETS.A4.width,
  height: CANVAS_PRESETS.A4.height,
  mode: 'page',
  presetName: 'A4',
  isFlipbook: false,
  borderRadius: 0,
  backgroundColor: '#ffffff',
  bleed: 9,
  showGuides: true,
  gridRows: 12,
  gridCols: 12,
  showGrid: true
};

const CANVAS_CONFIG_STORAGE_KEY = 'ai-layout-canvas-config';
const CANVAS_CONFIG_STORAGE_VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown, fallback: number, minimum: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum ? value : fallback;

const positiveInteger = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : fallback;

const booleanValue = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const stringValue = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value : fallback;

export const parseCanvasConfig = (value: unknown): CanvasConfig => {
  if (!isRecord(value)) return { ...DEFAULT_CANVAS_CONFIG };

  const isLegacy = value._v !== CANVAS_CONFIG_STORAGE_VERSION;
  const mode = value.mode;

  return {
    width: finiteNumber(value.width, DEFAULT_CANVAS_CONFIG.width, Number.EPSILON),
    height: finiteNumber(value.height, DEFAULT_CANVAS_CONFIG.height, Number.EPSILON),
    mode: mode === 'page' || mode === 'slide' || mode === 'custom'
      ? mode
      : DEFAULT_CANVAS_CONFIG.mode,
    presetName: stringValue(value.presetName, DEFAULT_CANVAS_CONFIG.presetName),
    isFlipbook: booleanValue(value.isFlipbook, DEFAULT_CANVAS_CONFIG.isFlipbook),
    borderRadius: finiteNumber(value.borderRadius, DEFAULT_CANVAS_CONFIG.borderRadius, 0),
    backgroundColor: stringValue(value.backgroundColor, DEFAULT_CANVAS_CONFIG.backgroundColor),
    bleed: isLegacy
      ? DEFAULT_CANVAS_CONFIG.bleed
      : finiteNumber(value.bleed, DEFAULT_CANVAS_CONFIG.bleed, 0),
    showGuides: isLegacy
      ? DEFAULT_CANVAS_CONFIG.showGuides
      : booleanValue(value.showGuides, DEFAULT_CANVAS_CONFIG.showGuides),
    gridRows: positiveInteger(value.gridRows, DEFAULT_CANVAS_CONFIG.gridRows),
    gridCols: positiveInteger(value.gridCols, DEFAULT_CANVAS_CONFIG.gridCols),
    showGrid: booleanValue(value.showGrid, DEFAULT_CANVAS_CONFIG.showGrid),
  };
};

export const loadCanvasConfig = (): CanvasConfig => {
  try {
    const saved = localStorage.getItem(CANVAS_CONFIG_STORAGE_KEY);
    if (!saved) return { ...DEFAULT_CANVAS_CONFIG };
    return parseCanvasConfig(JSON.parse(saved));
  } catch {
    return { ...DEFAULT_CANVAS_CONFIG };
  }
};

export const saveCanvasConfig = (config: CanvasConfig) => {
  try {
    localStorage.setItem(
      CANVAS_CONFIG_STORAGE_KEY,
      JSON.stringify({ ...config, _v: CANVAS_CONFIG_STORAGE_VERSION }),
    );
  } catch {
    // ignore quota errors
  }
};

export const getEffectiveDimensions = (config: CanvasConfig) => {
  return {
    width: config.isFlipbook ? config.width * 2 : config.width,
    height: config.height
  };
};

export const getSafeZones = (config: CanvasConfig) => {
  const { width, height } = getEffectiveDimensions(config);
  const margin = 26; // 0.5 inch (standard safe margin)
  
  if (config.isFlipbook) {
    const singlePageWidth = width / 2;
    // Gutter is slightly larger to account for binding
    const gutter = 42; 
    return [
      // Left Page Safe Zone
      { x: margin, y: margin, w: singlePageWidth - margin - gutter, h: height - (margin * 2) },
      // Right Page Safe Zone
      { x: singlePageWidth + gutter, y: margin, w: singlePageWidth - margin - gutter, h: height - (margin * 2) }
    ];
  }
  
  // For slides, we might want a slightly different margin, but 36pt is a good safe zone for presentation text too.
  return [{ x: margin, y: margin, w: width - (margin * 2), h: height - (margin * 2) }];
};
