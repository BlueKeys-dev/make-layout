import { useEffect, useRef, useState } from 'react';
import { ElementType, CanvasElement } from '../types';
import { createElementFactory } from '../utils/elementRegistry';

interface UseKeysProps {
    selectedIds: string[];
    setSelectedIds: (ids: string[]) => void;
    elements: CanvasElement[];
    setElements: (callback: (prev: CanvasElement[]) => CanvasElement[]) => void;
    setActiveTool: (tool: string) => void;
    setIsAddMenuOpen: (isOpen: boolean) => void;
    initiatePlacement: (type: ElementType) => void;
    setScale: (callback: (prev: number) => number) => void;
    deleteSelectedElement: () => void;
    undo: () => void;
    redo: () => void;
    activeTool: string;
    removeLastPolygonVertex: () => void;
}

export const useKeyboardShortcuts = ({
    selectedIds,
    setSelectedIds,
    elements,
    setElements,
    setActiveTool,
    setIsAddMenuOpen,
    initiatePlacement,
    setScale,
    deleteSelectedElement,
    undo,
    redo,
    activeTool,
    removeLastPolygonVertex
}: UseKeysProps) => {
    
    // Internal clipboard for elements
    const [clipboard, setClipboard] = useState<CanvasElement[]>([]);
    
    // Refs to access latest state in event listeners without re-binding
    const elementsRef = useRef(elements);
    useEffect(() => { elementsRef.current = elements; }, [elements]);

    const selectedIdsRef = useRef(selectedIds);
    useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

    const clipboardRef = useRef(clipboard);
    useEffect(() => { clipboardRef.current = clipboard; }, [clipboard]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).isContentEditable || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
            
            const isCtrl = e.ctrlKey || e.metaKey;

            if (e.key === 'Escape' || e.code === 'Escape') {
                e.preventDefault();
                setSelectedIds([]);
                return;
            }

            // Tools
            if (!isCtrl && !e.shiftKey) {
                if(e.key === 'm' || e.code === 'KeyM') setActiveTool('select');
                if(e.key === 'h' || e.code === 'KeyH') setActiveTool('hand');
                if(e.key === 't' || e.code === 'KeyT') initiatePlacement('text');
                if(e.key === 'r' || e.code === 'KeyR') initiatePlacement('shape');
                if(e.key === 'p' || e.code === 'KeyP') initiatePlacement('path');
                if(e.key === 'g' || e.code === 'KeyG') setActiveTool('polygon_draw');
                if(e.key === ' ' || e.code === 'Space') {
                    e.preventDefault(); // Prevent scrolling
                    setIsAddMenuOpen(true);
                }
            }

            // Actions
            if (e.key === 'Backspace' || e.key === 'Delete' || e.code === 'Delete' || e.code === 'Backspace') {
                // Remove last vertex in polygon draw mode
                if (activeTool === 'polygon_draw') {
                    e.preventDefault();
                    removeLastPolygonVertex();
                    return;
                }
                // Otherwise delete selected element
                if(selectedIdsRef.current.length > 0) {
                    deleteSelectedElement();
                }
            }

            // Zoom
            if (isCtrl) {
                if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') { e.preventDefault(); setScale(s => Math.min(s + 0.1, 3)); }
                if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') { e.preventDefault(); setScale(s => Math.max(s - 0.1, 0.2)); }
                if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') { e.preventDefault(); setScale(() => 1); }
                
                // Undo (Ctrl+Z)
                if (e.code === 'KeyZ' && !e.shiftKey) {
                    e.preventDefault();
                    undo();
                }
                // Redo (Ctrl+Y or Ctrl+Shift+Z)
                if (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey)) {
                    e.preventDefault();
                    redo();
                }
                if (e.code === 'KeyA') {
                    e.preventDefault();
                    setSelectedIds(elementsRef.current.map(el => el.id));
                }
            }

            // Copy (Ctrl+C)
            if (isCtrl && e.code === 'KeyC') {
                if (selectedIdsRef.current.length > 0) {
                    const selectedElements = elementsRef.current.filter(e => selectedIdsRef.current.includes(e.id));
                    if (selectedElements.length > 0) {
                        setClipboard(selectedElements);
                    }
                }
            }

            // Paste (Ctrl+V) - Internal Elements
            if (isCtrl && e.code === 'KeyV') {
                if (clipboardRef.current.length > 0) {
                    e.preventDefault(); // Prevent system paste if we have internal clipboard
                    const newElements = clipboardRef.current.map(el => ({
                        ...el,
                        id: crypto.randomUUID(),
                        x: el.x + 20,
                        y: el.y + 20,
                        zIndex: elementsRef.current.length + 1
                    }));
                    setElements(prev => [...prev, ...newElements]);
                    setSelectedIds(newElements.map(el => el.id));
                }
            }
        };

        const handlePaste = (e: ClipboardEvent) => {
             // Only handle paste if not in an input/textarea
             if ((e.target as HTMLElement).isContentEditable || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

             // If internal clipboard handled it in keyDown, we shouldn't get here usually, but if we do:
             // Actually, keydown doesn't stop prompt 'paste' event unless preventDefault is called.
             // I added preventDefault in KeyV block if clipboardRef has content.
             
             e.preventDefault();

             // 1. Handle Files (Images)
             if (e.clipboardData?.files.length) {
                 const file = e.clipboardData.files[0];
                 if (file.type.startsWith('image/')) {
                     const reader = new FileReader();
                     reader.onload = (evt) => {
                         const src = evt.target?.result as string;
                         // Center paste roughly or at top-left
                         const newEl = createElementFactory('image', 100, 100, elementsRef.current.length + 1);
                         newEl.src = src;
                         setElements(prev => [...prev, newEl]);
                     };
                     reader.readAsDataURL(file);
                     return;
                 }
             }

             // 2. Handle Text
             const text = e.clipboardData?.getData('text');
             if (text) {
                 const newEl = createElementFactory('text', 100, 100, elementsRef.current.length + 1);
                 newEl.content = text;
                 setElements(prev => [...prev, newEl]);
             }
        };

        // Block browser zoom via Ctrl+Wheel and apply canvas zoom instead
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                // Apply canvas zoom: scroll up = zoom in, scroll down = zoom out
                if (e.deltaY < 0) {
                    setScale(s => Math.min(s + 0.1, 3));
                } else if (e.deltaY > 0) {
                    setScale(s => Math.max(s - 0.1, 0.2));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('paste', handlePaste);
        // Use passive: false to allow preventDefault() on wheel events
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('paste', handlePaste);
            window.removeEventListener('wheel', handleWheel);
        };
    }, [deleteSelectedElement, setActiveTool, setIsAddMenuOpen, initiatePlacement, setScale, setElements, setSelectedIds, undo, redo, removeLastPolygonVertex]);
};
