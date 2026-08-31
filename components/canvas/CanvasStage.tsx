import React from 'react';
import { CanvasConfig, CanvasElement, ElementType } from '../../types';
import { getEffectiveDimensions, getSafeZones } from '../../config/canvasDefaults';
import { CanvasElementRender } from '../CanvasElementRender';
import { getElementDefaultSize } from '../../utils/elementRegistry';

interface CanvasStageProps {
  canvasRef: React.RefObject<HTMLDivElement>;
  canvasConfig: CanvasConfig;
  scale: number;
  elements: CanvasElement[];
  selectedIds: string[];
  activeTool: string;
  pendingElementType: ElementType | null;
  ghostPosition: { x: number; y: number } | null;
  placementStart: { x: number; y: number } | null;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onElementDragStart: (e: React.MouseEvent, id: string) => void;
  setElements: (callback: (prev: CanvasElement[]) => CanvasElement[]) => void;
  onResizeStart: (e: React.MouseEvent, id: string, handle: string) => void;
  viewPos?: { x: number; y: number };
  drawingPolygonVertices?: { x: number, y: number }[];
  polygonPreviewMousePos?: { x: number, y: number } | null;
  marqueeRect?: { x: number; y: number; w: number; h: number } | null;
}

const getContrastColor = (color: string) => {
  if (!color) return '#000000';
  let hex = color.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
};

