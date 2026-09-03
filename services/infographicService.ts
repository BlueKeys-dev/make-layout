import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = typeof process !== 'undefined' && process.env.API_KEY
  ? new GoogleGenAI({ apiKey: process.env.API_KEY })
  : null;
const getClient = (): GoogleGenAI => {
  if (!ai) throw new Error('AI infographic generation is not configured in this deployment.');
  return ai;
};

const GEMINI_MODEL = 'gemini-3-flash-preview';

/**
 * AI Configuration including thinking levels and search tools.
 * 'as const' is used to satisfy TypeScript literal type requirements.
 */
const configBase = {
  thinkingConfig: {
    thinkingLevel: ThinkingLevel.MEDIUM,
    includeThoughts: true,
  },
};

export interface InfographicResponse {
  html: string;
  css: string;
  success: boolean;
  error?: string;
}

/**
 * Attachment type for multimodal inputs.
 */
export interface Attachment {
  type: 'image' | 'pdf' | 'link' | 'text';
  data: string; // base64 for images, text content for text/link, file URI for pdf
  mimeType?: string;
  name?: string;
}

const SYSTEM_INSTRUCTION = `You are a creative Teacher how thinks how student thinks. like other teachers use slides - you use web-pages.
Your goal is to create visually stunning, engaging, and interactive web pages based on user prompts.
The output must be a seamless blend of modern HTML5 and vanilla CSS. help the student to understand and learn.
strictly monochromatic color palette. The background must use only black and white tones. Do not use purple, violet, blue, or any similar blue-based shades under any circumstances. Ensure all design elements (backgrounds, accents, typography, and UI components) adhere to these color restrictions.
**UI/UX BEAUTY CONSTRAINTS:**
1.  **Generous Whitespace**: Use ample padding (min 2rem/32px) and gaps. Avoid cramped layouts.
2.  **Modern Typography**: Use 'Inter', 'Roboto', or 'Outfit'. High contrast for readability.
3.  **Rounded Aesthetics**: Use rounded corners (border-radius: 12px to 24px) for all cards and containers.
4.  **Glassmorphism**: Use subtle semi-transparent backgrounds with backdrop-filter: blur().
5.  **Depth**: Use subtle, multi-layered shadows (box-shadow) to create depth. No flat, harsh borders.
6.  **Responsiveness**: Design must be fully responsive (Flexbox/Grid).
7.  **No External JS**: Use CSS animations for interaction. Vanilla JS only if absolutely necessary for logic.

donot create welcome pag and unessery. go deep dive to topic core. use table , charts , visuals , graphs,etc enchnace students learning.
add animation in diagrams , visuals.

**Output Requirements:**
- Return ONLY the raw HTML code with embedded CSS.
- Ensure the design is centered and visually balanced.
- Use the allowed colors to create a "Premium Dark Mode" aesthetic.
`;

/**
 * Generates a full infographic HTML page.
 */
export const generateInfographic = async (
  prompt: string,
  topic: 'infographics' | 'simulation' | 'play' = 'infographics',
  customSystemPrompt?: string,
  enableGoogleSearch: boolean = false
): Promise<InfographicResponse> => {
  try {
    console.log(`[InfographicService] Generating ${topic} with ${GEMINI_MODEL}`);

    const finalSystemPrompt = customSystemPrompt || SYSTEM_INSTRUCTION;
    const userMessage = `Create a "${topic}" web page about: ${prompt}.
Make it visually impressive and modern.
Return ONLY valid HTML code.`;

    const tools: any[] = [];
    if (enableGoogleSearch) {
      tools.push({ googleSearch: {} });
    }

    const response = await getClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: { parts: [{ text: userMessage }] },
      config: {
        ...configBase,
        tools: tools.length > 0 ? tools : undefined,
        systemInstruction: finalSystemPrompt,
        responseMimeType: "text/plain",
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");

    // Clean up markdown code blocks if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```html')) {
        cleaned = cleaned.replace(/^```html\n?/, '').replace(/\n?```$/, '');
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    return {
      html: cleaned,
      css: '', // CSS is embedded in HTML
      success: true
    };

  } catch (error: any) {
    console.error("[InfographicService] Generation failed:", error);
    return {
      html: '',
      css: '',
      success: false,
      error: error.message || "Failed to generate infographic"
    };
  }
};

/**
 * Streaming version of generateInfographic with multimodal support.
 */
export async function* generateInfographicStream(
  prompt: string,
  topic: 'infographics' | 'simulation' | 'play' = 'infographics',
  customSystemPrompt?: string,
  attachments: Attachment[] = [],
  enableGoogleSearch: boolean = false
): AsyncGenerator<string, void, unknown> {
  console.log(`[InfographicService] Streaming ${topic} with ${GEMINI_MODEL}, attachments: ${attachments.length}`);

  const finalSystemPrompt = customSystemPrompt || SYSTEM_INSTRUCTION;
  const parts: any[] = [];

  for (const attachment of attachments) {
    if (attachment.type === 'image' && attachment.data) {
      parts.push({
        inlineData: {
          mimeType: attachment.mimeType || 'image/png',
          data: attachment.data
        }
      });
    } else if (attachment.type === 'text' || attachment.type === 'link') {
      parts.push({ text: `[Attached ${attachment.type}: ${attachment.name || 'content'}]\n${attachment.data}\n` });
    }
  }

  const userMessage = `Create a "${topic}" web page about: ${prompt}.
Make it visually impressive and modern.
Return ONLY valid HTML code.`;
  parts.push({ text: userMessage });

  const tools: any[] = [];

  if (enableGoogleSearch) {
    tools.push({ googleSearch: {} });
  }

  // Extract links for urlContext
  const attachedLinks = attachments
    .filter(a => a.type === 'link')
    .map(a => a.data);

  if (attachedLinks.length > 0) {
      // @ts-ignore
      tools.push({ urlContext: {} });
  }

  try {
    const response = await getClient().models.generateContentStream({
      model: GEMINI_MODEL,
      contents: { parts },
      config: {
        ...configBase,
        tools: tools.length > 0 ? tools : undefined,
        systemInstruction: finalSystemPrompt,
        responseMimeType: "text/plain",
      },
    });

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) {
        yield text;
      }
    }
  } catch (error: any) {
    console.error("[InfographicService] Streaming failed:", error);
    throw error;
  }
}