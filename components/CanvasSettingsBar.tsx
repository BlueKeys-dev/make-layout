import React from 'react';
import {
  Monitor,
  Book,
  BookOpen,
  LayoutTemplate,
  Grid3X3,
  Printer,
  Plus,
  Layers,
  PanelsTopLeft
} from 'lucide-react';
import { CanvasConfig, CanvasElement, BoardConfig, LayoutOrientation, LayoutTemplate as LayoutTemplateData } from '../types';
import { CANVAS_PRESETS } from '../config/canvasDefaults';
import { LayoutLibrary } from './LayoutLibrary';

interface CanvasSettingsBarProps {
  config: CanvasConfig;
  setConfig: (config: CanvasConfig) => void;
  onAddPage: () => void;
  selectedBoardId: string | 'primary';
  activeBoard: CanvasElement | null;
  selectedIds: string[];
  onUpdateBoards: (ids: string[], updates: Partial<CanvasElement> | ((el: CanvasElement) => CanvasElement)) => void;
  layoutTemplates: LayoutTemplateData[];
  layoutOrientation: LayoutOrientation;
  layoutError: string | null;
  onLoadLayout: (template: LayoutTemplateData) => boolean;
  onSaveLayout: (name: string) => boolean;
  onDeleteLayout: (templateId: string) => void;
}

