import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Moon, Sun, Trash2 } from 'lucide-react';
import { CanvasElement, CanvasConfig, ChatMessage, LayoutPlan, AIModelId } from '../types';
import { DEFAULT_CANVAS_CONFIG, getEffectiveDimensions, loadCanvasConfig, saveCanvasConfig } from '../config/canvasDefaults';
import { PropertiesPanel } from './PropertiesPanel';
import { processChatMessage, quickGenerateLayout } from '../services/chatai';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction';
import { FloatingToolbar } from './FloatingToolbar';
import { MultiAIChatPanel } from './chat';
import { CanvasSettingsBar } from './CanvasSettingsBar';
import { createElementFactory } from '../utils/elementRegistry';
import { getDefaultModel } from '../services/aiProviders';

// Refactored Imports
import { EditorHeader } from './editor/EditorHeader';
import { EditorFooter } from './editor/EditorFooter';
import { CanvasStage } from './canvas/CanvasStage';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useCanvasPages } from '../hooks/useCanvasPages';
import { useLayoutLibrary } from '../hooks/useLayoutLibrary';
import { ShapeType } from '../types';
import { CanvasToolOutcome } from '../services/canvasToolEngine';
import { CanvasToolName } from '../services/canvasToolCatalog';
import { useDesignEditorWebMcp } from '../hooks/useDesignEditorWebMcp';
import { useCanvasInsertions } from '../hooks/useCanvasInsertions';
import { useCanvasPlacement } from '../hooks/useCanvasPlacement';
import { DesignEditorModals, type ConfirmDeleteState } from './editor/DesignEditorModals';

const getInitialViewPosition = () => {
    const { width, height } = getEffectiveDimensions(DEFAULT_CANVAS_CONFIG);
    return { x: -width / 2, y: -height / 2 };
};

