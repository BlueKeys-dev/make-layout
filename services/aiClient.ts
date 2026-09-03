type GeminiRequest = {
  model: string;
  contents: unknown;
  config?: Record<string, unknown>;
};

export type GeminiResponse = {
  text?: string;
  candidates?: Array<{
    content?: { parts?: Array<Record<string, any>> };
    [key: string]: unknown;
  }>;
};

export const requestGemini = async (request: GeminiRequest, signal?: AbortSignal): Promise<GeminiResponse> => {
  // Keep cancellation local to fetch; AbortSignal is not part of the server API payload.
  const { abortSignal: _abortSignal, ...configWithoutSignal } = request.config || {};
  const requestBody = {
    ...request,
    ...(request.config ? { config: configWithoutSignal } : {}),
  };
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'AI request failed');
  return data as GeminiResponse;
};
