import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Moon, Sun, Crosshair, Trash2, BookOpen, AlertTriangle, X, Info } from 'lucide-react';
import { CanvasElement, ElementType, CanvasConfig, ChatMessage, LayoutPlan, AIModelId } from '../types';
import { INITIAL_ELEMENTS } from '../data';
import { SECTIONS } from '../data';
import { DEFAULT_CANVAS_CONFIG, getEffectiveDimensions, getSafeZones } from '../config/canvasDefaults';
import { PropertiesPanel } from './PropertiesPanel';
import { processChatMessage, quickGenerateLayout } from '../services/chatai';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction';
import { FloatingToolbar } from './FloatingToolbar';
import { MindMapGenerator } from './MindMapGenerator';
import { P5Generator } from './P5Generator';
import { AnimationHome } from './animationhome';
import { MultiAIChatPanel } from './chat';
import { CanvasSettingsBar } from './CanvasSettingsBar';
import { ElementCreationDialog } from './ElementCreationDialog';
import { createElementFactory, getElementDefaultSize } from '../utils/elementRegistry';
import { getDefaultModel } from '../services/aiProviders';

// Refactored Imports
import { EditorHeader } from './editor/EditorHeader';
import { EditorFooter } from './editor/EditorFooter';
import { CanvasStage } from './canvas/CanvasStage';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useHistory } from '../hooks/useHistory';
import { PDFViewer } from './PDFViewer';
import { SHAPES } from './ShapeLibrary';
import { ShapeType } from '../types';

type Bounds = { x: number; y: number; w: number; h: number };

const getElementBounds = (el: CanvasElement): Bounds => {
    return { x: el.x, y: el.y, w: el.w, h: el.h };
};

const fitPathStroke = (worldPoints: number[][], strokeWidth = 4) => {
    const pad = Math.max(8, strokeWidth * 2);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pt of worldPoints) {
        minX = Math.min(minX, pt[0]);
        minY = Math.min(minY, pt[1]);
        maxX = Math.max(maxX, pt[0]);
        maxY = Math.max(maxY, pt[1]);
    }
    if (!Number.isFinite(minX)) {
        return { x: 0, y: 0, w: pad * 2, h: pad * 2, points: [] as number[][] };
    }
    const x = minX - pad;
    const y = minY - pad;
    return {
        x,
        y,
        w: Math.max(pad * 2, maxX - minX + pad * 2),
        h: Math.max(pad * 2, maxY - minY + pad * 2),
        points: worldPoints.map(([px, py, pr]) => [px - x, py - y, pr ?? 0.5]),
    };
};

const rectsOverlap = (a: Bounds, b: Bounds) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const normalizeRect = (start: { x: number; y: number }, current: { x: number; y: number }): Bounds => {
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    return { x, y, w: Math.abs(current.x - start.x), h: Math.abs(current.y - start.y) };
};

const getInitialPages = (): CanvasElement[][] => {
    try {
        const saved = localStorage.getItem('ai-layout-pages');
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.warn('Persistence Error', e);
    }
    return [INITIAL_ELEMENTS];
};

