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
  bleed: 0,
  showGuides: true,
  gridRows: 12,
  gridCols: 12,
  showGrid: true
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