export const DesignEditor = () => {
    const {
        pages,
        setPages,
        currentPage,
        setCurrentPage,
        elements,
        setElements,
        undo,
        redo,
        canUndo,
        canRedo
    } = useCanvasPages();

    // -- Interaction State --
    const [isMindMapGeneratorOpen, setIsMindMapGeneratorOpen] = useState(false);
    const [isP5GeneratorOpen, setIsP5GeneratorOpen] = useState(false);
    const [isAnimationHomeOpen, setIsAnimationHomeOpen] = useState(false);

    const closeAnimationHome = useCallback(() => {
        setIsAnimationHomeOpen(false);
    }, []);
    // -- View State --
    const [isGenerating, setIsGenerating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [darkMode, setDarkMode] = useState(true);
    const [scale, setScale] = useState(1);
    const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
    const [showDocs, setShowDocs] = useState(false);
    const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(loadCanvasConfig);

    useEffect(() => {
        saveCanvasConfig(canvasConfig);
    }, [canvasConfig]);
    const [showCanvasSettings, setShowCanvasSettings] = useState(false);
    const [showPDFViewer, setShowPDFViewer] = useState(false);

    // -- Infinite Canvas State --
    const [viewPos, setViewPos] = useState(getInitialViewPosition);

    // -- Chat State --
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [activeModelId, setActiveModelId] = useState<AIModelId>(getDefaultModel().id);
    const [pendingPlan, setPendingPlan] = useState<LayoutPlan | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | null>(null);
    const [isUiLocked, setIsUiLocked] = useState(false);

    const canvasRef = useRef<HTMLDivElement>(null);
    const scaleRef = useRef(scale);
    const viewPosRef = useRef(viewPos);
    scaleRef.current = scale;
    viewPosRef.current = viewPos;
    const abortControllerRef = useRef<AbortController | null>(null);
    const elementsRef = useRef<CanvasElement[]>([]);
    const canvasConfigRef = useRef(canvasConfig);
    const currentPageRef = useRef(currentPage);
    const pageCountRef = useRef(pages.length);
    const selectedIdsRef = useRef<string[]>([]);
    const activeBoardIdRef = useRef<string | null>(null);
    const uiLockedRef = useRef(false);
    const canvasRevisionRef = useRef(0);
    const previousCanvasRef = useRef({ pages, currentPage, canvasConfig });
    const { width: logicalWidth, height: logicalHeight } = getEffectiveDimensions(canvasConfig);

    // -- Interaction Hooks --
    const {
        selectedIds,
        setSelectedIds,
        handleMouseDown: handleElementDragStart,
        handleMouseMove: handleElementDragMove,
        handleMouseUp: handleElementDragEnd
    } = useCanvasInteraction(elements, setElements, scale);

    elementsRef.current = elements;
    const {
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
    } = useCanvasPlacement({
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
    });

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
        ? elements.find(e => e.id === selectedBoardId) ?? null
        : null;
    const layoutTargetWidth = activeBoard?.w ?? logicalWidth;
    const layoutTargetHeight = activeBoard?.h ?? logicalHeight;
    const layoutTargetOrientation = layoutTargetWidth === layoutTargetHeight
        ? 'square'
        : layoutTargetWidth > layoutTargetHeight ? 'landscape' : 'portrait';

    canvasConfigRef.current = canvasConfig;
    currentPageRef.current = currentPage;
    pageCountRef.current = pages.length;
    selectedIdsRef.current = selectedIds;
    activeBoardIdRef.current = activeBoard?.id || null;
    uiLockedRef.current = isUiLocked;

    const {
        layoutLibrary,
        handleLoadLayoutTemplate,
        handleSaveLayoutTemplate,
        handleDeleteLayoutTemplate,
    } = useLayoutLibrary({
        elementsRef,
        activeBoardIdRef,
        logicalWidth,
        logicalHeight,
        setElements,
        setActiveTool,
    });

    useLayoutEffect(() => {
        if (
            previousCanvasRef.current.pages !== pages
            || previousCanvasRef.current.currentPage !== currentPage
            || previousCanvasRef.current.canvasConfig !== canvasConfig
        ) {
            canvasRevisionRef.current += 1;
            previousCanvasRef.current = { pages, currentPage, canvasConfig };
        }
    }, [pages, currentPage, canvasConfig]);

    useEffect(() => {
        if (!isUiLocked) return;
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        const timeout = window.setTimeout(() => setIsUiLocked(false), 5 * 60 * 1000);
        return () => window.clearTimeout(timeout);
    }, [isUiLocked]);

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

    const idealViewPos = getIdealViewPos();

    useEffect(() => {
        if (selectedIds.length > 0) setRightPanelCollapsed(false);
    }, [selectedIds]);

    // --- Global Shortcuts ---
    const deleteSelectedElement = useCallback(() => {
        if (selectedIds.length > 0) {
            setElements(prev => prev.filter(el => !selectedIds.includes(el.id)));
            setSelectedIds([]);
        }
    }, [selectedIds, setElements, setSelectedIds]);

    const zoomTo = useCallback((nextScale: number, focusX: number, focusY: number) => {
        const s = scaleRef.current;
        const clamped = Math.min(Math.max(0.1, nextScale), 5);
        if (clamped === s) return;
        const k = clamped / s;
        const prev = viewPosRef.current;
        const nextPos = {
            x: focusX - (focusX - prev.x) * k,
            y: focusY - (focusY - prev.y) * k,
        };
        scaleRef.current = clamped;
        viewPosRef.current = nextPos;
        setScale(clamped);
        setViewPos(nextPos);
    }, []);

    const setScaleFromCenter = useCallback((value: number | ((prev: number) => number)) => {
        const s = scaleRef.current;
        const next = typeof value === 'function' ? value(s) : value;
        zoomTo(next, 0, 0);
    }, [zoomTo]);

    const handleUndo = useCallback(() => {
        const restoredPages = undo();
        if (!restoredPages) return;
        setCurrentPage(index => Math.min(index, Math.max(0, restoredPages.length - 1)));
        setSelectedIds([]);
        setSelectedBoardId('primary');
    }, [setSelectedIds, undo]);

    const handleRedo = useCallback(() => {
        const restoredPages = redo();
        if (!restoredPages) return;
        setCurrentPage(index => restoredPages.length > pageCountRef.current
            ? restoredPages.length - 1
            : Math.min(index, Math.max(0, restoredPages.length - 1)));
        setSelectedIds([]);
        setSelectedBoardId('primary');
    }, [redo, setSelectedIds]);

    useKeyboardShortcuts({
        enabled: !isUiLocked,
        selectedIds,
        setSelectedIds,
        elements,
        setElements,
        setActiveTool: onSetTool,
        setIsAddMenuOpen,
        initiatePlacement,
        setScale: setScaleFromCenter,
        deleteSelectedElement,
        undo: handleUndo,
        redo: handleRedo,
        activeTool,
        removeLastPolygonVertex
    });

    useEffect(() => {
        const container = canvasRef.current?.parentElement;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                let dy = e.deltaY;
                if (e.deltaMode === 1) dy *= 16;
                else if (e.deltaMode === 2) dy *= 256;
                const next = scaleRef.current * Math.exp(-dy * 0.0008);
                const rect = container.getBoundingClientRect();
                const focusX = e.clientX - (rect.left + rect.width / 2);
                const focusY = e.clientY - (rect.top + rect.height / 2);
                zoomTo(next, focusX, focusY);
            } else {
                setViewPos(prev => {
                    const next = { x: prev.x - e.deltaX, y: prev.y - e.deltaY };
                    viewPosRef.current = next;
                    return next;
                });
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, [zoomTo]);

    // --- Chat Handlers ---
    const addChatMessage = useCallback((role: 'user' | 'assistant' | 'system', content: string, layoutPlan?: LayoutPlan, imageSearchResults?: Array<{ id: string; url: string; thumbnail: string; alt: string; photographer: string; photographerUrl: string }>) => {
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
    }, [activeModelId]);

    const requestConfirmation = useCallback((title: string, signal: AbortSignal, confirmLabel = 'Yes, Delete Permanently') => new Promise<boolean>((resolve) => {
        if (signal.aborted) {
            resolve(false);
            return;
        }

        let settled = false;
        const finish = (confirmed: boolean) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            signal.removeEventListener('abort', handleAbort);
            setConfirmDelete(null);
            resolve(confirmed);
        };
        const handleAbort = () => finish(false);
        const timeout = window.setTimeout(() => finish(false), 60_000);
        signal.addEventListener('abort', handleAbort, { once: true });
        setConfirmDelete({
            isOpen: true,
            title,
            confirmLabel,
            onConfirm: () => finish(true),
            onCancel: () => finish(false),
        });
    }), []);

    const { applyCanvasToolOutcome } = useDesignEditorWebMcp({
        elementsRef,
        canvasConfigRef,
        currentPageRef,
        pageCountRef,
        selectedIdsRef,
        activeBoardIdRef,
        uiLockedRef,
        canvasRevisionRef,
        scaleRef,
        viewPosRef,
        activeBoard,
        confirmationOpen: Boolean(confirmDelete?.isOpen),
        requestConfirmation,
        setElements,
        setSelectedIds,
        setIsUiLocked,
        setPendingPlan,
        addChatMessage,
    });

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
                canvasRevisionRef.current,
                undefined,
                controller.signal
            );

            addChatMessage('assistant', response.message, response.layoutPlan, response.imageSearchResults);
            if (response.functionCalled) {
                const outcome: CanvasToolOutcome = {
                    success: true,
                    tool: response.functionCalled as CanvasToolName,
                    message: response.message,
                    effects: {
                        expectedRevision: response.expectedRevision,
                        elementToAdd: response.elementToAdd as CanvasElement | undefined,
                        elementIdToRemove: response.elementToRemove?.id,
                        removalReason: response.removalReason,
                        pendingPlan: response.layoutPlan,
                        imageSearchResults: response.imageSearchResults,
                        diagramCode: response.mindMapCode,
                    },
                };
                const applied = await applyCanvasToolOutcome(outcome, controller.signal, false);
                if (!applied.success) addChatMessage('system', applied.error?.message || 'The canvas action was not applied.');
            }
        } catch (error: any) {
            if (controller.signal.aborted || error?.name === 'AbortError') return;
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
        const baseRevision = canvasRevisionRef.current;
        try {
            const { plan, message } = await quickGenerateLayout(
                context || 'Create a professional, balanced layout',
                elements,
                canvasConfig,
                controller.signal,
            );

            if (controller.signal.aborted) return;
            if (canvasRevisionRef.current !== baseRevision) {
                setErrorMessage('The canvas changed while the layout was being generated. Please try again.');
                return;
            }

            plan.baseRevision = baseRevision;
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
        if (pendingPlan.baseRevision !== undefined && pendingPlan.baseRevision !== canvasRevisionRef.current) {
            setErrorMessage('This layout plan is stale because the canvas changed. Generate a new plan before applying it.');
            return;
        }

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

            const plannedById = new Map(newElements.map(element => [element.id, element]));
            const currentIds = new Set(elements.map(element => element.id));
            const mergedElements = elements.map(element => {
                const planned = plannedById.get(element.id);
                if (!planned) return element;
                return {
                    ...element,
                    x: planned.x,
                    y: planned.y,
                    w: planned.w,
                    h: planned.h,
                };
            });
            for (const planned of newElements) {
                if (!currentIds.has(planned.id)) mergedElements.push(planned);
            }

            if (controller.signal.aborted) return;

            setElements(mergedElements);
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

    const {
        handleAddPDFPage,
        handleAddAllPDFPages,
        handleInsertMindMap,
        handleInsertP5,
        handleAddBoard,
    } = useCanvasInsertions({
        elements,
        activeBoardId: activeBoard?.id ?? null,
        logicalWidth,
        logicalHeight,
        canvasConfig,
        scale,
        setElements,
        setSelectedIds,
        setSelectedBoardId,
        setActiveTool,
        setViewPos,
        closePdfViewer: () => setShowPDFViewer(false),
        closeMindMapGenerator: () => setIsMindMapGeneratorOpen(false),
        closeP5Generator: () => setIsP5GeneratorOpen(false),
    });

    return (
        <div className="flex h-screen w-full bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark overflow-hidden transition-colors duration-200 select-none">
            <DesignEditorModals
                isAddMenuOpen={isAddMenuOpen}
                onCloseAddMenu={() => setIsAddMenuOpen(false)}
                onSelectElementType={initiatePlacement}
                showDocs={showDocs}
                onCloseDocs={() => setShowDocs(false)}
                confirmDelete={confirmDelete}
                onCloseConfirmDelete={() => setConfirmDelete(null)}
                isUiLocked={isUiLocked}
                onUnlockUi={() => setIsUiLocked(false)}
                showPDFViewer={showPDFViewer}
                onClosePDFViewer={() => setShowPDFViewer(false)}
                onAddPDFPage={handleAddPDFPage}
                onAddAllPDFPages={handleAddAllPDFPages}
                isMindMapGeneratorOpen={isMindMapGeneratorOpen}
                onCloseMindMapGenerator={() => setIsMindMapGeneratorOpen(false)}
                onInsertMindMap={handleInsertMindMap}
                isAnimationHomeOpen={isAnimationHomeOpen}
                onCloseAnimationHome={closeAnimationHome}
                isP5GeneratorOpen={isP5GeneratorOpen}
                onCloseP5Generator={() => setIsP5GeneratorOpen(false)}
                onInsertP5={handleInsertP5}
            />

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
                        layoutTemplates={layoutLibrary.templates}
                        layoutOrientation={layoutTargetOrientation}
                        layoutError={layoutLibrary.error}
                        onLoadLayout={handleLoadLayoutTemplate}
                        onSaveLayout={handleSaveLayoutTemplate}
                        onDeleteLayout={handleDeleteLayoutTemplate}
                        onAddPage={handleAddBoard}
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
                    stackVertical={!rightPanelCollapsed}
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
                    setScale={setScaleFromCenter}
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

            <div className={`fixed top-2 left-4 z-50 flex gap-2 ${rightPanelCollapsed ? 'flex-row' : 'flex-col'}`}>
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

        </div>
    );
};
