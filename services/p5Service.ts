import { GoogleGenAI, Type, Schema, FunctionDeclaration } from "@google/genai";
import { P5ModelProvider } from "../types";

const ai = typeof process !== 'undefined' && process.env.API_KEY
  ? new GoogleGenAI({ apiKey: process.env.API_KEY })
  : null;
const getClient = (): GoogleGenAI => {
  if (!ai) throw new Error('AI p5.js generation is not configured in this deployment.');
  return ai;
};

// ====================
// System Instructions
// ====================

const SYSTEM_INSTRUCTION = `You are an expert p5.js creative coder and educational animation specialist.
Your goal is to create ENGAGING, INTERACTIVE animations that help students understand concepts visually.

Guidelines:
1. Always create COMPLETE, RUNNABLE p5.js sketches with setup() and draw() functions.
2. Use VIBRANT colors and SMOOTH animations - make it visually appealing for students.
3. Add INTERACTIVITY where possible (mouse, keyboard input).
4. Include educational annotations using text() when explaining concepts.
5. Make animations that demonstrate PHYSICS, MATH, or COMPUTER SCIENCE concepts clearly.
6. Use modern p5.js syntax and best practices.
7. Keep performance in mind - avoid unnecessary computations in draw().

DO NOT:
- Include any HTML or script tags - ONLY pure p5.js JavaScript code
- Use external libraries beyond p5.js core
- Create overly complex animations that might lag`;

// =====================
// Utility Functions
// =====================

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRateLimitError = (error: any): boolean => {
  if (!error) return false;
  if (error.status === 429) return true;
  if (error.code === 429) return true;
  if (error.message?.includes('429')) return true;
  if (error.message?.includes('RESOURCE_EXHAUSTED')) return true;
  if (error.message?.includes('quota')) return true;
  return false;
};

// =====================
// Gemini Generation
// =====================

const generateWithGemini = async (
  userPrompt: string,
  maxRetries: number = 3
): Promise<string> => {
  const modelName = 'gemini-3-flash-preview';

  const prompt = `
Create a p5.js sketch for: "${userPrompt}"

Requirements:
1. Return ONLY valid p5.js JavaScript code - no markdown, no explanations.
2. Include setup() and draw() functions.
3. Use createCanvas(800, 600) or similar appropriate size.
4. Make it INTERACTIVE and EDUCATIONAL for students.
5. Use vibrant colors and smooth animations.
6. Add text labels or annotations to explain the concept.

Example structure:
function setup() {
  createCanvas(800, 600);
  // setup code
}

function draw() {
  background(20);
  // animation code
}

// interaction handlers if needed
function mousePressed() { }
function keyPressed() { }
  `;

  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[P5Service] Gemini attempt ${attempt + 1}/${maxRetries}`);

      const response = await getClient().models.generateContent({
        model: modelName,
        contents: { parts: [{ text: prompt }] },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "text/plain",
          // @ts-ignore
          thinkingConfig: {
            includeThoughts: true,
            thinkingLevel: "medium" as any
          }
        },
      });

      // Log thoughts if available
      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts) {
        const thoughtParts = candidate.content.parts
          .filter((p: any) => p.thought === true && p.text);

        if (thoughtParts.length > 0) {
          console.log("\n==================== GEMINI THOUGHTS ====================");
          thoughtParts.forEach((p: any) => {
            console.log(p.text);
          });
          console.log("=========================================================\n");
        }
      }

      const text = response.text;
      if (!text) throw new Error("Empty response from Gemini");

      // Clean up: remove markdown code blocks if present
      let cleaned = text.trim();
      if (cleaned.startsWith('```javascript')) {
        cleaned = cleaned.replace(/^```javascript\n?/, '').replace(/\n?```$/, '');
      } else if (cleaned.startsWith('```js')) {
        cleaned = cleaned.replace(/^```js\n?/, '').replace(/\n?```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      console.log(`[P5Service] Gemini success on attempt ${attempt + 1}`);
      return cleaned;

    } catch (error: any) {
      lastError = error;
      console.warn(`[P5Service] Gemini attempt ${attempt + 1} failed:`, error.message || error);

      if (isRateLimitError(error) && attempt < maxRetries - 1) {
        const waitTime = (attempt + 1) * 15000;
        console.log(`[P5Service] Rate limited, waiting ${waitTime / 1000}s...`);
        await delay(waitTime);
        continue;
      }
      break;
    }
  }

  console.error("[P5Service] Gemini retries exhausted:", lastError);
  throw lastError;
};