export const CanvasStage: React.FC<CanvasStageProps> = ({
  canvasRef,
  canvasConfig,
  scale,
  elements,
  selectedIds,
  activeTool,
  pendingElementType,
  ghostPosition,
  placementStart,
  onMouseMove,
  onMouseUp,
  onMouseDown,
  onElementDragStart,
  setElements,
  onResizeStart,
  viewPos = { x: 0, y: 0 },
  drawingPolygonVertices = [],
  polygonPreviewMousePos = null,
  marqueeRect = null
}) => {
  const { width: logicalWidth, height: logicalHeight } = getEffectiveDimensions(canvasConfig);
  const safeZones = getSafeZones(canvasConfig);
  const autoTextColor = getContrastColor(canvasConfig.backgroundColor || '#fff');

  return (
    <main
      className={`flex-1 bg-gray-50 dark:bg-[#0f0f13] overflow-hidden flex items-center justify-center p-0 relative ${activeTool === 'placement' && pendingElementType === 'path'
        ? 'cursor-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23ec5b13\' stroke-width=\'2\'%3E%3Cpath d=\'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z\'/%3E%3C/svg%3E")_0_24,auto]'
        : activeTool === 'placement' || activeTool === 'polygon_draw' ? 'cursor-crosshair' : activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseDown={onMouseDown}
      onMouseLeave={(e) => {
        if (e.buttons) onMouseUp(e);
      }}
      style={{
        backgroundImage: 'radial-gradient(circle, #94a3b8aa 1.5px, transparent 1.5px)',
        backgroundSize: '24px 24px',
        backgroundPosition: `${viewPos.x}px ${viewPos.y}px`,
        // @ts-ignore
        '--canvas-text-auto': autoTextColor
      }}
    >
      {/* Canvas World Origin */}
      <div
        ref={canvasRef}
        className="relative transition-transform duration-75 ease-out origin-center"
        style={{
          width: 0,
          height: 0,
          transform: `translate(${viewPos.x}px, ${viewPos.y}px) scale(${scale})`,
          overflow: 'visible' // Allow infinite children
        }}
      >
        {/* === Primary Page/Board === */}
        {/* We render this as the "Base" board at 0,0 */}
        <div
          className="absolute shadow-2xl dark:shadow-2xl border border-gray-200 dark:border-border-dark bg-white"
          style={{
            left: 0,
            top: 0,
            width: logicalWidth,
            height: logicalHeight,
            borderRadius: `${canvasConfig.borderRadius}px`,
            backgroundColor: canvasConfig.backgroundColor || '#fff',
            color: autoTextColor,
          }}
        >
          {/* Grid Overlay for Primary Board */}
          {canvasConfig.showGrid && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden"
              style={{ borderRadius: `${canvasConfig.borderRadius}px` }}>
              {/* Vertical Lines */}
              {Array.from({ length: canvasConfig.gridCols + 1 }).map((_, i) => (
                <div
                  key={`v-${i}`}
                  className="absolute top-0 bottom-0 border-l border-primary/5 dark:border-white/5"
                  style={{ left: `${(i / canvasConfig.gridCols) * 100}%` }}
                />
              ))}
              {/* Horizontal Lines */}
              {Array.from({ length: canvasConfig.gridRows + 1 }).map((_, i) => (
                <div
                  key={`h-${i}`}
                  className="absolute left-0 right-0 border-t border-primary/5 dark:border-white/5"
                  style={{ top: `${(i / canvasConfig.gridRows) * 100}%` }}
                />
              ))}
            </div>
          )}

          {/* Guides & Safe Zones for Primary Board */}
          {canvasConfig.showGuides && (
            <>
              {/* Safe Zone Margins */}
              {safeZones.map((z, i) => (
                <div
                  key={`safe-${i}`}
                  className="absolute border-2 border-dashed border-cyan-400/60 pointer-events-none z-50 shadow-[0_0_4px_rgba(34,211,238,0.3)]"
                  style={{ top: z.y, left: z.x, width: z.w, height: z.h }}
                />
              ))}

              {/* Center Axis Guides */}
              <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-sky-300/30 pointer-events-none z-40" />
              <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-sky-300/30 pointer-events-none z-40" />

              {/* Flipbook-specific Spine markings */}
              {canvasConfig.isFlipbook && (
                <div
                  className="absolute top-0 bottom-0 left-[calc(50%-1px)] w-[2px] bg-slate-400/20 pointer-events-none z-50 border-x border-slate-300/40"
                  title="Spine"
                />
              )}
            </>
          )}

          {/* Bleed Area */}
          {canvasConfig.bleed > 0 && (
            <div className="absolute pointer-events-none z-40" style={{
              top: -canvasConfig.bleed,
              left: -canvasConfig.bleed,
              right: -canvasConfig.bleed,
              bottom: -canvasConfig.bleed,
            }}>
              {/* Professional Bleed Indicator */}
              <div className="absolute inset-0 border-2 border-red-500/40" />

              {/* Page/Slide Edge Indicators */}
              <div className="absolute inset-[0px] border border-slate-300/20 pointer-events-none"
                style={{ top: canvasConfig.bleed, left: canvasConfig.bleed, right: canvasConfig.bleed, bottom: canvasConfig.bleed }} />

              {/* Corner Crop Marks */}
              <div className="absolute -top-6 -left-6 w-6 h-6 border-b border-r border-slate-400/60" />
              <div className="absolute -top-6 -right-6 w-6 h-6 border-b border-l border-slate-400/60" />
              <div className="absolute -bottom-6 -left-6 w-6 h-6 border-t border-r border-slate-400/60" />
              <div className="absolute -bottom-6 -right-6 w-6 h-6 border-t border-l border-slate-400/60" />
            </div>
          )}
        </div>

        {/* Live Elements */}
        {elements.map(el => (
          <CanvasElementRender
            key={el.id}
            element={el}
            isSelected={selectedIds.includes(el.id)}
            onMouseDown={(e, id) => {
              if (activeTool !== 'placement') onElementDragStart(e, id);
            }}
            onResizeStart={onResizeStart}
            onUpdateElement={(id, ups) => {
              setElements(prev => prev.map(e => e.id === id ? { ...e, ...ups } : e));
            }}
            canvasConfig={canvasConfig}
          />
        ))}

        {/* Ghost Element (Placement Preview) - Do not show for path (freehand drawing) */}
        {activeTool === 'placement' && pendingElementType && pendingElementType !== 'path' && ghostPosition && (
          <div
            className="absolute border-2 border-primary bg-primary/20 pointer-events-none z-50 rounded flex items-center justify-center overflow-hidden"
            style={{
              left: placementStart ? Math.min(placementStart.x, ghostPosition.x) : ghostPosition.x - (getElementDefaultSize(pendingElementType).w / 2),
              top: placementStart ? Math.min(placementStart.y, ghostPosition.y) : ghostPosition.y - (getElementDefaultSize(pendingElementType).h / 2),
              width: placementStart ? Math.max(2, Math.abs(ghostPosition.x - placementStart.x)) : getElementDefaultSize(pendingElementType).w,
              height: placementStart ? Math.max(2, Math.abs(ghostPosition.y - placementStart.y)) : getElementDefaultSize(pendingElementType).h,
            }}
          >
            <div className="absolute inset-0 bg-primary/5 animate-pulse" />
            <span className="relative text-primary font-bold text-[10px] uppercase tracking-widest bg-white/90 dark:bg-black/90 px-2 py-0.5 rounded shadow-sm">
              {placementStart ? `Defining Size` : `Click & Drag to Place ${pendingElementType}`}
            </span>
          </div>
        )}

        {/* Polygon Drawing Preview Overlay */}
        {drawingPolygonVertices.length > 0 && (
          <svg
            className="absolute pointer-events-none z-[100]"
            style={{
              left: 0,
              top: 0,
              width: 10000, // Large enough to cover visible area
              height: 10000,
              overflow: 'visible'
            }}
          >
            {/* Lines connecting vertices */}
            {drawingPolygonVertices.length > 1 && (
              <polyline
                points={drawingPolygonVertices.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#ec5b13"
                strokeWidth={2 / scale}
                strokeDasharray={`${4 / scale} ${4 / scale}`}
              />
            )}
            {/* Vertex circles */}
            {drawingPolygonVertices.map((pt, i) => (
              <circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r={i === 0 ? 8 / scale : 5 / scale}
                fill={i === 0 ? '#ec5b13' : '#fff'}
                stroke="#ec5b13"
                strokeWidth={2 / scale}
                className={i === 0 ? 'animate-pulse' : ''}
              />
            ))}
            {/* Live preview line from last vertex to mouse position */}
            {drawingPolygonVertices.length > 0 && polygonPreviewMousePos && (
              <line
                x1={drawingPolygonVertices[drawingPolygonVertices.length - 1].x}
                y1={drawingPolygonVertices[drawingPolygonVertices.length - 1].y}
                x2={polygonPreviewMousePos.x}
                y2={polygonPreviewMousePos.y}
                stroke="#ec5b13"
                strokeWidth={2 / scale}
                strokeOpacity={0.8}
                strokeDasharray={`${6 / scale} ${4 / scale}`}
                className="transition-all duration-75"
              />
            )}
            {/* Closing hint line */}
            {drawingPolygonVertices.length >= 3 && (
              <line
                x1={drawingPolygonVertices[drawingPolygonVertices.length - 1].x}
                y1={drawingPolygonVertices[drawingPolygonVertices.length - 1].y}
                x2={drawingPolygonVertices[0].x}
                y2={drawingPolygonVertices[0].y}
                stroke="#ec5b13"
                strokeWidth={1 / scale}
                strokeOpacity={0.3}
                strokeDasharray={`${2 / scale} ${2 / scale}`}
              />
            )}
          </svg>
        )}

        {marqueeRect && (marqueeRect.w > 0 || marqueeRect.h > 0) && (
          <div
            className="absolute pointer-events-none z-[200] border border-sky-500 bg-sky-500/10"
            style={{
              left: marqueeRect.x,
              top: marqueeRect.y,
              width: marqueeRect.w,
              height: marqueeRect.h,
            }}
          />
        )}
      </div>
    </main>
  );
};