export const DesignEditor = () => {
    const {
        state: pages,
        setState: setPages,
        undo,
        redo,
        canUndo,
        canRedo
    } = useHistory<CanvasElement[][]>(getInitialPages());

    useEffect(() => {
        try { localStorage.setItem('ai-layout-pages', JSON.stringify(pages)); } catch (e) { }
    }, [pages]);

    const [currentPage, setCurrentPage] = useState(0);
    const elements = pages[currentPage];

    // Helper: Update elements for current page
    const setElements = useCallback((
        value: CanvasElement[] | ((prev: CanvasElement[]) => CanvasElement[]),
        shouldPush = true
    ) => {
        setPages(prevPages => {
            const newPages = [...prevPages];
            const nextElements = typeof value === 'function' ? value(newPages[currentPage]) : value;
            newPages[currentPage] = nextElements;
            return newPages;
        }, shouldPush);
    }, [currentPage, setPages]);

    // -- Interaction State --
    const [activeTool, setActiveTool] = useState('select');
    const [pendingElementType, setPendingElementType] = useState<ElementType | null>(null);
    const [pendingShapeType, setPendingShapeType] = useState<ShapeType | null>(null);
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [isMindMapGeneratorOpen, setIsMindMapGeneratorOpen] = useState(false);
    const [isP5GeneratorOpen, setIsP5GeneratorOpen] = useState(false);
    const [isAnimationHomeOpen, setIsAnimationHomeOpen] = useState(false);
    const [ghostPosition, setGhostPosition] = useState<{ x: number, y: number } | null>(null);
    const [placementStart, setPlacementStart] = useState<{ x: number, y: number } | null>(null);

    // Polygon Drawing State
    const [drawingPolygonVertices, setDrawingPolygonVertices] = useState<{ x: number, y: number }[]>([]);
    const [polygonPreviewMousePos, setPolygonPreviewMousePos] = useState<{ x: number, y: number } | null>(null);
    const POLYGON_CLOSE_THRESHOLD = 15; // pixels to detect close to start

    // -- View State --
    const [isGenerating, setIsGenerating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [darkMode, setDarkMode] = useState(true);
    const [scale, setScale] = useState(1);
    const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
    const [showDocs, setShowDocs] = useState(false);
    const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(DEFAULT_CANVAS_CONFIG);
    const [showCanvasSettings, setShowCanvasSettings] = useState(false);
    const [showPDFViewer, setShowPDFViewer] = useState(false);

    // -- Infinite Canvas State --
    const [viewPos, setViewPos] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // -- Chat State --
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [activeModelId, setActiveModelId] = useState<AIModelId>(getDefaultModel().id);
    const [pendingPlan, setPendingPlan] = useState<LayoutPlan | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; title: string; onConfirm: () => void } | null>(null);

    const canvasRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const activeDrawingIdRef = useRef<string | null>(null); // Track actively drawing path element
    const pointsBufferRef = useRef<number[][]>([]); // Buffer for high-frequency point collection
    const pathWorldPointsRef = useRef<number[][]>([]);
    const rafIdRef = useRef<number | null>(null); // RequestAnimationFrame ID
    const marqueeRef = useRef<{ start: { x: number; y: number }; additive: boolean; baseIds: string[] } | null>(null);
    const elementsRef = useRef<CanvasElement[]>([]);
    const marqueeRectRef = useRef<Bounds | null>(null);
    const [marqueeRect, setMarqueeRect] = useState<Bounds | null>(null);
    const { width: logicalWidth, height: logicalHeight } = getEffectiveDimensions(canvasConfig);

    // -- Interaction Hooks --
    const {
        selectedIds,
        setSelectedIds,
        handleMouseDown: handleElementDragStart,
        handleMouseMove: handleElementDragMove,
        handleMouseUp: handleElementDragEnd
    } = useCanvasInteraction(elements, setElements, scale);

    const selectedElement = elements.find(e => selectedIds.includes(e.id));
    const isSelected = (id: string) => selectedIds.includes(id);

    // -- Board Selection State --
    const [selectedBoardId, setSelectedBoardId] = useState<string | 'primary'>('primary');

    // When a container is selected, it becomes the active board
    useEffect(() => {
        const lastSelected = elements.find(e => e.id === selectedIds[selectedIds.length - 1]);
        if (lastSelected?.type === 'container') {
            setSelectedBoardId(lastSelected.id);
        } else if (selectedIds.length === 0) {
            setSelectedBoardId('primary');
        }
    }, [selectedIds, elements]);

    // Get active board element (null if primary)
    const activeBoard = selectedBoardId !== 'primary'
        ? elements.find(e => e.id === selectedBoardId)
        : null;

    // --- Viewport / Centering Logic ---
    // The canvas uses `translate(vx, vy) scale(s)`. For a canvas point (tx, ty) to appear
    // at the center of the viewport (where the flex container places the 0x0 canvas element),
    // we need: vx + tx * scale = 0  →  vx = -tx * scale
    const getIdealViewPos = useCallback(() => {
        let tx = 0, ty = 0;
        if (selectedBoardId !== 'primary' && activeBoard) {
            tx = activeBoard.x + activeBoard.w / 2;
            ty = activeBoard.y + activeBoard.h / 2;
        } else {
            const containers = elements.filter(e => e.type === 'container');
            const allX = [0, logicalWidth, ...containers.flatMap(e => [e.x, e.x + e.w])];
            const allY = [0, logicalHeight, ...containers.flatMap(e => [e.y, e.y + e.h])];
            tx = (Math.min(...allX) + Math.max(...allX)) / 2;
            ty = (Math.min(...allY) + Math.max(...allY)) / 2;
        }
        return { x: -tx * scale, y: -ty * scale };
    }, [selectedBoardId, activeBoard, elements, logicalWidth, logicalHeight, scale]);

    // Helper to get a centered view position for a given target point
    const getCenteredViewPos = useCallback((targetX: number, targetY: number) => {
        return { x: -targetX * scale, y: -targetY * scale };
    }, [scale]);

    const idealViewPos = getIdealViewPos();

    useEffect(() => {
        if (selectedIds.length > 0) setRightPanelCollapsed(false);
    }, [selectedIds]);

    // --- Coordinate Systems ---
    const getCanvasCoordinates = useCallback((clientX: number, clientY: number) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: (clientX - rect.left) / scale,
            y: (clientY - rect.top) / scale
        };
    }, [scale, viewPos]); // viewPos dependency implicitly handled by getBoundingClientRect, but kept for clarity

    useEffect(() => {
        elementsRef.current = elements;
    }, [elements]);

    const applyMarqueeHits = useCallback((rect: Bounds, additive: boolean, baseIds: string[]) => {
        const hits = elementsRef.current
            .filter(el => rectsOverlap(rect, getElementBounds(el)))
            .map(el => el.id);
        setSelectedIds(additive ? [...new Set([...baseIds, ...hits])] : hits);
    }, [setSelectedIds]);

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
        const onMove = (e: MouseEvent) => {
            const marquee = marqueeRef.current;
            if (!marquee) return;
            const coords = getCanvasCoordinates(e.clientX, e.clientY);
            const rect = normalizeRect(marquee.start, coords);
            marqueeRectRef.current = rect;
            setMarqueeRect(rect);
            if (rect.w >= 4 || rect.h >= 4) {
                applyMarqueeHits(rect, marquee.additive, marquee.baseIds);
            }
        };
        const onUp = () => {
            if (marqueeRef.current) finishMarquee();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && marqueeRef.current) {
                marqueeRef.current = null;
                marqueeRectRef.current = null;
                setMarqueeRect(null);
            }
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('keydown', onKey);
        };
    }, [getCanvasCoordinates, applyMarqueeHits, finishMarquee, setSelectedIds]);

    const initiatePlacement = (type: ElementType, shapeType?: ShapeType) => {
        // Clear any polygon drawing in progress
        if (drawingPolygonVertices.length >= 3) {
            // completePolygon is defined below, but this call is safe since initiatePlacement is called at runtime, not definition time
        }
        setDrawingPolygonVertices([]);
        setActiveTool('placement');
        setPendingElementType(type);
        setPendingShapeType(shapeType || (type === 'shape' ? 'rectangle' : null));
        setIsAddMenuOpen(false);
        setSelectedIds([]);
    };

    // Complete polygon drawing and create element
    const completePolygon = () => {
        if (drawingPolygonVertices.length < 3) {
            console.log(JSON.stringify({ action: 'error', vertices: drawingPolygonVertices, polygon_closed: false, message: 'At least 3 vertices required to form a polygon.' }));
            setDrawingPolygonVertices([]);
            return;
        }

        // Calculate bounding box
        const xs = drawingPolygonVertices.map(p => p.x);
        const ys = drawingPolygonVertices.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const w = maxX - minX || 100;
        const h = maxY - minY || 100;

        // Normalize points relative to bounding box
        const normalizedPoints = drawingPolygonVertices.map(p => ({
            x: p.x - minX,
            y: p.y - minY
        }));

        const newElement = createElementFactory('shape', minX, minY, elements.length + 1, 'custom_polygon', normalizedPoints as { x: number, y: number }[]);
        newElement.w = w;
        newElement.h = h;

        setElements(prev => [...prev, newElement]);
        setSelectedIds([newElement.id]);
        setDrawingPolygonVertices([]);
        setActiveTool('select');
    };

    // Wrapper for setting active tool to handle auto-close
    const onSetTool = (tool: string) => {
        if (drawingPolygonVertices.length >= 3) {
            completePolygon();
            console.log(JSON.stringify({ action: 'polygon_closed', vertices: drawingPolygonVertices, polygon_closed: true, message: 'Polygon closed automatically on tool switch.' }));
        } else if (drawingPolygonVertices.length > 0) {
            setDrawingPolygonVertices([]); // Discard incomplete
            console.log(JSON.stringify({ action: 'error', vertices: [], polygon_closed: false, message: 'Incomplete polygon discarded on tool switch.' }));
        }
        // Clear polygon preview mouse position when switching tools
        if (tool !== 'polygon_draw') {
            setPolygonPreviewMousePos(null);
        }
        setActiveTool(tool);
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            setViewPos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setPanStart({ x: e.clientX, y: e.clientY });
            return;
        }

        handleElementDragMove(e);

        if (marqueeRef.current) {
            const coords = getCanvasCoordinates(e.clientX, e.clientY);
            const rect = normalizeRect(marqueeRef.current.start, coords);
            marqueeRectRef.current = rect;
            setMarqueeRect(rect);
            if (rect.w >= 4 || rect.h >= 4) {
                applyMarqueeHits(rect, marqueeRef.current.additive, marqueeRef.current.baseIds);
            }
            return;
        }

        // Track mouse position for polygon drawing preview
        if (activeTool === 'polygon_draw') {
            const coords = getCanvasCoordinates(e.clientX, e.clientY);
            setPolygonPreviewMousePos(coords);
        }

        if (activeTool === 'placement' && pendingElementType) {
            const coords = getCanvasCoordinates(e.clientX, e.clientY);

            // Phantom Box (for shapes, text, etc)
            if (placementStart && pendingElementType !== 'path') {
                setGhostPosition(coords);
            }
            // Freehand Drawing - Optimized with buffer
            else if (placementStart && pendingElementType === 'path') {
                // Collect points in a buffer
                const pressure = (e.nativeEvent as PointerEvent).pressure || 0.5;
                pointsBufferRef.current.push([coords.x, coords.y, pressure]);

                // Schedule a single state update via requestAnimationFrame
                if (!rafIdRef.current) {
                    rafIdRef.current = requestAnimationFrame(() => {
                        const activeId = activeDrawingIdRef.current || selectedIds[0];
                        const bufferedPoints = pointsBufferRef.current;
                        pointsBufferRef.current = []; // Clear buffer for next batch
                        rafIdRef.current = null;

                        if (activeId && bufferedPoints.length > 0) {
                            pathWorldPointsRef.current = [...pathWorldPointsRef.current, ...bufferedPoints];
                            const fitted = fitPathStroke(pathWorldPointsRef.current, 4);
                            setElements(prev => prev.map(el => {
                                if (el.id === activeId && el.type === 'path') {
                                    return { ...el, ...fitted };
                                }
                                return el;
                            }), false);
                        }
                    });
                }
            } else {
                setGhostPosition(coords);
            }
        }
    };

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (activeTool === 'hand' || (e.buttons === 4) || (e.button === 1)) { // Hand tool or Middle Click
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
            setSelectedIds([]);
            return;
        }

        // Edge Insertion for Custom Polygon
        if (activeTool === 'select' && selectedIds.length === 1) {
            const selectedElement = elements.find(el => el.id === selectedIds[0]);
            if (selectedElement?.type === 'shape' && selectedElement.shapeType === 'custom_polygon') {
                const coords = getCanvasCoordinates(e.clientX, e.clientY);
                const localX = coords.x - selectedElement.x;
                const localY = coords.y - selectedElement.y;
                const points = selectedElement.points as { x: number, y: number }[];

                // Find closest edge
                for (let i = 0; i < points.length; i++) {
                    const p1 = points[i];
                    const p2 = points[(i + 1) % points.length];

                    // Distance from point to line segment
                    const l2 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
                    if (l2 === 0) continue;
                    const t = ((localX - p1.x) * (p2.x - p1.x) + (localY - p1.y) * (p2.y - p1.y)) / l2;
                    const tClamped = Math.max(0, Math.min(1, t));
                    const projX = p1.x + tClamped * (p2.x - p1.x);
                    const projY = p1.y + tClamped * (p2.y - p1.y);
                    const dist = Math.hypot(localX - projX, localY - projY);

                    if (dist < 10 / scale) { // 10px threshold
                        // Insert new vertex
                        const newPoint = { x: localX, y: localY };
                        const newPoints = [...points];
                        newPoints.splice(i + 1, 0, newPoint);

                        setElements(prev => prev.map(el => {
                            if (el.id === selectedElement.id) {
                                return { ...el, points: newPoints };
                            }
                            return el;
                        }));

                        console.log(JSON.stringify({
                            action: 'vertex_inserted',
                            vertices: newPoints.map(p => ({ x: p.x + selectedElement.x, y: p.y + selectedElement.y })),
                            polygon_closed: true,
                            message: `Vertex inserted at edge between index ${i} and ${(i + 1) % points.length}`
                        }));
                        return;
                    }
                }
            }
        }

        if (activeTool === 'placement' && pendingElementType) {
            const coords = getCanvasCoordinates(e.clientX, e.clientY);
            setPlacementStart(coords);
            setGhostPosition(coords);

            // Special Handling for Pencil (Freehand)
            if (pendingElementType === 'path') {
                const pressure = (e.nativeEvent as PointerEvent).pressure || 0.5;
                const first = [coords.x, coords.y, pressure];
                pathWorldPointsRef.current = [first];
                const fitted = fitPathStroke([first], 4);
                const newElement = createElementFactory('path', fitted.x, fitted.y, elements.length + 1);
                newElement.x = fitted.x;
                newElement.y = fitted.y;
                newElement.w = fitted.w;
                newElement.h = fitted.h;
                newElement.points = fitted.points;
                newElement.color = 'transparent';

                setElements(prev => [...prev, newElement], false);
                setSelectedIds([newElement.id]);
                activeDrawingIdRef.current = newElement.id;
                pointsBufferRef.current = [];
            }

        } else if (activeTool === 'polygon_draw') {
            // Polygon Drawing Mode
            const coords = getCanvasCoordinates(e.clientX, e.clientY);

            if (drawingPolygonVertices.length >= 3) {
                // Check if clicking near start point to close
                const start = drawingPolygonVertices[0];
                const dist = Math.hypot(coords.x - start.x, coords.y - start.y);
                if (dist < POLYGON_CLOSE_THRESHOLD / scale) {
                    // Close the polygon
                    completePolygon();
                    console.log(JSON.stringify({ action: 'polygon_closed', vertices: drawingPolygonVertices, polygon_closed: true, message: 'Polygon closed by connecting to start.' }));
                    return;
                }
            }

            // Add vertex
            const newVertices = [...drawingPolygonVertices, coords];
            setDrawingPolygonVertices(newVertices);
            console.log(JSON.stringify({ action: 'vertex_added', vertices: newVertices, polygon_closed: false, message: `Vertex added at (${Math.round(coords.x)}, ${Math.round(coords.y)})` }));

        } else {
            if (e.target === e.currentTarget || (canvasRef.current && canvasRef.current.contains(e.target as Node))) {
                if (activeTool === 'select') {
                    const coords = getCanvasCoordinates(e.clientX, e.clientY);
                    marqueeRef.current = {
                        start: coords,
                        additive: e.shiftKey,
                        baseIds: e.shiftKey ? [...selectedIds] : [],
                    };
                    if (!e.shiftKey) setSelectedIds([]);
                    marqueeRectRef.current = { x: coords.x, y: coords.y, w: 0, h: 0 };
                    setMarqueeRect({ x: coords.x, y: coords.y, w: 0, h: 0 });
                }
            }
        }
    };

    const handleCanvasMouseUp = (e: React.MouseEvent) => {
        if (isPanning) {
            setIsPanning(false);
            return;
        }

        handleElementDragEnd();

        if (marqueeRef.current) {
            finishMarquee();
            return;
        }

        if (activeTool === 'placement' && pendingElementType && placementStart) {
            // For Path, we are done with this stroke.
            if (pendingElementType === 'path') {
                if (pointsBufferRef.current.length > 0) {
                    pathWorldPointsRef.current = [...pathWorldPointsRef.current, ...pointsBufferRef.current];
                    pointsBufferRef.current = [];
                }
                const activeId = activeDrawingIdRef.current;
                if (activeId && pathWorldPointsRef.current.length > 0) {
                    const fitted = fitPathStroke(pathWorldPointsRef.current, 4);
                    setElements(prev => prev.map(el => {
                        if (el.id === activeId && el.type === 'path') {
                            return { ...el, ...fitted };
                        }
                        return el;
                    }), true);
                }
                setPlacementStart(null);
                setGhostPosition(null);
                activeDrawingIdRef.current = null;
                pathWorldPointsRef.current = [];
                if (rafIdRef.current) {
                    cancelAnimationFrame(rafIdRef.current);
                    rafIdRef.current = null;
                }
                return;
            }

            const coords = getCanvasCoordinates(e.clientX, e.clientY);
            const w = Math.abs(coords.x - placementStart.x);
            const h = Math.abs(coords.y - placementStart.y);
            let finalX, finalY, finalW, finalH;

            if (w < 15 && h < 15) {
                const defaults = getElementDefaultSize(pendingElementType);
                finalX = coords.x - (defaults.w / 2);
                finalY = coords.y - (defaults.h / 2);
                finalW = defaults.w;
                finalH = defaults.h;
            } else {
                finalX = Math.min(placementStart.x, coords.x);
                finalY = Math.min(placementStart.y, coords.y);
                finalW = w;
                finalH = h;
            }

            const newElement = createElementFactory(
                pendingElementType,
                finalX,
                finalY,
                elements.length + 1,
                pendingShapeType,
                (pendingElementType === 'shape' && pendingShapeType)
                    ? SHAPES[pendingShapeType].createInitialPoints(finalW, finalH) as { x: number, y: number }[]
                    : undefined
            );
            newElement.w = finalW;
            newElement.h = finalH;

            if (pendingElementType === 'text') {
                newElement.justCreated = true;

                // Find parent board to adapt text color
                const centerX = newElement.x + newElement.w / 2;
                const centerY = newElement.y + newElement.h / 2;
                const parentBoard = elements
                    .slice().reverse() // Check higher z-index first if overlapping
                    .filter(e => e.type === 'container')
                    .find(b =>
                        centerX >= b.x && centerX <= b.x + b.w &&
                        centerY >= b.y && centerY <= b.y + b.h
                    );

                const bgColor = parentBoard?.boardConfig?.backgroundColor || parentBoard?.color || '#ffffff';

                // Simple contrast check
                const getContrast = (c: string) => {
                    if (!c || c === 'transparent') return '#000000';
                    if (c.startsWith('rgb')) return '#000000'; // Fallback for complex formats not parsed yet
                    let hex = c.replace('#', '');
                    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                    return yiq >= 128 ? '#000000' : '#ffffff';
                };

                if (newElement.textStyle) {
                    newElement.textStyle.color = getContrast(bgColor);
                }
            }

            setElements(prev => [...prev, newElement]);
            setPendingElementType(null);
            setPendingShapeType(null);
            setActiveTool('select');
            setSelectedIds([newElement.id]);
            setGhostPosition(null);
            setPlacementStart(null);
        }
    };

    // --- Global Shortcuts ---
    const deleteSelectedElement = useCallback(() => {
        if (selectedIds.length > 0) {
            setElements(prev => prev.filter(el => !selectedIds.includes(el.id)));
            setSelectedIds([]);
        }
    }, [selectedIds, setElements, setSelectedIds]);

    const removeLastPolygonVertex = useCallback(() => {
        if (drawingPolygonVertices.length > 0) {
            const newVertices = drawingPolygonVertices.slice(0, -1);
            setDrawingPolygonVertices(newVertices);
            console.log(JSON.stringify({
                action: 'vertex_removed',
                vertices: newVertices,
                polygon_closed: false,
                message: `Removed last vertex. ${newVertices.length} vertices remaining.`
            }));
        }
    }, [drawingPolygonVertices]);

    useKeyboardShortcuts({
        selectedIds,
        setSelectedIds,
        elements,
        setElements,
        setActiveTool: onSetTool,
        setIsAddMenuOpen,
        initiatePlacement,
        setScale,
        deleteSelectedElement,
        undo,
        redo,
        activeTool,
        removeLastPolygonVertex
    });

    // --- Wheel Handling (native event for passive: false support) ---
    useEffect(() => {
        const container = canvasRef.current?.parentElement;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                // Zoom - prevent default browser zoom
                e.preventDefault();
                const delta = -e.deltaY * 0.001;
                setScale(s => Math.min(Math.max(0.1, s + delta), 5));
            } else {
                // Pan
                const dx = e.deltaX;
                const dy = e.deltaY;
                setViewPos(prev => ({ x: prev.x - dx, y: prev.y - dy }));
            }
        };

        // Use passive: false to allow preventDefault() for zoom
        container.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, []);

    // --- Chat Handlers ---
    const addChatMessage = (role: 'user' | 'assistant' | 'system', content: string, layoutPlan?: LayoutPlan, imageSearchResults?: Array<{ id: string; url: string; thumbnail: string; alt: string; photographer: string }>) => {
        const newMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: role as 'user' | 'assistant', // System usually mapped to assistant visually or handled
            content,
            timestamp: Date.now(),
            modelId: role === 'assistant' ? activeModelId : undefined,
            layoutPlan,
            imageSearchResults,
        };
        setChatMessages(prev => [...prev, newMessage]);
    };

    const handleStopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsGenerating(false);
            addChatMessage('system', 'Generation stopped by user.');
        }
    };

    const handleSendMessage = async (prompt: string) => {
        addChatMessage('user', prompt);

        // Cancel previous request if any (though usually disabled)
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsGenerating(true);
        setErrorMessage(null);

        try {
            const response = await processChatMessage(
                prompt,
                chatMessages,
                elements,
                canvasConfig,
                undefined,
                controller.signal
            );

            addChatMessage('assistant', response.message, response.layoutPlan, response.imageSearchResults);

            if (response.layoutPlan && response.requiresReview) {
                setPendingPlan(response.layoutPlan);
            }

            if (response.elementToAdd) {
                // Offset by active board position so elements land inside the selected board
                const offsetX = activeBoard?.x ?? 0;
                const offsetY = activeBoard?.y ?? 0;

                const newElement = {
                    ...response.elementToAdd,
                    id: response.elementToAdd.id || crypto.randomUUID(),
                    type: (response.elementToAdd as any).elementType || response.elementToAdd.type || 'shape',
                    x: (response.elementToAdd.x || 100) + offsetX,
                    y: (response.elementToAdd.y || 100) + offsetY,
                    w: response.elementToAdd.w || (response.elementToAdd as any).width || 100,
                    h: response.elementToAdd.h || (response.elementToAdd as any).height || 100,
                    color: response.elementToAdd.color || '#e2e8f0',
                    zIndex: response.elementToAdd.zIndex || elements.length + 1,
                } as CanvasElement;
                setElements(prev => [...prev, newElement]);
            }

            // Handle mind map generation from chat
            if (response.mindMapCode) {
                const centerX = -viewPos.x + (window.innerWidth / 2) / scale;
                const centerY = -viewPos.y + (window.innerHeight / 2) / scale;
                const mindMapElement: CanvasElement = {
                    id: crypto.randomUUID(),
                    type: 'mindmap',
                    name: 'AI Mind Map',
                    x: centerX - 250,
                    y: centerY - 200,
                    w: 500,
                    h: 400,
                    zIndex: elements.length + 10,
                    color: 'transparent',
                    mermaidCode: response.mindMapCode,
                };
                setElements(prev => [...prev, mindMapElement]);
                setSelectedIds([mindMapElement.id]);
            }

            if (response.elementToRemove) {
                const elementIndex = elements.findIndex(
                    el => el.name?.toLowerCase() === response.elementToRemove!.name.toLowerCase()
                );
                if (elementIndex !== -1) {
                    if (response.elementToRemove.moveToWorkflow) {
                        setElements(prev => prev.map((el, idx) =>
                            idx === elementIndex ? { ...el, x: -1000, y: -1000 } : el
                        ));
                    } else {
                        setElements(prev => prev.filter((_, idx) => idx !== elementIndex));
                    }
                }
            }

            if (response.canvasScreenshot === 'REQUEST_SCREENSHOT') {
                const { captureCanvasScreenshot } = await import('../services/aiProviders');
                try {
                    const screenshot = await captureCanvasScreenshot(canvasRef);
                    if (screenshot) {
                        addChatMessage('system', 'Screenshot captured. Analyzing layout...');
                        const imageAnalysisResponse = await processChatMessage(
                            "I've captured the screenshot of the layout. Please analyze it as requested.",
                            [...chatMessages, { id: 'sys-img', role: 'assistant', content: response.message, timestamp: Date.now() }],
                            elements,
                            canvasConfig,
                            screenshot,
                            controller.signal
                        );
                        addChatMessage('assistant', imageAnalysisResponse.message, imageAnalysisResponse.layoutPlan);
                        if (imageAnalysisResponse.layoutPlan && imageAnalysisResponse.requiresReview) {
                            setPendingPlan(imageAnalysisResponse.layoutPlan);
                        }
                    }
                } catch (err) {
                    console.error('Failed to capture screenshot:', err);
                    addChatMessage('system', 'Failed to capture screenshot for analysis.');
                }
            }
        } catch (error: any) {
            if (error.message === 'Aborted') {
                // Ignore aborted errors
                return;
            }
            console.error(error);
            setErrorMessage("Failed to send message. " + (error.message || ''));
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
                setIsGenerating(false);
            }
        }
    };

    const handleRequestLayout = async (directPrompt?: string) => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsGenerating(true);
        setErrorMessage(null);
        // Use direct prompt if provided, otherwise fall back to chat history context
        const context = directPrompt || chatMessages.filter(m => m.role === 'user').slice(-3).map(m => m.content).join('. ');
        try {
            const { plan, message } = await quickGenerateLayout(
                context || 'Create a professional, balanced layout',
                elements,
                canvasConfig
            );

            if (controller.signal.aborted) return;

            setPendingPlan(plan);
            addChatMessage('assistant', `${message}\n\nWould you like to **proceed** with this layout or **modify** it?`, plan);
        } catch (error: any) {
            if (controller.signal.aborted) return;
            console.error(error);
            setErrorMessage("Layout generation failed. " + (error.message || ''));
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
                setIsGenerating(false);
            }
        }
    };

    const handleProceedPlan = async () => {
        if (!pendingPlan) return;

        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsGenerating(true);
        try {
            // Simulate async operation if needed, or if modifying plan triggers AI. 
            // Currently handleProceedPlan is synchronous-ish but flagged async.
            // If it becomes async in future or if setElements is expensive? 
            // Actually it just maps elements. It's fast. 
            // But we can still support "Stop" if we want to simulate consistency, although stopping a sync operation is hard.
            // However, the function IS async in the original code.

            // Wait, passing a signal to a synchronous logic (mapping elements) doesn't make sense.
            // But preserving the `isGenerating` guard and controller cleanup is good.

            const newElements: CanvasElement[] = pendingPlan.elements.map((el, index) => ({
                id: el.id,
                type: el.type,
                x: el.x,
                y: el.y,
                w: el.w,
                h: el.h,
                color: el.color || (el.type === 'mindmap' || el.type === 'container' ? 'transparent' : '#e2e8f0'),
                zIndex: el.type === 'container' ? 0 : index + 1, // Containers at bottom
                name: el.name,
                content: el.content || (el.type === 'text' ? 'Sample text content' : undefined),
                src: el.src,
                mermaidCode: el.mermaidCode, // For mindmap elements
                boardConfig: el.boardConfig, // For container elements
                textStyle: el.textStyle, // For text elements
                tableData: el.tableData, // For table elements
                shapeType: el.shapeType, // For shape elements
            }));

            if (controller.signal.aborted) return;

            setElements(newElements);
            addChatMessage('assistant', '✅ Layout has been applied to the canvas! You can now edit individual elements.');
            setPendingPlan(null);
        } catch (error) {
            if (controller.signal.aborted) return;
            setErrorMessage("Failed to apply layout.");
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
                setIsGenerating(false);
            }
        }
    };

    const handleModifyPlan = () => {
        setPendingPlan(null);
        addChatMessage('assistant', 'No problem! Please describe what changes you\'d like to make to the layout.');
    };

    const handleResetChat = () => {
        setChatMessages([]);
        setPendingPlan(null);
        setErrorMessage(null);
    };

    const toggleTheme = () => {
        setDarkMode(!darkMode);
        document.documentElement.classList.toggle('dark');
    };

    const handleUploadImage = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const newEl = createElementFactory('image', logicalWidth / 2 - 150, logicalHeight / 2 - 150, elements.length + 1);
            newEl.src = e.target?.result as string;
            setElements(prev => [...prev, newEl]);
        };
        reader.readAsDataURL(file);
    };

    const handleSelectImage = (image: { id: string; url: string; thumbnail: string; alt: string; photographer: string }) => {
        // Calculate position - offset by active board if exists
        const offsetX = activeBoard?.x ?? 0;
        const offsetY = activeBoard?.y ?? 0;

        const newEl = createElementFactory('image', 100 + offsetX, 100 + offsetY, elements.length + 1);
        newEl.src = image.url;
        newEl.name = image.alt || 'Unsplash Image';
        newEl.w = 300;
        newEl.h = 200;
        setElements(prev => [...prev, newEl]);
        setSelectedIds([newEl.id]);

        // Add confirmation message to chat
        addChatMessage('assistant', `✅ Added "${image.alt}" to the canvas!`);
    };

    const handleDeleteCurrent = useCallback(() => {
        // 1. Delete Active Board (Secondary)
        if (selectedBoardId !== 'primary' && activeBoard) {
            setConfirmDelete({
                isOpen: true,
                title: `Delete "${activeBoard.name}" completely?`,
                onConfirm: () => {
                    setElements(prev => prev.filter(el => el.id !== selectedBoardId));
                    setSelectedBoardId('primary');
                    setConfirmDelete(null);
                }
            });
            return;
        }

        // 2. Delete Workspace Page (if multiple exist)
        if (pages.length > 1) {
            setConfirmDelete({
                isOpen: true,
                title: `Delete workspace page ${currentPage + 1} and all contents?`,
                onConfirm: () => {
                    const nextPages = pages.filter((_, i) => i !== currentPage);
                    setPages(nextPages);
                    setCurrentPage(prev => Math.max(0, prev - 1));
                    setConfirmDelete(null);
                }
            });
            return;
        }

        // 3. Clear Canvas (Fallback)
        if (elements.length > 0) {
            setConfirmDelete({
                isOpen: true,
                title: 'Clear all elements from this workspace?',
                onConfirm: () => {
                    setElements([]);
                    setConfirmDelete(null);
                }
            });
        }
    }, [selectedBoardId, activeBoard, pages, currentPage, setPages, setElements, elements.length]);

    return (
        <div className="flex h-screen w-full bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark overflow-hidden transition-colors duration-200 select-none">
            {/* Modals */}
            <ElementCreationDialog
                isOpen={isAddMenuOpen}
                onClose={() => setIsAddMenuOpen(false)}
                onSelectType={initiatePlacement}
            />

            {showDocs && (
                <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-xl flex items-center justify-center p-6 md:p-20 animate-in fade-in duration-300" onClick={() => setShowDocs(false)}>
                    <div
                        className="bg-surface-dark/80 w-full max-w-5xl h-full max-h-[80vh] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row backdrop-blur-3xl animate-in zoom-in-95 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Sidebar */}
                        <div className="w-full md:w-64 bg-black/20 border-b md:border-b-0 md:border-r border-white/5 p-6 flex flex-col gap-6">
                            <div className="flex items-center gap-3 text-primary">
                                <Info size={24} />
                                <h2 className="text-xl font-bold tracking-tight">Help Center</h2>
                            </div>
                            <nav className="flex flex-col gap-1">
                                {SECTIONS.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => {
                                            const el = document.getElementById(`doc-section-${s.id}`);
                                            el?.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        className="text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all truncate"
                                    >
                                        {s.title}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-8 md:p-12 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                            {SECTIONS.map(s => (
                                <section key={s.id} id={`doc-section-${s.id}`} className="mb-16 last:mb-0">
                                    <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2 group">
                                        <span className="w-1 h-6 bg-primary rounded-full group-hover:h-8 transition-all" />
                                        {s.title}
                                    </h3>
                                    <div className="text-slate-400 leading-relaxed text-lg whitespace-pre-line bg-white/5 p-6 rounded-2xl border border-white/5">
                                        {s.content}
                                    </div>
                                </section>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowDocs(false)}
                            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            {confirmDelete?.isOpen && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setConfirmDelete(null)}>
                    <div
                        className="bg-surface-dark w-full max-w-md rounded-3xl border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)] overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle size={40} className="text-red-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-3">Are you sure?</h3>
                            <p className="text-slate-400 text-lg leading-relaxed mb-8">
                                {confirmDelete.title}
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={confirmDelete.onConfirm}
                                    className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-red-500/20 active:scale-[0.98]"
                                >
                                    Yes, Delete Permanently
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-lg transition-all active:scale-[0.98]"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Workspace */}
            <div
                className="flex-1 flex flex-col relative overflow-hidden outline-none"
            >

                <FloatingToolbar
                    activeTool={activeTool}
                    onOpenAddMenu={() => setIsAddMenuOpen(true)}
                    onSetTool={(tool, type, shapeType) => type ? initiatePlacement(type, shapeType as ShapeType) : onSetTool(tool)}
                    showCanvasSettings={showCanvasSettings}
                    onToggleCanvasSettings={() => setShowCanvasSettings(!showCanvasSettings)}
                    onOpenMindMapGenerator={() => setIsMindMapGeneratorOpen(true)}
                    onOpenP5Generator={() => setIsP5GeneratorOpen(true)}
                    onOpenAnimationHome={() => setIsAnimationHomeOpen(true)}
                />

                {showCanvasSettings && (
                    <CanvasSettingsBar
                        config={canvasConfig}
                        setConfig={setCanvasConfig}
                        selectedBoardId={selectedBoardId}
                        activeBoard={activeBoard}
                        selectedIds={selectedIds}
                        onUpdateBoards={(ids, updates) => {
                            setElements(prev => prev.map(el => {
                                if (!ids.includes(el.id)) return el;
                                if (typeof updates === 'function') return updates(el);
                                return { ...el, ...updates };
                            }));
                        }}
                        onAddPage={() => {
                            // Find right-most boundary
                            const maxX = elements.length > 0 ? Math.max(...elements.map(e => e.x + e.w)) : 0;
                            const gap = 100;
                            const newBoardX = maxX > 0 ? maxX + gap : getEffectiveDimensions(canvasConfig).width + gap;

                            const newBoard: CanvasElement = {
                                id: crypto.randomUUID(),
                                type: 'container',
                                name: `Board ${elements.filter(e => e.type === 'container').length + 2}`, // +2 because Board 1 is implicit
                                x: newBoardX,
                                y: 0,
                                w: getEffectiveDimensions(canvasConfig).width,
                                h: getEffectiveDimensions(canvasConfig).height,
                                color: '#ffffff',
                                zIndex: 0, // Background layer
                                locked: true,
                                boardConfig: { backgroundColor: '#ffffff', borderRadius: canvasConfig.borderRadius }
                            };

                            setElements(prev => [...prev, newBoard]);

                            // Move view to new board center (properly centered in viewport)
                            setViewPos(getCenteredViewPos(newBoardX + newBoard.w / 2, newBoard.h / 2));
                            setSelectedBoardId(newBoard.id);
                            setActiveTool('select');
                        }}
                    />
                )}

                <EditorHeader
                    canvasRef={canvasRef}
                    canvasConfig={canvasConfig}
                    setCanvasConfig={setCanvasConfig}
                    pages={pages}
                    setPages={setPages}
                    setCurrentPage={setCurrentPage}
                    onShowPDFViewer={() => setShowPDFViewer(true)}
                />

                <CanvasStage
                    canvasRef={canvasRef}
                    canvasConfig={canvasConfig}
                    scale={scale}
                    elements={elements}
                    selectedIds={selectedIds}
                    activeTool={activeTool}
                    pendingElementType={pendingElementType}
                    ghostPosition={ghostPosition}
                    placementStart={placementStart}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseDown={handleCanvasMouseDown}
                    onElementDragStart={handleElementDragStart}
                    setElements={setElements}
                    onResizeStart={handleElementDragStart}
                    viewPos={viewPos}
                    drawingPolygonVertices={drawingPolygonVertices}
                    polygonPreviewMousePos={polygonPreviewMousePos}
                    marqueeRect={marqueeRect}
                />

                <EditorFooter
                    currentPage={currentPage}
                    totalPages={pages.length}
                    setCurrentPage={setCurrentPage}
                    onAddPage={() => { setPages(p => [...p, []]); setCurrentPage(pages.length); }}
                    scale={scale}
                    setScale={setScale}
                    onRecenter={() => setViewPos(idealViewPos)}
                />

                <MultiAIChatPanel
                    messages={chatMessages}
                    pendingPlan={pendingPlan}
                    activeModelId={activeModelId}
                    isGenerating={isGenerating}
                    errorMessage={errorMessage}
                    onSendMessage={handleSendMessage}
                    onSelectModel={setActiveModelId}
                    onUploadImage={handleUploadImage}
                    onRequestLayout={handleRequestLayout}
                    onProceedPlan={handleProceedPlan}
                    onModifyPlan={handleModifyPlan}
                    onResetChat={handleResetChat}
                    onStopGeneration={handleStopGeneration}
                    onSelectImage={handleSelectImage}
                />
            </div>

            <PropertiesPanel
                selectedElement={selectedElement}
                selectedIds={selectedIds}
                onUpdateElements={(ids, updates) => {
                    setElements(prev => prev.map(el => {
                        if (!ids.includes(el.id)) return el;
                        if (typeof updates === 'function') return updates(el);
                        return { ...el, ...updates };
                    }));
                }}
                collapsed={rightPanelCollapsed}
                setCollapsed={setRightPanelCollapsed}
            />

            <div className="fixed top-2 left-4 z-50 flex flex-row gap-2">
                <button
                    onClick={toggleTheme}
                    className="w-10 h-10 rounded-full bg-surface-dark text-white flex items-center justify-center shadow-lg hover:bg-gray-800 transition-colors"
                    title="Toggle Dark Mode"
                >
                    {darkMode ? <Moon size={18} /> : <Sun size={18} />}
                </button>
                {(selectedBoardId !== 'primary' || pages.length > 1 || elements.length > 0) && (
                    <button
                        onClick={handleDeleteCurrent}
                        className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors animate-in slide-in-from-top-2 duration-300"
                        title={selectedBoardId !== 'primary' ? `Delete ${activeBoard?.name || 'Board'}` : (pages.length > 1 ? "Delete Workspace Page" : "Clear Workspace")}
                    >
                        <Trash2 size={18} />
                    </button>
                )}
            </div>

            {/* PDF Viewer Modal */}
            {/* PDF Viewer Modal - Always mounted to preserve state/cache */}
            <div className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 md:p-12 transition-all duration-200 ${showPDFViewer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <div className={`bg-surface-dark w-full max-w-7xl h-full rounded-2xl border border-border-dark shadow-2xl overflow-hidden flex flex-col relative transition-all duration-200 ${showPDFViewer ? 'scale-100' : 'scale-95'}`}>
                    <PDFViewer
                        onClose={() => setShowPDFViewer(false)}
                        onAddToCanvas={(text, pageNum) => {
                            const newBoardId = `board-${Date.now()}`;
                            const newBoard: CanvasElement = {
                                id: newBoardId,
                                type: 'container',
                                x: (elements.length + 1) * 50, // Stagger position
                                y: (elements.length + 1) * 50,
                                w: 600,
                                h: 800,
                                color: '#ffffff',
                                zIndex: 0,
                                name: `PDF Page ${pageNum}`,
                                content: 'board',
                                locked: true,
                                boardConfig: {
                                    backgroundColor: '#ffffff',
                                    gridCols: 12,
                                    gridRows: 12,
                                    showGrid: true
                                }
                            };

                            const textId = `text-${Date.now()}`;
                            const textElement: CanvasElement = {
                                id: textId,
                                type: 'text',
                                x: 50, // Relative to board
                                y: 50,
                                w: 500,
                                h: 700,
                                color: '#000000',
                                zIndex: 1,
                                name: `Page ${pageNum} Text`,
                                content: text,
                                textStyle: {
                                    fontSize: 14,
                                    fontFamily: 'Inter',
                                    textAlign: 'left',
                                    lineHeight: 1.5
                                }
                            };

                            // In the current simple model, elements are flat. 
                            // To simulate hierarchy, we place the text "on top" of the board visually
                            // Ideally, we'd have a parentId, but for now we just add both.
                            // If we want true containment, we'd need to update the data model.
                            // For now, let's place the board and the text at the board's position + offset.

                            const boardX = elements.length > 0 ? Math.max(...elements.map(e => e.x + e.w)) + 100 : 100;
                            const boardY = 100;

                            newBoard.x = boardX;
                            newBoard.y = boardY;

                            textElement.x = boardX + 40;
                            textElement.y = boardY + 40;

                            setElements(prev => [...prev, newBoard, textElement]);
                            setShowPDFViewer(false);

                            // Focus on new board center (properly centered in viewport)
                            const centerX = boardX + newBoard.w / 2;
                            const centerY = boardY + newBoard.h / 2;
                            setViewPos(getCenteredViewPos(centerX, centerY));
                        }}

                        onAddAllToCanvas={(pagesData) => {
                            let currentElements = [...elements];
                            let startX = currentElements.length > 0
                                ? Math.max(...currentElements.map(e => e.x + e.w)) + 100
                                : 100;
                            let startY = 100;

                            const newElements: CanvasElement[] = [];

                            pagesData.forEach((page, i) => {
                                const boardX = startX + (i * 700); // 600 width + 100 margin
                                const boardY = startY;

                                const boardId = `board-${Date.now()}-${i}`;
                                const board: CanvasElement = {
                                    id: boardId,
                                    type: 'container',
                                    x: boardX,
                                    y: boardY,
                                    w: 600,
                                    h: 800,
                                    color: '#ffffff',
                                    zIndex: 0,
                                    name: `PDF Page ${page.pageNumber}`,
                                    content: 'board',
                                    locked: true,
                                    boardConfig: {
                                        backgroundColor: '#ffffff',
                                        gridCols: 12,
                                        gridRows: 12,
                                        showGrid: true
                                    }
                                };

                                const textId = `text-${Date.now()}-${i}`;
                                const textElement: CanvasElement = {
                                    id: textId,
                                    type: 'text',
                                    x: boardX + 40,
                                    y: boardY + 40,
                                    w: 500,
                                    h: 700,
                                    color: '#000000',
                                    zIndex: 1,
                                    name: `Page ${page.pageNumber} Text`,
                                    content: page.text,
                                    textStyle: {
                                        fontSize: 14,
                                        fontFamily: 'Inter',
                                        textAlign: 'left',
                                        lineHeight: 1.5
                                    }
                                };

                                newElements.push(board, textElement);
                            });

                            setElements(prev => [...prev, ...newElements]);
                            setShowPDFViewer(false);

                            // View focus on the first new board center (properly centered in viewport)
                            if (pagesData.length > 0) {
                                const firstBoard = newElements[0];
                                const centerX = firstBoard.x + firstBoard.w / 2;
                                const centerY = firstBoard.y + firstBoard.h / 2;
                                setViewPos(getCenteredViewPos(centerX, centerY));
                            }
                        }}
                    />
                </div>
            </div>
            {/* Mind Map Generator Modal */}
            {isMindMapGeneratorOpen && (
                <MindMapGenerator
                    onClose={() => setIsMindMapGeneratorOpen(false)}
                    onInsert={(mermaidCode) => {
                        setIsMindMapGeneratorOpen(false);

                        // Initial size (will be auto-adjusted by MindMapElement after render)
                        const initialWidth = 400;
                        const initialHeight = 300;

                        // Determine target board bounds
                        let boardX = 0;
                        let boardY = 0;
                        let boardW = logicalWidth;
                        let boardH = logicalHeight;

                        if (selectedBoardId !== 'primary' && activeBoard) {
                            // Use the selected secondary board
                            boardX = activeBoard.x;
                            boardY = activeBoard.y;
                            boardW = activeBoard.w;
                            boardH = activeBoard.h;
                        }

                        // Calculate center of the target board
                        const boardCenterX = boardX + boardW / 2;
                        const boardCenterY = boardY + boardH / 2;

                        // Position element at center of board
                        let elementX = boardCenterX - initialWidth / 2;
                        let elementY = boardCenterY - initialHeight / 2;

                        // Ensure element stays within board bounds (with padding)
                        const padding = 20;
                        elementX = Math.max(boardX + padding, Math.min(elementX, boardX + boardW - initialWidth - padding));
                        elementY = Math.max(boardY + padding, Math.min(elementY, boardY + boardH - initialHeight - padding));

                        // Check for overlapping elements within the board
                        const checkOverlap = (x: number, y: number, w: number, h: number) => {
                            return elements.some(el => {
                                if (el.type === 'container') return false; // Skip board containers
                                const overlapX = x < el.x + el.w && x + w > el.x;
                                const overlapY = y < el.y + el.h && y + h > el.y;
                                return overlapX && overlapY;
                            });
                        };

                        // Try to find non-overlapping position within board
                        if (checkOverlap(elementX, elementY, initialWidth, initialHeight)) {
                            const offsets = [
                                { dx: 50, dy: 50 }, { dx: -50, dy: 50 },
                                { dx: 50, dy: -50 }, { dx: -50, dy: -50 },
                                { dx: 100, dy: 0 }, { dx: 0, dy: 100 },
                                { dx: -100, dy: 0 }, { dx: 0, dy: -100 },
                            ];

                            for (const offset of offsets) {
                                const testX = boardCenterX - initialWidth / 2 + offset.dx;
                                const testY = boardCenterY - initialHeight / 2 + offset.dy;

                                // Ensure still within board
                                if (testX >= boardX + padding && testX + initialWidth <= boardX + boardW - padding &&
                                    testY >= boardY + padding && testY + initialHeight <= boardY + boardH - padding) {
                                    if (!checkOverlap(testX, testY, initialWidth, initialHeight)) {
                                        elementX = testX;
                                        elementY = testY;
                                        break;
                                    }
                                }
                            }
                        }

                        const newElement: CanvasElement = {
                            id: crypto.randomUUID(),
                            type: 'mindmap',
                            name: 'Mind Map',
                            x: Math.round(elementX),
                            y: Math.round(elementY),
                            w: initialWidth,
                            h: initialHeight,
                            zIndex: elements.length + 10,
                            color: 'transparent',
                            mermaidCode: mermaidCode,
                        };

                        setElements(prev => [...prev, newElement]);
                        setSelectedIds([newElement.id]);
                    }}
                />
            )}
            {/* Animation Home Overlay */}
            {isAnimationHomeOpen && (
                <div className="fixed inset-0 z-[100] animate-in fade-in duration-300 overflow-y-auto overflow-x-hidden bg-black/90">
                    <AnimationHome onClose={() => setIsAnimationHomeOpen(false)} />
                </div>
            )}
            {/* P5.js Generator Modal */}
            {isP5GeneratorOpen && (
                <P5Generator
                    onClose={() => setIsP5GeneratorOpen(false)}
                    onInsert={(p5Data) => {
                        setIsP5GeneratorOpen(false);

                        // Initial size for p5.js preview
                        const initialWidth = 500;
                        const initialHeight = 400;

                        // Determine target board bounds
                        let boardX = 0;
                        let boardY = 0;
                        let boardW = logicalWidth;
                        let boardH = logicalHeight;

                        if (selectedBoardId !== 'primary' && activeBoard) {
                            boardX = activeBoard.x;
                            boardY = activeBoard.y;
                            boardW = activeBoard.w;
                            boardH = activeBoard.h;
                        }

                        // Calculate center of the target board
                        const boardCenterX = boardX + boardW / 2;
                        const boardCenterY = boardY + boardH / 2;

                        // Position element at center of board
                        let elementX = boardCenterX - initialWidth / 2;
                        let elementY = boardCenterY - initialHeight / 2;

                        // Ensure element stays within board bounds
                        const padding = 20;
                        elementX = Math.max(boardX + padding, Math.min(elementX, boardX + boardW - initialWidth - padding));
                        elementY = Math.max(boardY + padding, Math.min(elementY, boardY + boardH - initialHeight - padding));

                        const newElement: CanvasElement = {
                            id: crypto.randomUUID(),
                            type: 'p5',
                            name: p5Data.topic || 'P5.js Animation',
                            x: Math.round(elementX),
                            y: Math.round(elementY),
                            w: initialWidth,
                            h: initialHeight,
                            zIndex: elements.length + 10,
                            color: '#1a1a1a',
                            p5Data: p5Data,
                        };

                        setElements(prev => [...prev, newElement]);
                        setSelectedIds([newElement.id]);
                    }}
                />
            )}
        </div>
    );
};