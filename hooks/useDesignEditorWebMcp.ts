import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CanvasConfig, CanvasElement, ChatMessage, LayoutPlan } from '../types';
import type { CanvasToolOutcome } from '../services/canvasToolEngine';
import { registerDesignTools } from '../services/webmcp';
import type { CanvasToolApplyResult } from '../services/webmcp';
import type { SetCanvasElements, SetCanvasPages } from './useCanvasPages';
import { getNextElementZIndex, placeElementInCanvas } from '../utils/canvasPlacement';
import { CANVAS_CONFIG_STORAGE_VERSION, parseCanvasConfig } from '../config/canvasDefaults';

type CurrentRef<T> = { current: T };

type ConfirmationRequest = (
  title: string,
  signal: AbortSignal,
  confirmLabel?: string,
) => Promise<boolean>;

type AddChatMessage = (
  role: ChatMessage['role'],
  content: string,
  layoutPlan?: LayoutPlan,
  imageSearchResults?: Array<{
    id: string;
    url: string;
    thumbnail: string;
    alt: string;
    photographer: string;
    photographerUrl: string;
  }>,
) => void;

type UseDesignEditorWebMcpOptions = {
  elementsRef: CurrentRef<CanvasElement[]>;
  canvasConfigRef: CurrentRef<CanvasConfig>;
  currentPageRef: CurrentRef<number>;
  pageCountRef: CurrentRef<number>;
  selectedIdsRef: CurrentRef<string[]>;
  activeBoardIdRef: CurrentRef<string | null>;
  uiLockedRef: CurrentRef<boolean>;
  canvasRevisionRef: CurrentRef<number>;
  activeBoard: CanvasElement | null;
  confirmationOpen: boolean;
  requestConfirmation: ConfirmationRequest;
  setPages: SetCanvasPages;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  setCanvasConfig: Dispatch<SetStateAction<CanvasConfig>>;
  setElements: SetCanvasElements;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setIsUiLocked: Dispatch<SetStateAction<boolean>>;
  setPendingPlan: Dispatch<SetStateAction<LayoutPlan | null>>;
  addChatMessage: AddChatMessage;
};

