import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

// GEMINI_API_KEY lives only here. Never mirror it into Vite or return it to the browser.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI features are not configured in this deployment.' });

  let body: Record<string, unknown>;
  try {
    body = req.body as Record<string, unknown>;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (!body || typeof body !== 'object' || typeof body.model !== 'string' || !body.model) {
    return res.status(400).json({ error: 'model is required' });
  }
  if (!body.contents) {
    return res.status(400).json({ error: 'contents is required' });
  }
  // Allowlist models so a public visitor cannot burn quota on expensive tiers.
  const ALLOWED_MODELS = new Set(['gemini-3-flash-preview', 'gemini-3-pro-preview']);
  if (!ALLOWED_MODELS.has(body.model)) {
    return res.status(400).json({ error: 'Model is not allowed.' });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: body.model,
      contents: body.contents as never,
      config: (body.config ?? {}) as never,
    });
    // Build the JSON explicitly: response.text is a prototype getter and would
    // be dropped by JSON.stringify of the raw SDK response object.
    return res.status(200).json({
      text: response.text ?? '',
      candidates: response.candidates ?? [],
    });
  } catch (error: any) {
    // Propagate rate limits so client retry logic can detect and back off.
    if (error?.status === 429 || error?.code === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
    }
    console.error('Gemini request failed:', error?.message || error);
    return res.status(502).json({ error: 'AI request failed' });
  }
}
