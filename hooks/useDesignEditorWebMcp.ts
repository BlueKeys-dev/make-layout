import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CanvasConfig, CanvasElement, ChatMessage, LayoutPlan } from '../types';
import type { CanvasToolOutcome } from '../services/canvasToolEngine';
import { registerDesignTools } from '../services/webmcp';
import type { CanvasToolApplyResult } from '../services/webmcp';
import type { SetCanvasElements } from './useCanvasPages';

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
  scaleRef: CurrentRef<number>;
  viewPosRef: CurrentRef<{ x: number; y: number }>;
  activeBoard: CanvasElement | null;
  confirmationOpen: boolean;
  requestConfirmation: ConfirmationRequest;
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
  scaleRef,
  viewPosRef,
  activeBoard,
  confirmationOpen,
  requestConfirmation,
  setElements,
  setSelectedIds,
  setIsUiLocked,
  setPendingPlan,
  addChatMessage,
}: UseDesignEditorWebMcpOptions) => {
  const registrationEpochRef = useRef(0);
  const applyOutcomeRef = useRef<(
    outcome: CanvasToolOutcome,
    signal: AbortSignal,
    announce: boolean,
  ) => Promise<CanvasToolApplyResult>>();

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

    if (effects.uiLocked !== undefined) setIsUiLocked(effects.uiLocked);

    if (effects.elementIdToRemove) {
      if (confirmationOpen) {
        return { success: false, revision: canvasRevisionRef.current, error: { code: 'CONFIRMATION_BUSY', message: 'Another confirmation is already open.' } };
      }
      const target = elementsRef.current.find(element => element.id === effects.elementIdToRemove);
      if (!target) return { success: false, revision: canvasRevisionRef.current, error: { code: 'ELEMENT_NOT_FOUND', message: 'The element no longer exists.' } };
      const reason = effects.removalReason ? ` Reason: ${effects.removalReason}` : '';
      const confirmed = await requestConfirmation(`Remove "${target.name}" from the canvas?${reason}`, signal);
      signal.throwIfAborted();
      if (!confirmed) return { success: false, revision: canvasRevisionRef.current, error: { code: 'USER_CANCELLED', message: 'The user cancelled or did not confirm removal.' } };
      if (announce && !uiLockedRef.current) {
        return { success: false, revision: canvasRevisionRef.current, error: { code: 'UI_NOT_LOCKED', message: 'The UI lock expired or was released while confirmation was open.' } };
      }
      if (expectedRevision !== canvasRevisionRef.current) {
        return { success: false, revision: canvasRevisionRef.current, error: { code: 'STALE_CANVAS', message: 'The canvas changed while confirmation was open.' } };
      }
      setElements(previous => previous.filter(element => element.id !== target.id));
      setSelectedIds(selectedIdsRef.current.filter(id => id !== target.id));
    }

    if (effects.elementToAdd) {
      const offsetX = announce ? 0 : activeBoard?.x ?? 0;
      const offsetY = announce ? 0 : activeBoard?.y ?? 0;
      const element = {
        ...effects.elementToAdd,
        x: effects.elementToAdd.x + offsetX,
        y: effects.elementToAdd.y + offsetY,
      };
      setElements(previous => [...previous, element]);
      setSelectedIds([element.id]);
    }

    if (effects.layoutElementsToAdd) {
      setElements(previous => [...previous, ...effects.layoutElementsToAdd!]);
      setSelectedIds(effects.layoutElementsToAdd.map(element => element.id));
    }

    if (effects.elementReplacement) {
      const replacement = effects.elementReplacement;
      const currentElement = elementsRef.current.find(element => element.id === replacement.id);
      if (!currentElement) {
        return { success: false, revision: canvasRevisionRef.current, error: { code: 'ELEMENT_NOT_FOUND', message: 'The layout slot no longer exists.' } };
      }
      const replacesFilledSlot = announce
        && currentElement.layoutSlot?.role !== null
        && currentElement.layoutSlot?.role !== replacement.layoutSlot?.role;
      if (replacesFilledSlot) {
        if (confirmationOpen) {
          return { success: false, revision: canvasRevisionRef.current, error: { code: 'CONFIRMATION_BUSY', message: 'Another confirmation is already open.' } };
        }
        const confirmed = await requestConfirmation(
          `Replace the current ${currentElement.layoutSlot?.role} content in "${currentElement.name}" with ${replacement.layoutSlot?.role}?`,
          signal,
          'Yes, Replace Content',
        );
        signal.throwIfAborted();
        if (!confirmed) return { success: false, revision: canvasRevisionRef.current, error: { code: 'USER_CANCELLED', message: 'The user cancelled or did not confirm slot replacement.' } };
        if (!uiLockedRef.current) {
          return { success: false, revision: canvasRevisionRef.current, error: { code: 'UI_NOT_LOCKED', message: 'The UI lock expired or was released while confirmation was open.' } };
        }
        if (expectedRevision !== canvasRevisionRef.current) {
          return { success: false, revision: canvasRevisionRef.current, error: { code: 'STALE_CANVAS', message: 'The canvas changed while confirmation was open.' } };
        }
      }
      setElements(previous => previous.map(element => element.id === replacement.id ? replacement : element));
      setSelectedIds([replacement.id]);
    }

    if (effects.diagramCode) {
      const centerX = -viewPosRef.current.x + (window.innerWidth / 2) / scaleRef.current;
      const centerY = -viewPosRef.current.y + (window.innerHeight / 2) / scaleRef.current;
      const diagram: CanvasElement = {
        id: crypto.randomUUID(),
        type: 'mindmap',
        name: effects.diagramType ? `AI ${effects.diagramType}` : 'AI Diagram',
        x: centerX - 250,
        y: centerY - 200,
        w: 500,
        h: 400,
        zIndex: elementsRef.current.reduce((maximum, element) => Math.max(maximum, element.zIndex), 0) + 1,
        color: 'transparent',
        mermaidCode: effects.diagramCode,
      };
      setElements(previous => [...previous, diagram]);
      setSelectedIds([diagram.id]);
    }

    if (effects.pendingPlan) setPendingPlan(effects.pendingPlan);
    if (announce) addChatMessage('system', outcome.message, effects.pendingPlan, effects.imageSearchResults);

    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      const frame = requestAnimationFrame(() => {
        signal.removeEventListener('abort', handleAbort);
        resolve();
      });
      const handleAbort = () => {
        cancelAnimationFrame(frame);
        reject(signal.reason);
      };
      signal.addEventListener('abort', handleAbort, { once: true });
    });

    return { success: true, revision: canvasRevisionRef.current };
  }, [
    activeBoard,
    addChatMessage,
    canvasRevisionRef,
    confirmationOpen,
    elementsRef,
    requestConfirmation,
    scaleRef,
    selectedIdsRef,
    setElements,
    setIsUiLocked,
    setPendingPlan,
    setSelectedIds,
    uiLockedRef,
    viewPosRef,
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
