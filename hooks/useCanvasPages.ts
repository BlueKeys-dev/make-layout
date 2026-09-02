import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_CANVAS_CONFIG } from '../config/canvasDefaults';
import { INITIAL_ELEMENTS } from '../data';
import type { CanvasElement } from '../types';
import { useHistory } from './useHistory';

export type SetCanvasElements = (
  value: CanvasElement[] | ((previous: CanvasElement[]) => CanvasElement[]),
  shouldPush?: boolean,
) => void;

const normalizeContainerBoard = (element: CanvasElement): CanvasElement => {
  if (element.type !== 'container') return element;
  return {
    ...element,
    boardConfig: {
      ...element.boardConfig,
      showGuides: element.boardConfig?.showGuides ?? DEFAULT_CANVAS_CONFIG.showGuides,
      bleed: element.boardConfig?.bleed ?? DEFAULT_CANVAS_CONFIG.bleed,
    },
  };
};

const normalizePages = (pages: CanvasElement[][]): CanvasElement[][] =>
  pages.map(page => page.map(normalizeContainerBoard));

const getInitialPages = (): CanvasElement[][] => {
  try {
    const saved = localStorage.getItem('ai-layout-pages');
    if (saved) return normalizePages(JSON.parse(saved));
  } catch (error) {
    console.warn('Persistence Error', error);
  }
  return [INITIAL_ELEMENTS];
};

export const useCanvasPages = () => {
  const {
    state: pages,
    setState: setPages,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<CanvasElement[][]>(getInitialPages());
  const [currentPage, setCurrentPage] = useState(0);
  const safePageIndex = Math.max(0, Math.min(currentPage, Math.max(0, pages.length - 1)));
  const elements = pages[safePageIndex] ?? [];

  useEffect(() => {
    try {
      localStorage.setItem('ai-layout-pages', JSON.stringify(pages));
    } catch {
      // Canvas persistence is best-effort; editing remains available.
    }
  }, [pages]);

  useEffect(() => {
    if (currentPage !== safePageIndex) setCurrentPage(safePageIndex);
  }, [currentPage, safePageIndex]);

  const setElements = useCallback<SetCanvasElements>((value, shouldPush = true) => {
    setPages(previousPages => {
      const nextPages = [...previousPages];
      const currentElements = nextPages[safePageIndex] ?? [];
      nextPages[safePageIndex] = typeof value === 'function' ? value(currentElements) : value;
      return nextPages;
    }, shouldPush);
  }, [safePageIndex, setPages]);

  return {
    pages,
    setPages,
    currentPage,
    setCurrentPage,
    elements,
    setElements,
    undo,
    redo,
    canUndo,
    canRedo,
  };
};
