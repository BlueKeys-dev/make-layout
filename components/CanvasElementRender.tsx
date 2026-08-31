import React, { useState, useRef, useEffect } from 'react';
import { Upload, MoreHorizontal } from 'lucide-react';
import { CanvasElement } from '../types';
import { TableElement } from './TableElement';
import { TextElement } from './TextElement';
import { MindMapElement } from './MindMapElement';
import { MathElement } from './MathElement';
import { GeoGebraElement } from './aniElement';
import { FreehandElement } from './FreehandElement';
import { P5Element } from './P5Element';
import { SHAPES } from './ShapeLibrary';
import { ShapeType } from '../types';

interface CanvasElementRenderProps {
  element: CanvasElement;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onResizeStart: (e: React.MouseEvent, id: string, handle: 'nw' | 'ne' | 'sw' | 'se') => void;
  onUpdateElement?: (id: string, updates: Partial<CanvasElement>) => void;
  scale?: number; // Added for correct dragging
}

export const CanvasElementRender: React.FC<CanvasElementRenderProps> = ({
  element,
  isSelected,
  onMouseDown,
  onResizeStart,
  onUpdateElement
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  /* Removed unused text refs/funcs */
  // we keep fileInputRef for image
  const fileInputRef = useRef<HTMLInputElement>(null);

  // handleDoubleClick kept for potential future use or other modifications
  const handleDoubleClick = (e: React.MouseEvent) => {
    // Text editing is handled internally by TextElement
    e.stopPropagation();
  };

  /* Removed handleBlur */

  /* Removed text specific useEffect */

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (onUpdateElement && event.target?.result) {
        const src = event.target.result as string;
        // Load image to get dimensions
        const img = new Image();
        img.onload = () => {
          const aspect = img.naturalWidth / img.naturalHeight;
          // Keep width, adjust height to match aspect ratio
          const newH = element.w / aspect;
          onUpdateElement(element.id, { src, h: newH });
        };
        img.src = src;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  };

  const handleImageClick = (e: React.MouseEvent) => {
    if (element.type === 'image' && !element.src) {
      fileInputRef.current?.click();
    }
  };

  const renderContent = () => {
    switch (element.type) {
      case 'text':
        return (
          <TextElement
            element={element}
            onUpdateElement={onUpdateElement}
            isSelected={isSelected}
            onEditChange={setIsEditing}
          />
        );

      case 'image':
        return (
          <div
            className={`w-full h-full flex items-center justify-center select-none relative transition-colors ${!element.color?.startsWith('#') && !element.color?.startsWith('rgb') && element.color !== 'transparent' ? element.color : ''} ${isDraggingOver ? 'bg-primary/20 ring-2 ring-primary' : ''}`}
            style={{ backgroundColor: (element.color?.startsWith('#') || element.color?.startsWith('rgb') || element.color === 'transparent') ? element.color : undefined }}
            onClick={handleImageClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {element.src ? (
              <img src={element.src} alt={element.name} className="w-full h-full object-cover pointer-events-none" />
            ) : (
              <div className="text-center text-emerald-700/50 font-mono text-xs p-4 flex flex-col items-center gap-2 pointer-events-none">
                <div className="p-3 rounded-full bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                  <Upload size={20} className={isDraggingOver ? 'animate-bounce' : ''} />
                </div>
                <div className="mb-1 tracking-wider font-semibold opacity-70">Drop Image Is Here</div>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        );

      case 'table':
        return (
          <TableElement element={element} onUpdateElement={onUpdateElement} />
        );

      case 'mindmap':
        return (
          <MindMapElement element={element} onUpdateElement={onUpdateElement} />
        );

      case 'geogebra':
        return (
          <GeoGebraElement element={element} onUpdateElement={onUpdateElement} />
        );

      case 'figure':
        return (
          <div className="w-full h-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col p-2 select-none">
            <div className="flex-1 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
              <span className="text-xs text-slate-400">Figure Content</span>
            </div>
            <div className="mt-2 text-xs font-semibold text-center text-slate-600 dark:text-slate-400">
              {element.content}
            </div>
          </div>
        );

      case 'math':
        return (
          <MathElement element={element} onUpdateElement={onUpdateElement} isSelected={isSelected} />
        );

      case 'path':
        return (
          <FreehandElement element={element} />
        );

      case 'p5':
        return (
          <P5Element element={element} onUpdateElement={onUpdateElement} />
        );

      default: // Shape or Container
        // Check if it is a specific shape from our library
        if (element.type === 'shape' && element.shapeType && SHAPES[element.shapeType]) {
          const shapeDef = SHAPES[element.shapeType];
          const points = (element.points as { x: number, y: number }[]) || shapeDef.createInitialPoints(element.w, element.h);
          const pathData = shapeDef.getPath(points, element.w, element.h);

          return (
            <div className="w-full h-full relative group/shape">
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${element.w} ${element.h}`}
                className="overflow-visible"
                style={{ filter: 'drop-shadow(0 4px 6px -1px rgb(0 0 0 / 0.1))' }}
              >
                <path
                  d={pathData}
                  fill={element.color?.startsWith('#') || element.color?.startsWith('rgb') ? element.color : 'currentColor'}
                  className={!element.color?.startsWith('#') && !element.color?.startsWith('rgb') ? element.color : ''}
                  stroke={element.strokeColor || 'none'}
                  strokeWidth={element.strokeWidth || 0}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* Vertex Handles */}
              {isSelected && !isEditing && (
                <>
                  {points.map((pt, i) => (
                    <div
                      key={i}
                      className="absolute w-3 h-3 bg-white border border-primary rounded-full cursor-move z-50 hover:scale-125 transition-transform"
                      style={{ left: pt.x - 6, top: pt.y - 6 }}
                      onMouseDown={(e) => {
                        e.stopPropagation(); // Prevent drag of element
                        // We need a way to track vertex drag.
                        // Simple local implementation for now or callback?
                        // Let's implement a quick drag handler here attached to document.
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const originalPt = { ...pt };

                        const handleMove = (moveEvent: MouseEvent) => {
                          if (!onUpdateElement) return;
                          const scale = 1; // Assuming scale 1 or we need to access context. 
                          // Ideally pass scale prop to CanvasElementRender, but logic is simplified here.
                          // The delta clientX is screen pixels.
                          const dx = (moveEvent.clientX - startX) / scale;
                          const dy = (moveEvent.clientY - startY) / scale;

                          const newPoints = [...points];
                          newPoints[i] = { x: originalPt.x + dx, y: originalPt.y + dy };
                          onUpdateElement(element.id, { points: newPoints });
                        };

                        const handleUp = () => {
                          document.removeEventListener('mousemove', handleMove);
                          document.removeEventListener('mouseup', handleUp);
                        };

                        document.addEventListener('mousemove', handleMove);
                        document.addEventListener('mouseup', handleUp);
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          );
        }

        const isBoard = element.type === 'container';
        const bgColor = element.boardConfig?.backgroundColor || element.color || '#ffffff';
        const borderRadius = element.boardConfig?.borderRadius ?? 0;
        const showGrid = element.boardConfig?.showGrid;
        const gridRows = element.boardConfig?.gridRows ?? 4;
        const gridCols = element.boardConfig?.gridCols ?? 4;
        const showGuides = element.boardConfig?.showGuides;
        const bleed = element.boardConfig?.bleed ?? 0;

        // Compute contrast color for text inside this board
        const getContrastColor = (c: string) => {
          if (!c) return '#000000';
          let hex = c.replace('#', '');
          if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
          return yiq >= 128 ? '#000000' : '#ffffff';
        };
        const autoTextColor = isBoard ? getContrastColor(bgColor) : undefined;

        // Grid color should contrast with background - use subtle opacity for elegance
        const isLightBg = () => {
          if (!bgColor) return true;
          let hex = bgColor.replace('#', '');
          if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
          const r = parseInt(hex.substring(0, 2), 16) || 0;
          const g = parseInt(hex.substring(2, 4), 16) || 0;
          const b = parseInt(hex.substring(4, 6), 16) || 0;
          const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
          return yiq >= 128;
        };
        const gridLineColor = isLightBg() ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)';

        return (
          <div
            className={`w-full h-full flex items-center justify-center text-slate-700/50 select-none ${!element.color?.startsWith('#') && !element.color?.startsWith('rgb') && element.color !== 'transparent' ? element.color : ''} ${isBoard ? 'shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden' : ''}`}
            style={{
              backgroundColor: bgColor,
              borderRadius: isBoard ? `${borderRadius}px` : undefined,
              color: autoTextColor
            }}
          >
            {/* Shape label */}
            {(!element.color?.includes('bg-') && !element.color?.startsWith('#') && !element.color?.startsWith('rgb') && element.color !== 'transparent' && !isBoard) && <span className="text-xs font-medium uppercase tracking-widest opacity-40">Shape</span>}

            {/* Board Grid Overlay */}
            {isBoard && showGrid && (
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: gridCols + 1 }).map((_, i) => (
                  <div key={`v-${i}`} className="absolute top-0 bottom-0" style={{ left: `${(i / gridCols) * 100}%`, borderLeft: `1px solid ${gridLineColor}` }} />
                ))}
                {Array.from({ length: gridRows + 1 }).map((_, i) => (
                  <div key={`h-${i}`} className="absolute left-0 right-0" style={{ top: `${(i / gridRows) * 100}%`, borderTop: `1px solid ${gridLineColor}` }} />
                ))}
              </div>
            )}

            {/* Board Guides */}
            {isBoard && showGuides && (
              <>
                <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-cyan-400/40 pointer-events-none" />
                <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-cyan-400/40 pointer-events-none" />
              </>
            )}

            {/* Board Bleed Indicator */}
            {isBoard && bleed > 0 && (
              <div className="absolute pointer-events-none border-2 border-red-400/40" style={{ top: -bleed, left: -bleed, right: -bleed, bottom: -bleed }} />
            )}
          </div>
        );
    }
  };

  return (
    <div
      onMouseDown={(e) => !isEditing && onMouseDown(e, element.id)}
      onDoubleClick={handleDoubleClick}
      className={`absolute cursor-move group transition-all duration-200 ${isSelected ? 'z-50' : ''
        }`}
      style={{
        left: element.x,
        top: element.y,
        width: element.w,
        height: element.h,
        zIndex: element.zIndex,
      }}
    >
      {/* Selection Border */}
      <div className={`absolute inset-0 pointer-events-none border-2 transition-colors duration-200 ${isSelected ? 'border-sky-500 shadow-xl' : 'border-transparent group-hover:border-sky-300/30'
        } rounded-sm ${isDraggingOver ? 'border-primary bg-primary/10' : ''}`} />

      {/* Element Label */}
      <div className={`absolute -top-6 left-0 bg-sky-500 text-white text-[10px] px-2 py-0.5 rounded transition-opacity whitespace-nowrap shadow-sm pointer-events-none z-50 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {element.name}
      </div>

      {/* Resize Handles - Only corners for simplicity in this proto */}
      {isSelected && !isEditing && (
        <>
          <div onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, element.id, 'nw'); }} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-sky-500 cursor-nw-resize hover:bg-sky-100 z-50 rounded-full" />
          <div onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, element.id, 'ne'); }} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-sky-500 cursor-ne-resize hover:bg-sky-100 z-50 rounded-full" />
          <div onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, element.id, 'sw'); }} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-sky-500 cursor-sw-resize hover:bg-sky-100 z-50 rounded-full" />
          <div onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, element.id, 'se'); }} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-sky-500 cursor-se-resize hover:bg-sky-100 z-50 rounded-full" />
        </>
      )}

      {/* Content Rendering */}
      <div className="w-full h-full overflow-hidden element-content-wrapper">
        {renderContent()}
      </div>
    </div>
  );
};