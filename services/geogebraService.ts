import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `You are an expert in GeoGebra scripting and mathematical visualization. 
You create engaging, educational animations and interactive constructions using GeoGebra commands.
Your goal is to make visualizations that are clear, beautiful, and demonstrate mathematical concepts effectively.
Use proper GeoGebra command syntax that can be executed via ggbApplet.evalCommand().
Create animations that illustrate the topic dynamically - use sliders, traces, and animations where appropriate.`;

// Utility: Delay for exponential backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Utility: Check if error is a rate limit error
const isRateLimitError = (error: any): boolean => {
  if (!error) return false;
  if (error.status === 429) return true;
  if (error.code === 429) return true;
  if (error.message?.includes('429')) return true;
  if (error.message?.includes('RESOURCE_EXHAUSTED')) return true;
  if (error.message?.includes('quota')) return true;
  return false;
};

export const generateGeoGebraCode = async (
  userPrompt: string,
  appType: 'graphing' | 'geometry' | 'classic' = 'graphing',
  maxRetries: number = 3
): Promise<string> => {
  const modelName = 'gemini-3-flash-preview';

  const prompt = `
    Create a GeoGebra construction for: "${userPrompt}"
    Target app type: ${appType}
    
Requirements:
1. Return ONLY valid GeoGebra commands, one per line.
2. Each command must work with ggbApplet.evalCommand().
3. Create ANIMATED visualizations when possible.
4. Include comments as // Comment (they will be stripped).
5. DO NOT add markdown, backticks, or explanations—return ONLY raw GeoGebra commands.
6. Define variables BEFORE using them.

CORRECT GeoGebra Commands (use ONLY these):
- Points: A = (x, y)
- Lines: Line[A, B] or y = mx + c
- Segments: s = Segment[A, B]
- Circles: Circle[center, radius] or Circle[A, B, C]
- Polygons: Polygon[A, B, C, ...] or Polygon[A, B, n]
- Functions: f(x) = expression
- Sliders: a = Slider[min, max, increment, speed, width, isAngle, horizontal, animating, random] or a = Slider[0, 10, 0.1]
- Animation: StartAnimation[a]
- Colors: SetColor[obj, r, g, b] or SetColor[obj, "Red"]
- Visibility: ShowLabel[obj, true], SetVisibleInView[obj, 1, true]
- Trace: SetTrace[obj, true]
- Point Size: SetPointSize[obj, size]
- Line Thickness: SetLineThickness[obj, thickness]
  `;

  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[GeoGebraService] Attempt ${attempt + 1}/${maxRetries}`);

      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts: [{ text: prompt }] },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "text/plain",
          tools: [
            { googleSearch: {} }
          ],
          // @ts-ignore
          thinkingConfig: {
            includeThoughts: true,
            thinkingBudget: -1,
          },
        },
      });

      // Log thoughts if available
      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts) {
        const thoughtParts = candidate.content.parts
          .filter((p: any) => p.thought === true && p.text);
        
        if (thoughtParts.length > 0) {
          console.log("\n==================== GEOGEBRA AI THOUGHTS ====================");
          thoughtParts.forEach((p: any) => {
            console.log(p.text);
          });
          console.log("===============================================================\n");
        }
      }

      const text = response.text;
      if (!text) throw new Error("Empty response from AI");

      // Clean up: remove markdown code blocks if present
      let cleaned = text.trim();
      if (cleaned.startsWith('```geogebra')) {
        cleaned = cleaned.replace(/^```geogebra\n?/, '').replace(/\n?```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      // Remove comment-only lines and empty lines, keep commands
      const lines = cleaned.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'));

      const finalCode = lines.join('\n');
      
      console.log(`[GeoGebraService] Success on attempt ${attempt + 1}`);
      return finalCode;

    } catch (error: any) {
      lastError = error;
      console.warn(`[GeoGebraService] Attempt ${attempt + 1} failed:`, error.message || error);

      if (isRateLimitError(error) && attempt < maxRetries - 1) {
        // Exponential backoff: 15s, 30s, 45s...
        const waitTime = (attempt + 1) * 15000;
        console.log(`[GeoGebraService] Rate limited, waiting ${waitTime / 1000}s...`);
        await delay(waitTime);
        continue;
      }

      // If not a rate limit error or out of retries, throw
      break;
    }
  }

  console.error("[GeoGebraService] All retries exhausted:", lastError);
  throw lastError;
};

// Validate GeoGebra commands syntax (basic check)
export const validateGeoGebraCode = (code: string): { valid: boolean; errors: string[] } => {
  const lines = code.split('\n').filter(line => line.trim());
  const errors: string[] = [];

  // Basic syntax checks
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Skip comments
    if (trimmed.startsWith('//')) return;
    
    // Check for common issues
    if (trimmed.includes('undefined')) {
      errors.push(`Line ${index + 1}: Contains 'undefined'`);
    }
    
    // Check balanced parentheses
    const openParens = (trimmed.match(/\(/g) || []).length;
    const closeParens = (trimmed.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push(`Line ${index + 1}: Unbalanced parentheses`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};
