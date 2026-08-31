import { useState, useCallback, useRef, useEffect } from 'react';
import { CanvasElement } from '../types';
import { isElementLocked } from '../utils/elementRegistry';

type InteractionMode = 'idle' | 'dragging' | 'resizing';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  startX: number;
  startY: number;
  originalElements: Array<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    type: string;
  }>;
  handle?: ResizeHandle;
}

export const useCanvasInteraction = (
  elements: CanvasElement[],
  setElements: (
    elements: CanvasElement[] | ((prev: CanvasElement[]) => CanvasElement[]),
    shouldPush?: boolean
  ) => void,
  scale: number = 1
) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<InteractionMode>('idle');
  const dragState = useRef<DragState | null>(null);

  const handleMouseDown = useCallback((
    e: React.MouseEvent, 
    id: string, 
    resizeHandle?: ResizeHandle
  ) => {
    // If the event target is contentEditable (text editing), do not start dragging
    if ((e.target as HTMLElement).isContentEditable) return;
    
    e.stopPropagation();
    
    let nextSelectedIds = [...selectedIds];
    if (e.shiftKey) {
      if (nextSelectedIds.includes(id)) {
        nextSelectedIds = nextSelectedIds.filter(sid => sid !== id);
      } else {
        nextSelectedIds.push(id);
      }
    } else {
      if (!nextSelectedIds.includes(id)) {
        nextSelectedIds = [id];
      }
    }
    
    setSelectedIds(nextSelectedIds);

    const clicked = elements.find(el => el.id === id);
    if (clicked && isElementLocked(clicked)) {
      setMode('idle');
      dragState.current = null;
      return;
    }

    const originalElements = elements
      .filter(el => nextSelectedIds.includes(el.id) && !isElementLocked(el))
      .map(el => ({
        id: el.id,
        x: el.x,
        y: el.y,
        w: el.w,
        h: el.h,
        type: el.type
      }));

    if (originalElements.length === 0) {
      setMode('idle');
      dragState.current = null;
      return;
    }

    setMode(resizeHandle ? 'resizing' : 'dragging');
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originalElements,
      handle: resizeHandle
    };
  }, [elements, selectedIds]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current || selectedIds.length === 0) return;

    const { startX, startY, originalElements, handle } = dragState.current;
    
    // Calculate delta taking zoom scale into account
    const deltaX = (e.clientX - startX) / scale;
    const deltaY = (e.clientY - startY) / scale;

    setElements(prev => prev.map(el => {
      const original = originalElements.find(oe => oe.id === el.id);
      if (!original) return el;

      if (handle) {
        let newX = original.x;
        let newY = original.y;
        let newW = original.w;
        let newH = original.h;

        const isImage = original.type === 'image';
        const ratio = original.w / original.h;

        if (handle.includes('w')) {
          newW = Math.max(10, original.w - deltaX);
          newX = original.x + deltaX;
          if (isImage) {
             const constrainedH = newW / ratio;
             // We need to adjust Y if it's a 'n' handle, but here we are in 'w' (could be 'nw' or 'sw')
             // If resizing width from left, and constrained height changes, we might need to adjust Y if it's 'nw'
             // But let's keep it simple: if locking aspect, usually we drive one dimension.
             // If it's pure 'w' (not corner), we just adjust height? But 'w' handle usually doesn't exist on corner-only.
             // corners:
          }
        }
        if (handle.includes('e')) {
          newW = Math.max(10, original.w + deltaX);
        }
        if (handle.includes('n')) {
          newH = Math.max(10, original.h - deltaY);
          newY = original.y + deltaY;
        }
        if (handle.includes('s')) {
          newH = Math.max(10, original.h + deltaY);
        }

        // Apply aspect ratio constraint for images
        if (isImage) {
            // Priority: Width drives Height (unless dragging vertical handle only, but we have corners)
            // If dragging corner, we have deltas for both.
            // Standard behavior: pick the dominant delta or just sync width.
            
            // Simplified logic for corners:
            if (handle.includes('e') || handle.includes('w')) {
                 newH = newW / ratio;
                 if (handle.includes('n')) {
                     newY = original.y + (original.h - newH);
                 }
            } else if (handle.includes('s') || handle.includes('n')) {
                // If only vertical (can happen if side handles added later), or if vertical delta is larger?
                // For validation, let's just stick to Width Driving Height for E/W corners, which covers NE, SE, NW, SW if moving diagonally.
                // But if moving mostly vertically, this feels weird.
                // Better approach: use projected length on diagonal.
                // Simple approach for now:
                newH = newW / ratio;
                 if (handle.includes('n')) {
                     newY = original.y + (original.h - newH); // Correction for Top anchor
                 }
            }
        }

        return {
          ...el,
          x: newX,
          y: newY,
          w: newW,
          h: newH
        };
      } else {
        // Dragging logic
        return {
          ...el,
          x: original.x + deltaX,
          y: original.y + deltaY
        };
      }
    }), false);
  }, [selectedIds, setElements, scale]);

  const commitDrag = useCallback(() => {
    const drag = dragState.current;
    if (!drag) {
      setMode('idle');
      return;
    }
    const ids = new Set(drag.originalElements.map(oe => oe.id));
    dragState.current = null;
    setMode('idle');
    setElements(prev => prev.map(el => {
      if (!ids.has(el.id)) return el;
      return {
        ...el,
        x: Math.round(el.x),
        y: Math.round(el.y),
        w: Math.round(el.w),
        h: Math.round(el.h),
      };
    }), true);
  }, [setElements]);

  const handleMouseUp = useCallback(() => {
    commitDrag();
  }, [commitDrag]);

  // Global mouse up handler to catch releases outside the element
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      commitDrag();
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [commitDrag]);

  return {
    selectedIds,
    setSelectedIds,
    mode,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  };
};