export const CanvasSettingsBar: React.FC<CanvasSettingsBarProps> = ({
  config,
  setConfig,
  onAddPage,
  selectedBoardId,
  activeBoard,
  selectedIds,
  onUpdateBoards,
  layoutTemplates,
  layoutOrientation,
  layoutError,
  onLoadLayout,
  onSaveLayout,
  onDeleteLayout,
}) => {
  const [showLayoutLibrary, setShowLayoutLibrary] = React.useState(false);

  // Get current values from active board or global config
  const currentBg = activeBoard?.boardConfig?.backgroundColor ?? activeBoard?.color ?? config.backgroundColor;
  const currentRadius = activeBoard?.boardConfig?.borderRadius ?? config.borderRadius;
  const currentShowGrid = activeBoard?.boardConfig?.showGrid ?? config.showGrid;
  const currentShowGuides = activeBoard?.boardConfig?.showGuides ?? config.showGuides;
  const currentBleed = activeBoard?.boardConfig?.bleed ?? config.bleed;
  const currentGridRows = activeBoard?.boardConfig?.gridRows ?? config.gridRows;
  const currentGridCols = activeBoard?.boardConfig?.gridCols ?? config.gridCols;

  const boardUpdateIds = activeBoard
    ? (selectedIds.includes(activeBoard.id) ? selectedIds : [activeBoard.id])
    : selectedIds;

  const updateActiveBoards = (mutate: (el: CanvasElement) => CanvasElement) => {
    onUpdateBoards(boardUpdateIds, (el) => {
      if (el.type !== 'container') return el;
      return mutate(el);
    });
  };

  const handlePresetChange = (key: keyof typeof CANVAS_PRESETS) => {
    const preset = CANVAS_PRESETS[key];
    if (activeBoard) {
      updateActiveBoards((el) => ({ ...el, w: preset.width, h: preset.height }));
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
    if (activeBoard) {
      updateActiveBoards((el) => ({
        ...el,
        color,
        boardConfig: { ...(el.boardConfig || {}), backgroundColor: color }
      }));
    } else {
      setConfig({ ...config, backgroundColor: color });
    }
  };

  const handleRadiusChange = (radius: number) => {
    if (activeBoard) {
      updateActiveBoards((el) => ({
        ...el,
        boardConfig: { ...(el.boardConfig || {}), borderRadius: radius }
      }));
    } else {
      setConfig({ ...config, borderRadius: radius });
    }
  };

  const handleGridToggle = () => {
    const newShowGrid = !currentShowGrid;
    if (activeBoard) {
      updateActiveBoards((el) => ({
        ...el,
        boardConfig: { ...(el.boardConfig || {}), showGrid: newShowGrid }
      }));
    } else {
      setConfig({ ...config, showGrid: newShowGrid });
    }
  };

  const handleGuidesToggle = () => {
    const newShowGuides = !currentShowGuides;
    if (activeBoard) {
      updateActiveBoards((el) => ({
        ...el,
        boardConfig: { ...(el.boardConfig || {}), showGuides: newShowGuides }
      }));
    } else {
      setConfig({ ...config, showGuides: newShowGuides });
    }
  };

  const handleBleedToggle = () => {
    const newBleed = currentBleed ? 0 : 9;
    if (activeBoard) {
      updateActiveBoards((el) => ({
        ...el,
        boardConfig: { ...(el.boardConfig || {}), bleed: newBleed }
      }));
    } else {
      setConfig({ ...config, bleed: newBleed });
    }
  };

  const handleGridRowsChange = (rows: number) => {
    if (activeBoard) {
      updateActiveBoards((el) => ({
        ...el,
        boardConfig: { ...(el.boardConfig || {}), gridRows: rows }
      }));
    } else {
      setConfig({ ...config, gridRows: rows });
    }
  };

  const handleGridColsChange = (cols: number) => {
    if (activeBoard) {
      updateActiveBoards((el) => ({
        ...el,
        boardConfig: { ...(el.boardConfig || {}), gridCols: cols }
      }));
    } else {
      setConfig({ ...config, gridCols: cols });
    }
  };

  return (
    <div className="absolute top-6 left-1/2 z-20 mt-14 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-xl border border-border-light bg-surface-light p-1.5 shadow-floating transition-all dark:border-2 dark:border-border-dark dark:bg-surface-dark dark:shadow-floating-dark lg:max-w-none lg:flex-nowrap lg:justify-start lg:gap-3 lg:p-2">

      {/* Add Board */}
      <button
        onClick={onAddPage}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-primary-orange/90 lg:px-3 lg:py-2"
        title="Add New Board"
      >
        <Plus size={16} />
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowLayoutLibrary(open => !open)}
          className={`rounded-lg p-1.5 transition-colors ${showLayoutLibrary ? 'bg-primary/15 text-primary' : 'text-text-secondary-light hover:bg-gray-100 dark:text-text-secondary-dark dark:hover:bg-gray-800'}`}
          title="Load or save reusable layouts"
        >
          <PanelsTopLeft size={17} />
        </button>
        {showLayoutLibrary && (
          <LayoutLibrary
            templates={layoutTemplates}
            currentOrientation={layoutOrientation}
            error={layoutError}
            onClose={() => setShowLayoutLibrary(false)}
            onLoad={onLoadLayout}
            onSave={onSaveLayout}
            onDelete={onDeleteLayout}
          />
        )}
      </div>

      <div className="hidden h-6 w-px bg-border-light dark:bg-border-dark lg:block"></div>

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

      <div className="hidden h-6 w-px bg-border-light dark:bg-border-dark lg:block"></div>

      {/* Flipbook Toggle */}
      <button
        onClick={() => setConfig({ ...config, isFlipbook: !config.isFlipbook })}
        title="Flipbook"
        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all lg:px-3 ${config.isFlipbook
          ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
          : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
      >
        <BookOpen size={16} />
        <span className="hidden lg:inline">Flipbook</span>
      </button>

      <div className="hidden h-6 w-px bg-border-light dark:bg-border-dark lg:block"></div>

      {/* Guides & Bleed */}
      <div className="flex items-center gap-1">
        <HoverTip label="Guides">
          <button
            onClick={handleGuidesToggle}
            className={`p-1.5 rounded transition-all ${currentShowGuides ? 'bg-white dark:bg-gray-700 shadow-sm text-sky-500' : 'text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark'}`}
            title="Guides"
          >
            <Grid3X3 size={16} />
          </button>
        </HoverTip>

        <HoverTip label="Bleed">
          <button
            onClick={handleBleedToggle}
            className={`p-1.5 rounded transition-all ${currentBleed > 0 ? 'bg-white dark:bg-gray-700 shadow-sm text-red-500' : 'text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark'}`}
            title="Bleed"
          >
            <Printer size={16} />
          </button>
        </HoverTip>
      </div>

      <div className="hidden h-6 w-px bg-border-light dark:bg-border-dark lg:block"></div>

      {/* Grid Settings */}
      <div className="flex items-center gap-2 bg-gray-100 dark:bg-black/20 p-1 rounded-lg">
        <HoverTip label="Grid">
          <button
            onClick={handleGridToggle}
            className={`p-1.5 rounded transition-all ${currentShowGrid ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark'}`}
            title="Grid"
          >
            <Grid3X3 size={16} />
          </button>
        </HoverTip>
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

      <div className="hidden h-6 w-px bg-border-light dark:bg-border-dark lg:block"></div>

      {/* Corner Smoothness */}
      <div className="flex items-center gap-1 px-1 lg:gap-2 lg:px-2">
        <span className="hidden text-[10px] uppercase font-bold text-text-secondary-dark lg:inline">Radius</span>
        <input
          type="range"
          min="0"
          max="40"
          value={currentRadius}
          onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
          title="Radius"
          className="h-1 w-10 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary lg:w-16 dark:bg-gray-700"
        />
      </div>

      <div className="hidden h-6 w-px bg-border-light dark:bg-border-dark lg:block"></div>

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

function HoverTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex group/tip">
      {children}
      <span className="pointer-events-none absolute top-full left-1/2 z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 shadow-sm transition-opacity group-hover/tip:opacity-100 dark:bg-gray-100 dark:text-gray-900">
        {label}
      </span>
    </span>
  );
}
