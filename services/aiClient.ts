type GeminiRequest = {
  model: string;
  contents: unknown;
  config?: Record<string, unknown>;
  signal?: AbortSignal;
};

export type GeminiResponse = {
  text?: string;
  candidates?: Array<{
    content?: { parts?: Array<Record<string, any>> };
    [key: string]: unknown;
  }>;
};

export const requestGemini = async (request: GeminiRequest): Promise<GeminiResponse> => {
  // Keep cancellation local to fetch; AbortSignal is never part of the server API payload.
  const signal = request.signal;
  const { abortSignal: _abortSignal, ...configWithoutSignal } = request.config || {};
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: request.model,
      contents: request.contents,
      ...(request.config ? { config: configWithoutSignal } : {}),
    }),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Missing function (static host / dev server) means AI is not configured here.
    if (response.status === 404 || response.status === 503) {
      throw new Error('AI features are not configured in this deployment.');
    }
    throw new Error(typeof data.error === 'string' ? data.error : 'AI request failed');
  }
  return data as GeminiResponse;
};

// Shared console etiquette for generation failure paths: a known unconfigured
// deployment is a warn with no stack; real failures stay loud errors.
export const logGenerationFailure = (service: string, lastError: unknown): void => {
  const message = lastError instanceof Error ? lastError.message : String(lastError ?? '');
  if (message.includes('not configured')) {
    console.warn(`[${service}] Generation unavailable:`, message);
  } else {
    console.error(`[${service}] All retries exhausted:`, message || lastError);
  }
};