export const useDesignEditorWebMcp = ({
  elementsRef,
  canvasConfigRef,
  currentPageRef,
  pageCountRef,
  selectedIdsRef,
  activeBoardIdRef,
  uiLockedRef,
  canvasRevisionRef,
  activeBoard,
  confirmationOpen,
  requestConfirmation,
  setPages,
  setCurrentPage,
  setCanvasConfig,
  setElements,
  setSelectedIds,
  setIsUiLocked,
  setPendingPlan,
  addChatMessage,
}: UseDesignEditorWebMcpOptions) => {
  const registrationEpochRef = useRef(0);
  const applyOutcomeRef = useRef<((
    outcome: CanvasToolOutcome,
    signal: AbortSignal,
    announce: boolean,
  ) => Promise<CanvasToolApplyResult>) | null>(null);

  const applyCanvasToolOutcome = useCallback(async (
    outcome: CanvasToolOutcome,
    signal: AbortSignal,
    announce: boolean,
  ): Promise<CanvasToolApplyResult> => {
    const effects = outcome.effects;
    if (!effects) return { success: true, revision: canvasRevisionRef.current };
    signal.throwIfAborted();

    const expectedRevision = effects.expectedRevision;
    if (announce && expectedRevision !== undefined && !uiLockedRef.current) {
      return { success: false, revision: canvasRevisionRef.current, error: { code: 'UI_NOT_LOCKED', message: 'The UI lock expired or was released before the canvas write completed.' } };
    }
    if (expectedRevision !== undefined && expectedRevision !== canvasRevisionRef.current) {
      return { success: false, revision: canvasRevisionRef.current, error: { code: 'STALE_CANVAS', message: `Canvas revision changed to ${canvasRevisionRef.current}; capture it again.` } };
    }

    const snapshot = elementsRef.current;
    const removalTarget = effects.elementIdToRemove
      ? snapshot.find(element => element.id === effects.elementIdToRemove)
      : undefined;
    if (effects.elementIdToRemove) {
      if (confirmationOpen) {
        return { success: false, revision: canvasRevisionRef.current, error: { code: 'CONFIRMATION_BUSY', message: 'Another confirmation is already open.' } };
      }
      if (!removalTarget) return { success: false, revision: canvasRevisionRef.current, error: { code: 'ELEMENT_NOT_FOUND', message: 'The element no longer exists.' } };
      const reason = effects.removalReason ? ` Reason: ${effects.removalReason}` : '';
      const confirmed = await requestConfirmation(`Remove "${removalTarget.name}" from the canvas?${reason}`, signal);
      signal.throwIfAborted();
      if (!confirmed) return { success: false, revision: canvasRevisionRef.current, error: { code: 'USER_CANCELLED', message: 'The user cancelled or did not confirm removal.' } };
      if (announce && !uiLockedRef.current) {
        return { success: false, revision: canvasRevisionRef.current, error: { code: 'UI_NOT_LOCKED', message: 'The UI lock expired or was released while confirmation was open.' } };
      }
      if (expectedRevision !== undefined && expectedRevision !== canvasRevisionRef.current) {
        return { success: false, revision: canvasRevisionRef.current, error: { code: 'STALE_CANVAS', message: 'The canvas changed while confirmation was open.' } };
      }
    }

    const replacementTarget = effects.elementReplacement
      ? snapshot.find(element => element.id === effects.elementReplacement?.id)
      : undefined;
    if (effects.elementReplacement) {
      const replacement = effects.elementReplacement;
      if (!replacementTarget) {
        return { success: false, revision: canvasRevisionRef.current, error: { code: 'ELEMENT_NOT_FOUND', message: 'The layout slot no longer exists.' } };
      }
      const replacesFilledSlot = announce
        && replacementTarget.layoutSlot?.role !== null
        && replacementTarget.layoutSlot?.role !== replacement.layoutSlot?.role;
      if (replacesFilledSlot) {
        if (confirmationOpen) {
          return { success: false, revision: canvasRevisionRef.current, error: { code: 'CONFIRMATION_BUSY', message: 'Another confirmation is already open.' } };
        }
        const confirmed = await requestConfirmation(
          `Replace the current ${replacementTarget.layoutSlot?.role} content in "${replacementTarget.name}" with ${replacement.layoutSlot?.role}?`,
          signal,
          'Yes, Replace Content',
        );
        signal.throwIfAborted();
        if (!confirmed) return { success: false, revision: canvasRevisionRef.current, error: { code: 'USER_CANCELLED', message: 'The user cancelled or did not confirm slot replacement.' } };
        if (!uiLockedRef.current) {
          return { success: false, revision: canvasRevisionRef.current, error: { code: 'UI_NOT_LOCKED', message: 'The UI lock expired or was released while confirmation was open.' } };
        }
        if (expectedRevision !== undefined && expectedRevision !== canvasRevisionRef.current) {
          return { success: false, revision: canvasRevisionRef.current, error: { code: 'STALE_CANVAS', message: 'The canvas changed while confirmation was open.' } };
        }
      }
    }

    signal.throwIfAborted();
    if (expectedRevision !== undefined && expectedRevision !== canvasRevisionRef.current) {
      return { success: false, revision: canvasRevisionRef.current, error: { code: 'STALE_CANVAS', message: 'The canvas changed before the write could be committed.' } };
    }

    let nextElements = snapshot;
    let nextSelectedIds = selectedIdsRef.current;
    let canvasChanged = false;

    if (effects.pageToAdd) {
      setPages(previousPages => [...previousPages, []]);
      setCurrentPage(effects.pageToAdd.index);
      setSelectedIds([]);
    }

    if (effects.canvasConfigUpdates) {
      setCanvasConfig(current => parseCanvasConfig({
        ...current,
        ...effects.canvasConfigUpdates,
        _v: CANVAS_CONFIG_STORAGE_VERSION,
      }));
    }

    if (removalTarget) {
      nextElements = nextElements.filter(element => element.id !== removalTarget.id);
      nextSelectedIds = nextSelectedIds.filter(id => id !== removalTarget.id);
      canvasChanged = true;
    }

    if (effects.elementToAdd) {
      const offsetX = announce ? 0 : activeBoard?.x ?? 0;
      const offsetY = announce ? 0 : activeBoard?.y ?? 0;
      const element = {
        ...effects.elementToAdd,
        x: effects.elementToAdd.x + offsetX,
        y: effects.elementToAdd.y + offsetY,
      };
      nextElements = [...nextElements, element];
      nextSelectedIds = [element.id];
      canvasChanged = true;
    }

    if (effects.layoutElementsToAdd) {
      nextElements = [...nextElements, ...effects.layoutElementsToAdd];
      nextSelectedIds = effects.layoutElementsToAdd.map(element => element.id);
      canvasChanged = true;
    }

    if (effects.elementReplacement) {
      const replacement = effects.elementReplacement;
      nextElements = nextElements.map(element => element.id === replacement.id ? replacement : element);
      nextSelectedIds = [replacement.id];
      canvasChanged = true;
    }

    if (effects.diagramCode) {
      const size = { width: 500, height: 400 };
      const currentConfig = canvasConfigRef.current;
      const position = placeElementInCanvas({
        elements: nextElements,
        activeBoardId: activeBoardIdRef.current,
        fallback: {
          width: currentConfig.isFlipbook ? currentConfig.width * 2 : currentConfig.width,
          height: currentConfig.height,
        },
        size,
        avoidOverlap: true,
      });
      const diagram: CanvasElement = {
        id: crypto.randomUUID(),
        type: 'mindmap',
        name: effects.diagramType ? `AI ${effects.diagramType}` : 'AI Diagram',
        ...position,
        w: size.width,
        h: size.height,
        zIndex: getNextElementZIndex(nextElements),
        color: 'transparent',
        mermaidCode: effects.diagramCode,
      };
      nextElements = [...nextElements, diagram];
      nextSelectedIds = [diagram.id];
      canvasChanged = true;
    }

    if (canvasChanged) {
      setElements(nextElements);
      setSelectedIds(nextSelectedIds);
    }
    if (effects.uiLocked !== undefined) setIsUiLocked(effects.uiLocked);

    if (effects.pendingPlan) setPendingPlan(effects.pendingPlan);
    if (announce) addChatMessage('system', outcome.message, effects.pendingPlan, effects.imageSearchResults);

    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    return { success: true, revision: canvasRevisionRef.current };
  }, [
    activeBoard,
    addChatMessage,
    canvasRevisionRef,
    confirmationOpen,
    elementsRef,
    requestConfirmation,
    selectedIdsRef,
    setCanvasConfig,
    setCurrentPage,
    setElements,
    setIsUiLocked,
    setPendingPlan,
    setPages,
    setSelectedIds,
    uiLockedRef,
  ]);

  applyOutcomeRef.current = applyCanvasToolOutcome;

  useEffect(() => {
    const epoch = ++registrationEpochRef.current;
    const lifecycleController = new AbortController();
    const bridge = {
      getContext: () => ({
        elements: elementsRef.current,
        canvasConfig: canvasConfigRef.current,
        currentPage: currentPageRef.current,
        pageCount: pageCountRef.current,
        selectedIds: selectedIdsRef.current,
        activeBoardId: activeBoardIdRef.current,
        revision: canvasRevisionRef.current,
        uiLocked: uiLockedRef.current,
        requireUiLock: true,
      }),
      applyOutcome: (outcome: CanvasToolOutcome, signal: AbortSignal) => {
        const apply = applyOutcomeRef.current;
        if (!apply) {
          return Promise.resolve({
            success: false,
            revision: canvasRevisionRef.current,
            error: { code: 'EDITOR_NOT_READY', message: 'The editor is not ready.' },
          });
        }
        return apply(outcome, signal, true);
      },
    };

    void registerDesignTools(bridge, lifecycleController).catch(error => {
      if (epoch === registrationEpochRef.current) {
        console.error('[WebMCP] Tool registration failed.', error);
      }
    });

    return () => {
      registrationEpochRef.current += 1;
      lifecycleController.abort();
    };
  }, [
    activeBoardIdRef,
    canvasConfigRef,
    canvasRevisionRef,
    currentPageRef,
    elementsRef,
    pageCountRef,
    selectedIdsRef,
    uiLockedRef,
  ]);

  return { applyCanvasToolOutcome };
};
