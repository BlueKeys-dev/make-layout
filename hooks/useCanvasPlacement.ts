import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { CanvasElement, ElementType, ShapeType } from '../types';
import { SHAPES } from '../components/ShapeLibrary';
import { createElementFactory, getElementDefaultSize } from '../utils/elementRegistry';
import type { SetCanvasElements } from './useCanvasPages';

type Point = { x: number; y: number };
type Bounds = Point & { w: number; h: number };

type UseCanvasPlacementOptions = {
  canvasRef: RefObject<HTMLDivElement | null>;
  elements: CanvasElement[];
  elementsRef: { current: CanvasElement[] };
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setElements: SetCanvasElements;
  scale: number;
  viewPos: Point;
  setViewPos: Dispatch<SetStateAction<Point>>;
  handleElementDragMove: (event: React.MouseEvent) => void;
  handleElementDragEnd: () => void;
};

const normalizeRect = (start: Point, current: Point): Bounds => ({
  x: Math.min(start.x, current.x),
  y: Math.min(start.y, current.y),
  w: Math.abs(current.x - start.x),
  h: Math.abs(current.y - start.y),
});

const rectsOverlap = (a: Bounds, b: Bounds) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const fitPathStroke = (worldPoints: number[][], strokeWidth = 4) => {
  const padding = Math.max(8, strokeWidth * 2);
  const xs = worldPoints.map(point => point[0]);
  const ys = worldPoints.map(point => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const x = Number.isFinite(minX) ? minX - padding : 0;
  const y = Number.isFinite(minY) ? minY - padding : 0;
  return {
    x,
    y,
    w: Number.isFinite(minX) ? Math.max(padding * 2, maxX - minX + padding * 2) : padding * 2,
    h: Number.isFinite(minY) ? Math.max(padding * 2, maxY - minY + padding * 2) : padding * 2,
    points: worldPoints.map(([pointX, pointY, pressure]) => [pointX - x, pointY - y, pressure ?? 0.5]),
  };
};

const getContrastColor = (color: string) => {
  if (!color || color === 'transparent' || color.startsWith('rgb')) return '#000000';
  let hex = color.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(character => character + character).join('');
  const red = parseInt(hex.substring(0, 2), 16);
  const green = parseInt(hex.substring(2, 4), 16);
  const blue = parseInt(hex.substring(4, 6), 16);
  return ((red * 299) + (green * 587) + (blue * 114)) / 1000 >= 128 ? '#000000' : '#ffffff';
};

export const useCanvasPlacement = ({
  canvasRef,
  elements,
  elementsRef,
  selectedIds,
  setSelectedIds,
  setElements,
  scale,
  viewPos,
  setViewPos,
  handleElementDragMove,
  handleElementDragEnd,
}: UseCanvasPlacementOptions) => {
  const [activeTool, setActiveTool] = useState('select');
  const [pendingElementType, setPendingElementType] = useState<ElementType | null>(null);
  const [pendingShapeType, setPendingShapeType] = useState<ShapeType | null>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [ghostPosition, setGhostPosition] = useState<Point | null>(null);
  const [placementStart, setPlacementStart] = useState<Point | null>(null);
  const [drawingPolygonVertices, setDrawingPolygonVertices] = useState<Point[]>([]);
  const [polygonPreviewMousePos, setPolygonPreviewMousePos] = useState<Point | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<Bounds | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const activeDrawingIdRef = useRef<string | null>(null);
  const pointsBufferRef = useRef<number[][]>([]);
  const pathWorldPointsRef = useRef<number[][]>([]);
  const rafIdRef = useRef<number | null>(null);
  const marqueeRef = useRef<{ start: Point; additive: boolean; baseIds: string[] } | null>(null);
  const marqueeRectRef = useRef<Bounds | null>(null);

  const getCanvasCoordinates = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  }, [canvasRef, scale, viewPos]);

  const applyMarqueeHits = useCallback((rect: Bounds, additive: boolean, baseIds: string[]) => {
    const hits = elementsRef.current
      .filter(element => rectsOverlap(rect, element))
      .map(element => element.id);
    setSelectedIds(additive ? [...new Set([...baseIds, ...hits])] : hits);
  }, [elementsRef, setSelectedIds]);

  const finishMarquee = useCallback(() => {
    const marquee = marqueeRef.current;
    if (!marquee) return;
    const rect = marqueeRectRef.current;
    marqueeRef.current = null;
    marqueeRectRef.current = null;
    setMarqueeRect(null);
    if (!rect || (rect.w < 4 && rect.h < 4)) {
      setSelectedIds(marquee.additive ? marquee.baseIds : []);
      return;
    }
    applyMarqueeHits(rect, marquee.additive, marquee.baseIds);
  }, [applyMarqueeHits, setSelectedIds]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const marquee = marqueeRef.current;
      if (!marquee) return;
      const rect = normalizeRect(marquee.start, getCanvasCoordinates(event.clientX, event.clientY));
      marqueeRectRef.current = rect;
      setMarqueeRect(rect);
      if (rect.w >= 4 || rect.h >= 4) applyMarqueeHits(rect, marquee.additive, marquee.baseIds);
    };
    const handleUp = () => finishMarquee();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !marqueeRef.current) return;
      marqueeRef.current = null;
      marqueeRectRef.current = null;
      setMarqueeRect(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('keydown', handleKey);
    };
  }, [applyMarqueeHits, finishMarquee, getCanvasCoordinates]);

  const completePolygon = useCallback(() => {
    if (drawingPolygonVertices.length < 3) {
      setDrawingPolygonVertices([]);
      return;
    }
    const xs = drawingPolygonVertices.map(point => point.x);
    const ys = drawingPolygonVertices.map(point => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(...xs) - minX || 100;
    const height = Math.max(...ys) - minY || 100;
    const points = drawingPolygonVertices.map(point => ({ x: point.x - minX, y: point.y - minY }));
    const element = createElementFactory('shape', minX, minY, elements.length + 1, 'custom_polygon', points);
    element.w = width;
    element.h = height;
    setElements(previous => [...previous, element]);
    setSelectedIds([element.id]);
    setDrawingPolygonVertices([]);
    setActiveTool('select');
  }, [drawingPolygonVertices, elements.length, setElements, setSelectedIds]);

  const initiatePlacement = useCallback((type: ElementType, shapeType?: ShapeType) => {
    setDrawingPolygonVertices([]);
    setActiveTool('placement');
    setPendingElementType(type);
    setPendingShapeType(shapeType || (type === 'shape' ? 'rectangle' : null));
    setIsAddMenuOpen(false);
    setSelectedIds([]);
  }, [setSelectedIds]);

  const onSetTool = useCallback((tool: string) => {
    if (drawingPolygonVertices.length >= 3) completePolygon();
    else if (drawingPolygonVertices.length > 0) setDrawingPolygonVertices([]);
    if (tool !== 'polygon_draw') setPolygonPreviewMousePos(null);
    setActiveTool(tool);
  }, [completePolygon, drawingPolygonVertices.length]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = event.clientX - panStart.x;
      const deltaY = event.clientY - panStart.y;
      setViewPos(previous => ({ x: previous.x + deltaX, y: previous.y + deltaY }));
      setPanStart({ x: event.clientX, y: event.clientY });
      return;
    }
    handleElementDragMove(event);
    if (marqueeRef.current) {
      const rect = normalizeRect(marqueeRef.current.start, getCanvasCoordinates(event.clientX, event.clientY));
      marqueeRectRef.current = rect;
      setMarqueeRect(rect);
      if (rect.w >= 4 || rect.h >= 4) applyMarqueeHits(rect, marqueeRef.current.additive, marqueeRef.current.baseIds);
      return;
    }
    const coordinates = getCanvasCoordinates(event.clientX, event.clientY);
    if (activeTool === 'polygon_draw') setPolygonPreviewMousePos(coordinates);
    if (activeTool !== 'placement' || !pendingElementType) return;
    if (!placementStart || pendingElementType !== 'path') {
      setGhostPosition(coordinates);
      return;
    }
    const pressure = (event.nativeEvent as PointerEvent).pressure || 0.5;
    pointsBufferRef.current.push([coordinates.x, coordinates.y, pressure]);
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      const activeId = activeDrawingIdRef.current || selectedIds[0];
      const bufferedPoints = pointsBufferRef.current;
      pointsBufferRef.current = [];
      rafIdRef.current = null;
      if (!activeId || bufferedPoints.length === 0) return;
      pathWorldPointsRef.current = [...pathWorldPointsRef.current, ...bufferedPoints];
      const fitted = fitPathStroke(pathWorldPointsRef.current);
      setElements(previous => previous.map(element =>
        element.id === activeId && element.type === 'path' ? { ...element, ...fitted } : element), false);
    });
  }, [activeTool, applyMarqueeHits, getCanvasCoordinates, handleElementDragMove, isPanning, panStart, pendingElementType, placementStart, selectedIds, setElements, setViewPos]);

  const handleCanvasMouseDown = useCallback((event: React.MouseEvent) => {
    if (activeTool === 'hand' || event.buttons === 4 || event.button === 1) {
      setIsPanning(true);
      setPanStart({ x: event.clientX, y: event.clientY });
      setSelectedIds([]);
      return;
    }
    const coordinates = getCanvasCoordinates(event.clientX, event.clientY);
    if (activeTool === 'select' && selectedIds.length === 1) {
      const selected = elements.find(element => element.id === selectedIds[0]);
      if (selected?.type === 'shape' && selected.shapeType === 'custom_polygon') {
        const localX = coordinates.x - selected.x;
        const localY = coordinates.y - selected.y;
        const points = selected.points as Point[];
        for (let index = 0; index < points.length; index += 1) {
          const start = points[index];
          const end = points[(index + 1) % points.length];
          const lengthSquared = (start.x - end.x) ** 2 + (start.y - end.y) ** 2;
          if (lengthSquared === 0) continue;
          const ratio = Math.max(0, Math.min(1,
            ((localX - start.x) * (end.x - start.x) + (localY - start.y) * (end.y - start.y)) / lengthSquared));
          const distance = Math.hypot(localX - (start.x + ratio * (end.x - start.x)), localY - (start.y + ratio * (end.y - start.y)));
          if (distance >= 10 / scale) continue;
          const nextPoints = [...points];
          nextPoints.splice(index + 1, 0, { x: localX, y: localY });
          setElements(previous => previous.map(element => element.id === selected.id ? { ...element, points: nextPoints } : element));
          return;
        }
      }
    }
    if (activeTool === 'placement' && pendingElementType) {
      setPlacementStart(coordinates);
      setGhostPosition(coordinates);
      if (pendingElementType !== 'path') return;
      const pressure = (event.nativeEvent as PointerEvent).pressure || 0.5;
      pathWorldPointsRef.current = [[coordinates.x, coordinates.y, pressure]];
      const fitted = fitPathStroke(pathWorldPointsRef.current);
      const element = createElementFactory('path', fitted.x, fitted.y, elements.length + 1);
      Object.assign(element, fitted, { color: 'transparent' });
      setElements(previous => [...previous, element], false);
      setSelectedIds([element.id]);
      activeDrawingIdRef.current = element.id;
      pointsBufferRef.current = [];
      return;
    }
    if (activeTool === 'polygon_draw') {
      if (drawingPolygonVertices.length >= 3) {
        const start = drawingPolygonVertices[0];
        if (Math.hypot(coordinates.x - start.x, coordinates.y - start.y) < 15 / scale) {
          completePolygon();
          return;
        }
      }
      setDrawingPolygonVertices(previous => [...previous, coordinates]);
      return;
    }
    if ((event.target === event.currentTarget || canvasRef.current?.contains(event.target as Node)) && activeTool === 'select') {
      marqueeRef.current = { start: coordinates, additive: event.shiftKey, baseIds: event.shiftKey ? [...selectedIds] : [] };
      if (!event.shiftKey) setSelectedIds([]);
      marqueeRectRef.current = { ...coordinates, w: 0, h: 0 };
      setMarqueeRect(marqueeRectRef.current);
    }
  }, [activeTool, canvasRef, completePolygon, drawingPolygonVertices, elements, getCanvasCoordinates, pendingElementType, scale, selectedIds, setElements, setSelectedIds]);

  const handleCanvasMouseUp = useCallback((event: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    handleElementDragEnd();
    if (marqueeRef.current) {
      finishMarquee();
      return;
    }
    if (activeTool !== 'placement' || !pendingElementType || !placementStart) return;
    if (pendingElementType === 'path') {
      pathWorldPointsRef.current = [...pathWorldPointsRef.current, ...pointsBufferRef.current];
      pointsBufferRef.current = [];
      const activeId = activeDrawingIdRef.current;
      if (activeId && pathWorldPointsRef.current.length > 0) {
        const fitted = fitPathStroke(pathWorldPointsRef.current);
        setElements(previous => previous.map(element =>
          element.id === activeId && element.type === 'path' ? { ...element, ...fitted } : element));
      }
      setPlacementStart(null);
      setGhostPosition(null);
      activeDrawingIdRef.current = null;
      pathWorldPointsRef.current = [];
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      return;
    }
    const coordinates = getCanvasCoordinates(event.clientX, event.clientY);
    const dragWidth = Math.abs(coordinates.x - placementStart.x);
    const dragHeight = Math.abs(coordinates.y - placementStart.y);
    const defaults = getElementDefaultSize(pendingElementType);
    const clicked = dragWidth < 15 && dragHeight < 15;
    const width = clicked ? defaults.w : dragWidth;
    const height = clicked ? defaults.h : dragHeight;
    const x = clicked ? coordinates.x - width / 2 : Math.min(placementStart.x, coordinates.x);
    const y = clicked ? coordinates.y - height / 2 : Math.min(placementStart.y, coordinates.y);
    const points = pendingElementType === 'shape' && pendingShapeType
      ? SHAPES[pendingShapeType].createInitialPoints(width, height) as Point[]
      : undefined;
    const element = createElementFactory(pendingElementType, x, y, elements.length + 1, pendingShapeType, points);
    element.w = width;
    element.h = height;
    if (pendingElementType === 'text') {
      element.justCreated = true;
      const center = { x: element.x + element.w / 2, y: element.y + element.h / 2 };
      const board = [...elements].reverse().find(candidate => candidate.type === 'container'
        && center.x >= candidate.x && center.x <= candidate.x + candidate.w
        && center.y >= candidate.y && center.y <= candidate.y + candidate.h);
      if (element.textStyle) element.textStyle.color = getContrastColor(board?.boardConfig?.backgroundColor || board?.color || '#ffffff');
    }
    setElements(previous => [...previous, element]);
    setPendingElementType(null);
    setPendingShapeType(null);
    setActiveTool('select');
    setSelectedIds([element.id]);
    setGhostPosition(null);
    setPlacementStart(null);
  }, [activeTool, elements, finishMarquee, getCanvasCoordinates, handleElementDragEnd, isPanning, pendingElementType, pendingShapeType, placementStart, setElements, setSelectedIds]);

  const removeLastPolygonVertex = useCallback(() => {
    setDrawingPolygonVertices(previous => previous.slice(0, -1));
  }, []);

  return {
    activeTool,
    setActiveTool,
    pendingElementType,
    isAddMenuOpen,
    setIsAddMenuOpen,
    ghostPosition,
    placementStart,
    drawingPolygonVertices,
    polygonPreviewMousePos,
    marqueeRect,
    initiatePlacement,
    onSetTool,
    handleCanvasMouseMove,
    handleCanvasMouseDown,
    handleCanvasMouseUp,
    removeLastPolygonVertex,
  };
};