// =====================
// OpenRouter Generation
// =====================

const generateWithOpenRouter = async (
  userPrompt: string,
  maxRetries: number = 3
): Promise<string> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const prompt = `Create a p5.js sketch for: "${userPrompt}"

Requirements:
1. Return ONLY valid p5.js JavaScript code - no markdown, no explanations.
2. Include setup() and draw() functions.
3. Use createCanvas(800, 600) or similar appropriate size.
4. Make it INTERACTIVE and EDUCATIONAL for students.
5. Use vibrant colors and smooth animations.
6. Add text labels or annotations to explain the concept.`;

  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[P5Service] OpenRouter attempt ${attempt + 1}/${maxRetries}`);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'P5.js Animation Generator'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            { role: 'user', content: prompt }
          ],
          max_tokens: 4000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenRouter error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (!text) throw new Error("Empty response from OpenRouter");

      // Clean up markdown code blocks
      let cleaned = text.trim();
      if (cleaned.startsWith('```javascript')) {
        cleaned = cleaned.replace(/^```javascript\n?/, '').replace(/\n?```$/, '');
      } else if (cleaned.startsWith('```js')) {
        cleaned = cleaned.replace(/^```js\n?/, '').replace(/\n?```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      console.log(`[P5Service] OpenRouter success on attempt ${attempt + 1}`);
      return cleaned;

    } catch (error: any) {
      lastError = error;
      console.warn(`[P5Service] OpenRouter attempt ${attempt + 1} failed:`, error.message || error);

      if (isRateLimitError(error) && attempt < maxRetries - 1) {
        const waitTime = (attempt + 1) * 10000;
        console.log(`[P5Service] Rate limited, waiting ${waitTime / 1000}s...`);
        await delay(waitTime);
        continue;
      }
      break;
    }
  }

  console.error("[P5Service] OpenRouter retries exhausted:", lastError);
  throw lastError;
};

// =====================
// Main Export Functions
// =====================

/**
 * Generate p5.js code using the specified AI model provider
 */
export const generateP5Code = async (
  userPrompt: string,
  modelProvider: P5ModelProvider = 'gemini'
): Promise<string> => {
  console.log(`[P5Service] Generating with provider: ${modelProvider}`);

  if (modelProvider === 'openrouter') {
    return generateWithOpenRouter(userPrompt);
  }
  return generateWithGemini(userPrompt);
};

/**
 * Basic validation of p5.js code syntax
 */
export const validateP5Code = (code: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check for required functions
  if (!code.includes('function setup(')) {
    errors.push("Missing setup() function");
  }
  if (!code.includes('function draw(')) {
    errors.push("Missing draw() function");
  }
  if (!code.includes('createCanvas')) {
    errors.push("Missing createCanvas() call");
  }

  // Check for common syntax issues
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push("Unbalanced braces");
  }

  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push("Unbalanced parentheses");
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Tool calling interface for other AI to request p5.js generation
 * Returns a function declaration compatible with Gemini/OpenAI tool calling
 */
export const getP5GeneratorTool = (): FunctionDeclaration => {
  return {
    name: "generate_p5_animation",
    description: "Generate an interactive p5.js animation for educational purposes. Creates engaging visualizations for physics, math, computer science concepts.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description: "Description of the animation to create (e.g., 'bouncing ball simulation', 'sine wave visualization', 'sorting algorithm animation')"
        },
        modelProvider: {
          type: Type.STRING,
          description: "AI model to use for generation: 'gemini' for Gemini 3 Flash, 'openrouter' for OpenAI via OpenRouter",
          enum: ["gemini", "openrouter"]
        }
      },
      required: ["prompt"]
    }
  };
};

/**
 * Execute the p5 generator tool call (used by other AI systems)
 */
export const executeP5GeneratorTool = async (args: {
  prompt: string;
  modelProvider?: P5ModelProvider;
}): Promise<{ code: string; success: boolean; error?: string }> => {
  try {
    const code = await generateP5Code(args.prompt, args.modelProvider || 'gemini');
    const validation = validateP5Code(code);

    return {
      code,
      success: validation.valid,
      error: validation.valid ? undefined : validation.errors.join(', ')
    };
  } catch (error: any) {
    return {
      code: '',
      success: false,
      error: error.message || 'Failed to generate p5.js code'
    };
  }
};
