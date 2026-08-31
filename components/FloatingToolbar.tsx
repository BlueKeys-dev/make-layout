import React, { useEffect, useRef, useState } from 'react';
import { MousePointer2, Settings2, Square, PenTool, Type, Hand, Plus, Edit3, Play, Sparkles } from 'lucide-react';
import { ElementType } from '../types';
import { SHAPES } from './ShapeLibrary';

const GeoGebraIcon = ({ size = 24, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    {...props}
  >
    <g
      fill="none"
      stroke="#1A4A7A"
      strokeWidth="1.55"
      transform="translate(12 12)"
    >
      <ellipse rx="3.7" ry="8.2" />
      <ellipse rx="3.7" ry="8.2" transform="rotate(60)" />
      <ellipse rx="3.7" ry="8.2" transform="rotate(-60)" />
    </g>
    <circle cx="12" cy="12" r="2.15" fill="#3D9BFF" />
    <circle cx="5.1" cy="8" r="1.35" fill="#3D9BFF" />
    <circle cx="18.9" cy="8" r="1.35" fill="#3D9BFF" />
    <circle cx="12" cy="20.2" r="1.35" fill="#3D9BFF" />
  </svg>
);
interface FloatingToolbarProps {
  onOpenAddMenu: () => void;
  onSetTool: (tool: string, type?: ElementType, shapeType?: string) => void;
  activeTool: string;
  showCanvasSettings: boolean;
  onToggleCanvasSettings: () => void;
  onOpenMindMapGenerator: () => void;
  onOpenP5Generator: () => void;
  onOpenAnimationHome: () => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  onOpenAddMenu,
  onSetTool,
  activeTool,
  showCanvasSettings,
  onToggleCanvasSettings,
  onOpenMindMapGenerator,
  onOpenP5Generator,
  onOpenAnimationHome
}) => {
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const shapeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shapeMenuOpen) return;
    const closeOnOutside = (e: PointerEvent) => {
      if (!shapeMenuRef.current?.contains(e.target as Node)) {
        setShapeMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [shapeMenuOpen]);

  return (
    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-surface-light dark:bg-surface-dark shadow-floating dark:shadow-floating-dark rounded-xl p-1.5 flex gap-1 z-50 border border-border-light dark:border-border-dark dark:border-2">
      <ToolButton
        icon={<MousePointer2 size={18} />}
        isActive={activeTool === 'select'}
        onClick={() => onSetTool('select')}
        tooltip="Select (M)"
      />
      <ToolButton
        icon={<Hand size={18} />}
        isActive={activeTool === 'hand'}
        onClick={() => onSetTool('hand')}
        tooltip="Hand Tool (H)"
      />
      <div className="w-px h-6 bg-border-light dark:bg-border-dark self-center mx-1"></div>

      {/* Direct Quick Tools */}
      <ToolButton
        icon={<Type size={18} />}
        isActive={activeTool === 'placement' && false} // Just a trigger
        onClick={() => onSetTool('placement', 'text')}
        tooltip="Text (T)"
      />
      {/* Shape Dropdown */}
      <div className="relative" ref={shapeMenuRef}>
        <ToolButton
          icon={<Square size={18} />}
          isActive={shapeMenuOpen}
          onClick={() => setShapeMenuOpen((open) => !open)}
          tooltip="Shapes"
        />
        {shapeMenuOpen && (
          <div className="absolute top-full left-0 mt-2 p-2 bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-xl z-[100] grid grid-cols-4 gap-1 w-64">
            {Object.entries(SHAPES).map(([key, shape]) => (
              <button
                key={key}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetTool('placement', 'shape', key);
                  setShapeMenuOpen(false);
                }}
                title={shape.label}
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-text-secondary-light dark:text-text-secondary-dark hover:text-primary flex items-center justify-center aspect-square transition-colors"
              >
                {shape.icon}
              </button>
            ))}
          </div>
        )}
      </div>
      <ToolButton
        icon={<Edit3 size={18} />}
        isActive={activeTool === 'placement' && false}
        onClick={() => onSetTool('placement', 'path')}
        tooltip="Pen (P)"
      />
      <ToolButton
        icon={<PenTool size={18} />}
        isActive={activeTool === 'polygon_draw'}
        onClick={() => onSetTool('polygon_draw')}
        tooltip="Draw Polygon (G)"
      />
      <ToolButton
        icon={<Sparkles size={18} />}
        isActive={false}
        onClick={onOpenMindMapGenerator}
        tooltip="AI Mind Map Generator"
      />
      <ToolButton
        icon={<Play size={18} />}
        isActive={false}
        onClick={onOpenP5Generator}
        tooltip="P5.js Generator (Insert to Canvas)"
      />
      <ToolButton
        icon={<GeoGebraIcon size={18} />}
        isActive={false}
        onClick={onOpenAnimationHome}
        tooltip="AI Animation Home"
      />

      <div className="w-px h-6 bg-border-light dark:bg-border-dark self-center mx-1"></div>

      <ToolButton
        icon={<Settings2 size={18} />}
        isActive={showCanvasSettings}
        onClick={onToggleCanvasSettings}
        tooltip="Canvas Settings & Presets"
      />

      <div className="w-px h-6 bg-border-light dark:bg-border-dark self-center mx-1"></div>

      {/* Main Add Button */}
      <button
        onClick={onOpenAddMenu}
        title="Add Element (Space)"
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 bg-primary text-white shadow-md hover:bg-primary-orange/90 hover:scale-105 active:scale-95`}
      >
        <Plus size={20} />
      </button>
    </div>
  );
};

const ToolButton = ({ icon, isActive, onClick, tooltip }: { icon: React.ReactNode, isActive: boolean, onClick: () => void, tooltip: string }) => (
  <button
    onClick={onClick}
    title={tooltip}
    className={`p-2 rounded-lg transition-all duration-200 ${isActive
        ? 'bg-primary/20 text-primary shadow-sm'
        : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-text-primary-light dark:hover:text-white'
      }`}
  >
    {icon}
  </button>
);