import { CanvasToolExecutionContext, CanvasToolOutcome, executeCanvasTool } from './canvasToolEngine';
import { CANVAS_TOOL_CATALOG, validateCanvasToolCatalog } from './canvasToolCatalog';

interface ToolExecuteOptions { signal?: AbortSignal }
interface PageModelContext {
  registerTool(
    tool: {
      name: string;
      title?: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
      execute: (input: Record<string, unknown>, options: ToolExecuteOptions) => Promise<unknown>;
    },
    options?: { signal?: AbortSignal },
  ): Promise<void>;
}

export interface CanvasToolApplyResult {
  success: boolean;
  revision: number;
  error?: { code: string; message: string };
}

export interface CanvasToolBridge {
  getContext(): CanvasToolExecutionContext;
  applyOutcome(outcome: CanvasToolOutcome, signal: AbortSignal): Promise<CanvasToolApplyResult>;
}

const getModelContext = (): PageModelContext | undefined => {
  const documentContext = (document as Document & { modelContext?: PageModelContext }).modelContext;
  const legacyContext = (navigator as Navigator & { modelContext?: PageModelContext }).modelContext;
  return documentContext ?? legacyContext;
};

const combineAbortSignals = (...signals: Array<AbortSignal | undefined>) => {
  const controller = new AbortController();
  const abort = (signal: AbortSignal) => controller.abort(signal.reason);
  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      abort(signal);
      break;
    }
    signal.addEventListener('abort', () => abort(signal), { once: true });
  }
  return controller.signal;
};

const fitOutputBudget = (result: Record<string, unknown>) => {
  if (JSON.stringify(result).length <= 1500) return result;
  const data = result.data && typeof result.data === 'object' ? { ...(result.data as Record<string, unknown>) } : undefined;
  if (data && Array.isArray(data.items)) {
    const items = [...data.items];
    while (items.length && JSON.stringify({ ...result, data: { ...data, items } }).length > 1500) items.pop();
    const nextOffset = typeof data.offset === 'number' ? data.offset + items.length : data.nextOffset;
    const bounded = { ...result, data: { ...data, items, truncated: true, nextOffset } };
    if (JSON.stringify(bounded).length <= 1500) return bounded;
  }
  return {
    success: result.success,
    tool: result.tool,
    message: String(result.message || '').slice(0, 500),
    data: { truncated: true, reason: 'Output exceeded the WebMCP response budget. Request a smaller page.' },
  };
};

export const registerDesignTools = async (bridge: CanvasToolBridge, lifecycleController: AbortController) => {
  const modelContext = getModelContext();
  if (!modelContext?.registerTool) return { registered: false, count: 0 };

  validateCanvasToolCatalog();
  let mutationQueue: Promise<void> = Promise.resolve();
  try {
    for (const entry of CANVAS_TOOL_CATALOG) {
      lifecycleController.signal.throwIfAborted();
      await modelContext.registerTool({
        name: entry.name,
        title: entry.title,
        description: entry.description,
        inputSchema: entry.inputSchema,
        annotations: entry.annotations,
        execute: async (input, { signal: executionSignal } = {}) => {
          const run = async () => {
            const signal = combineAbortSignals(executionSignal, lifecycleController.signal);
            signal.throwIfAborted();
            const outcome = await executeCanvasTool(entry.name, input, bridge.getContext(), signal);
            let committed = false;
            if (outcome.success && outcome.effects) {
              const applied = await bridge.applyOutcome(outcome, signal);
              if (!applied.success) {
                return fitOutputBudget({
                  success: false,
                  tool: entry.name,
                  message: applied.error?.message || 'The page could not apply the tool result.',
                  error: applied.error || { code: 'APPLY_FAILED', message: 'The page could not apply the tool result.' },
                });
              }
              outcome.data = { ...outcome.data, revision: applied.revision };
              committed = true;
            }
            if (!committed) signal.throwIfAborted();
            return fitOutputBudget({
              success: outcome.success,
              tool: outcome.tool,
              message: outcome.message,
              ...(outcome.data ? { data: outcome.data } : {}),
              ...(outcome.error ? { error: outcome.error } : {}),
            });
          };

          const serialize = !entry.annotations.readOnlyHint && !['set_ui_lock', 'search_internet_images'].includes(entry.name);
          if (!serialize) return run();
          const queued = mutationQueue.then(run, run);
          mutationQueue = queued.then(() => undefined, () => undefined);
          return queued;
        },
      }, { signal: lifecycleController.signal });
    }
  } catch (error) {
    lifecycleController.abort(error);
    throw error;
  }

  return { registered: true, count: CANVAS_TOOL_CATALOG.length };
};
