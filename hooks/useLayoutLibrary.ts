import { useCallback, useState } from 'react';
import type { CanvasElement, LayoutTemplate } from '../types';
import {
  createUserLayoutTemplate,
  deleteUserLayoutTemplate,
  getLayoutTemplates,
  instantiateLayoutTemplate,
  loadUserLayoutTemplates,
  storeUserLayoutTemplates,
} from '../services/layoutTemplates';
import { resolveLayoutTargetRect } from '../utils/layoutTarget';
import type { SetCanvasElements } from './useCanvasPages';

type CurrentRef<T> = { current: T };

type UseLayoutLibraryOptions = {
  elementsRef: CurrentRef<CanvasElement[]>;
  activeBoardIdRef: CurrentRef<string | null>;
  logicalWidth: number;
  logicalHeight: number;
  setElements: SetCanvasElements;
  setActiveTool: (tool: string) => void;
};

const readErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const useLayoutLibrary = ({
  elementsRef,
  activeBoardIdRef,
  logicalWidth,
  logicalHeight,
  setElements,
  setActiveTool,
}: UseLayoutLibraryOptions) => {
  const [layoutLibrary, setLayoutLibrary] = useState(() => getLayoutTemplates());

  const refreshLayoutLibrary = useCallback((error: string | null = null) => {
    try {
      const next = getLayoutTemplates();
      setLayoutLibrary({ templates: next.templates, error: error ?? next.error });
    } catch (refreshError) {
      console.error('[Layouts] Failed to refresh layout library:', refreshError);
      setLayoutLibrary(previous => ({
        ...previous,
        error: error ?? 'Saved layouts could not be refreshed.',
      }));
    }
  }, []);

  const handleLoadLayoutTemplate = useCallback((template: LayoutTemplate) => {
    try {
      const target = resolveLayoutTargetRect(
        elementsRef.current,
        activeBoardIdRef.current,
        { width: logicalWidth, height: logicalHeight },
      );
      const zIndexStart = elementsRef.current.reduce(
        (maximum, element) => Math.max(maximum, element.zIndex),
        0,
      ) + 1;
      const layoutElements = instantiateLayoutTemplate(template, target, zIndexStart);
      setElements(previous => [...previous, ...layoutElements]);
      setActiveTool('select');
      setLayoutLibrary(previous => ({ ...previous, error: null }));
      return true;
    } catch (error) {
      console.error('[Layouts] Failed to load layout:', error);
      setLayoutLibrary(previous => ({
        ...previous,
        error: readErrorMessage(error, 'Layout could not be loaded.'),
      }));
      return false;
    }
  }, [activeBoardIdRef, elementsRef, logicalHeight, logicalWidth, setActiveTool, setElements]);

  const handleSaveLayoutTemplate = useCallback((name: string) => {
    try {
      const target = resolveLayoutTargetRect(
        elementsRef.current,
        activeBoardIdRef.current,
        { width: logicalWidth, height: logicalHeight },
      );
      const template = createUserLayoutTemplate(name, elementsRef.current, target);
      const saved = loadUserLayoutTemplates();
      storeUserLayoutTemplates([...saved.templates, template]);
      refreshLayoutLibrary();
      return true;
    } catch (error) {
      console.error('[Layouts] Failed to save layout:', error);
      setLayoutLibrary(previous => ({
        ...previous,
        error: readErrorMessage(error, 'Layout could not be saved.'),
      }));
      return false;
    }
  }, [activeBoardIdRef, elementsRef, logicalHeight, logicalWidth, refreshLayoutLibrary]);

  const handleDeleteLayoutTemplate = useCallback((templateId: string) => {
    if (!window.confirm('Delete this saved layout?')) return;
    try {
      deleteUserLayoutTemplate(templateId);
      refreshLayoutLibrary();
    } catch (error) {
      console.error('[Layouts] Failed to delete layout:', error);
      setLayoutLibrary(previous => ({
        ...previous,
        error: readErrorMessage(error, 'Layout could not be deleted.'),
      }));
    }
  }, [refreshLayoutLibrary]);

  return {
    layoutLibrary,
    handleLoadLayoutTemplate,
    handleSaveLayoutTemplate,
    handleDeleteLayoutTemplate,
  };
};
