import React from 'react';
import {
  Monitor,
  Book,
  BookOpen,
  LayoutTemplate,
  Grid3X3,
  Printer,
  Plus,
  Layers
} from 'lucide-react';
import { CanvasConfig, CanvasElement, BoardConfig } from '../types';
import { CANVAS_PRESETS } from '../config/canvasDefaults';

interface CanvasSettingsBarProps {
  config: CanvasConfig;
  setConfig: (config: CanvasConfig) => void;
  onAddPage: () => void;
  selectedBoardId: string | 'primary';
  activeBoard: CanvasElement | null;
  selectedIds: string[];
  onUpdateBoards: (ids: string[], updates: Partial<CanvasElement> | ((el: CanvasElement) => CanvasElement)) => void;
}

export const CanvasSettingsBar: React.FC<CanvasSettingsBarProps> = ({
  config,
  setConfig,
  onAddPage,
  selectedBoardId,
  activeBoard,
  selectedIds,
  onUpdateBoards
}) => {

  // Get current values from active board or global config
  const currentBg = activeBoard?.boardConfig?.backgroundColor ?? activeBoard?.color ?? config.backgroundColor;
  const currentRadius = activeBoard?.boardConfig?.borderRadius ?? config.borderRadius;
  const currentShowGrid = activeBoard?.boardConfig?.showGrid ?? config.showGrid;
  const currentShowGuides = activeBoard?.boardConfig?.showGuides ?? config.showGuides;
  const currentBleed = activeBoard?.boardConfig?.bleed ?? config.bleed;
  const currentGridRows = activeBoard?.boardConfig?.gridRows ?? config.gridRows;
  const currentGridCols = activeBoard?.boardConfig?.gridCols ?? config.gridCols;

  const handlePresetChange = (key: keyof typeof CANVAS_PRESETS) => {
    const preset = CANVAS_PRESETS[key];
    if (selectedIds.length > 0) {
      onUpdateBoards(selectedIds, (el) => {
        if (el.type !== 'container') return el;
        return { ...el, w: preset.width, h: preset.height };
      });
    } else {
      setConfig({
        ...config,
        width: preset.width,
        height: preset.height,
        mode: preset.mode,
        presetName: preset.name
      });
    }
  };

  const handleColorChange = (color: string) => {
    if (selectedIds.length > 0) {
      onUpdateBoards(selectedIds, (el) => {
        if (el.type !== 'container') return el;
        return {
          ...el,
          color,
          boardConfig: { ...(el.boardConfig || {}), backgroundColor: color }
        };
      });
    } else {
      setConfig({ ...config, backgroundColor: color });
    }
  };

  const handleRadiusChange = (radius: number) => {
    if (selectedIds.length > 0) {
      onUpdateBoards(selectedIds, (el) => {
        if (el.type !== 'container') return el;
        return {
          ...el,
          boardConfig: { ...(el.boardConfig || {}), borderRadius: radius }
        };
      });
    } else {
      setConfig({ ...config, borderRadius: radius });
    }
  };

  const handleGridToggle = () => {
    if (selectedIds.length > 0) {
      // Use the current resolved value for all selected boards
      const newShowGrid = !currentShowGrid;
      onUpdateBoards(selectedIds, (el) => {
        if (el.type !== 'container') return el;
        return {
          ...el,
          boardConfig: { ...(el.boardConfig || {}), showGrid: newShowGrid }
        };
      });
    } else {
      setConfig({ ...config, showGrid: !currentShowGrid });
    }
  };

  const handleGuidesToggle = () => {
    if (selectedIds.length > 0) {
      const newShowGuides = !currentShowGuides;
      onUpdateBoards(selectedIds, (el) => {
        if (el.type !== 'container') return el;
        return {
          ...el,
          boardConfig: { ...(el.boardConfig || {}), showGuides: newShowGuides }
        };
      });
    } else {
      setConfig({ ...config, showGuides: !currentShowGuides });
    }
  };

  const handleBleedToggle = () => {
    if (selectedIds.length > 0) {
      const newBleed = currentBleed ? 0 : 9;
      onUpdateBoards(selectedIds, (el) => {
        if (el.type !== 'container') return el;
        return {
          ...el,
          boardConfig: { ...(el.boardConfig || {}), bleed: newBleed }
        };
      });
    } else {
      const newBleed = currentBleed ? 0 : 9;
      setConfig({ ...config, bleed: newBleed });
    }
  };

  const handleGridRowsChange = (rows: number) => {
    if (selectedIds.length > 0) {
      onUpdateBoards(selectedIds, (el) => {
        if (el.type !== 'container') return el;
        return {
          ...el,
          boardConfig: { ...(el.boardConfig || {}), gridRows: rows }
        };
      });
    } else {
      setConfig({ ...config, gridRows: rows });
    }
  };

  const handleGridColsChange = (cols: number) => {
    if (selectedIds.length > 0) {
      onUpdateBoards(selectedIds, (el) => {
        if (el.type !== 'container') return el;
        return {
          ...el,
          boardConfig: { ...(el.boardConfig || {}), gridCols: cols }
        };
      });
    } else {
      setConfig({ ...config, gridCols: cols });
    }
  };

  return (
    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 mt-14 z-20 bg-surface-light dark:bg-surface-dark shadow-floating dark:shadow-floating-dark rounded-xl p-2 flex items-center gap-3 border border-border-light dark:border-border-dark dark:border-2 transition-all">

      {/* Add Board */}
      <button
        onClick={onAddPage}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white shadow-md hover:bg-primary-orange/90 transition-all font-semibold text-xs whitespace-nowrap"
        title="Add New Board"
      >
        <Plus size={16} />
      </button>

      <div className="w-px h-6 bg-border-light dark:bg-border-dark"></div>

      {/* Aspect Ratio Presets */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-black/20 p-1 rounded-lg">
        <button
          onClick={() => handlePresetChange('A4')}
          className={`p-1.5 rounded transition-all ${config.presetName.includes('A4') ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark'}`}
          title="A4 Page"
        >
          <Book size={16} />
        </button>
        <button
          onClick={() => handlePresetChange('SLIDE_16_9')}
          className={`p-1.5 rounded transition-all ${config.presetName.includes('16:9') ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark'}`}
          title="Slide 16:9"
        >
          <Monitor size={16} />
        </button>
        <button
          onClick={() => handlePresetChange('SQUARE')}
          className={`p-1.5 rounded transition-all ${config.presetName.includes('Social') ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark'}`}
          title="Square"
        >
          <LayoutTemplate size={16} />
        </button>
      </div>

      <div className="w-px h-6 bg-border-light dark:bg-border-dark"></div>

      {/* Flipbook Toggle */}
      <button
        onClick={() => setConfig({ ...config, isFlipbook: !config.isFlipbook })}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${config.isFlipbook
          ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
          : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
      >
        <BookOpen size={16} />
        <span>Flipbook</span>
      </button>

      <div className="w-px h-6 bg-border-light dark:bg-border-dark"></div>

      {/* Guides & Bleed */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleGuidesToggle}
          className={`p-1.5 rounded transition-all ${currentShowGuides ? 'bg-white dark:bg-gray-700 shadow-sm text-sky-500' : 'text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark'}`}
          title="Toggle Guides"
        >
          <Grid3X3 size={16} />
        </button>

        <button
          onClick={handleBleedToggle}
          className={`p-1.5 rounded transition-all ${currentBleed > 0 ? 'bg-white dark:bg-gray-700 shadow-sm text-red-500' : 'text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark'}`}
          title="Toggle Print Bleed (3mm/9pt)"
        >
          <Printer size={16} />
        </button>
      </div>

      <div className="w-px h-6 bg-border-light dark:bg-border-dark"></div>

      {/* Grid Settings */}
      <div className="flex items-center gap-2 bg-gray-100 dark:bg-black/20 p-1 rounded-lg">
        <button
          onClick={handleGridToggle}
          className={`p-1.5 rounded transition-all ${currentShowGrid ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark'}`}
          title="Toggle Grid"
        >
          <Grid3X3 size={16} />
        </button>
        {currentShowGrid && (
          <div className="flex items-center gap-2 px-1 animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-text-secondary-dark uppercase">R</span>
              <input
                type="number"
                min="1"
                max="48"
                value={currentGridRows}
                onChange={(e) => handleGridRowsChange(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-8 bg-transparent text-[10px] font-mono text-center focus:outline-none dark:text-white"
              />
            </div>
            <div className="w-px h-3 bg-gray-300 dark:bg-gray-700"></div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-text-secondary-dark uppercase">C</span>
              <input
                type="number"
                min="1"
                max="48"
                value={currentGridCols}
                onChange={(e) => handleGridColsChange(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-8 bg-transparent text-[10px] font-mono text-center focus:outline-none dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-border-light dark:bg-border-dark"></div>

      {/* Corner Smoothness */}
      <div className="flex items-center gap-2 px-2">
        <span className="text-[10px] uppercase font-bold text-text-secondary-dark">Radius</span>
        <input
          type="range"
          min="0"
          max="40"
          value={currentRadius}
          onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
          className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>

      <div className="w-px h-6 bg-border-light dark:bg-border-dark"></div>

      {/* Color Selection */}
      <div className="flex items-center gap-1">
        {['#ffffff', '#f8fafc', '#18181b', '#1e293b'].map(c => (
          <button
            key={c}
            onClick={() => handleColorChange(c)}
            className={`w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 shadow-sm ${currentBg === c ? 'ring-2 ring-primary ring-offset-1 dark:ring-offset-gray-900' : ''}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

    </div>
  );
};