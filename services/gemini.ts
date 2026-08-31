import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CanvasElement, CanvasConfig } from "../types";
import { getEffectiveDimensions, getSafeZones } from "../config/canvasDefaults";
import { getModelConfig } from "./aiProviders";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the response schema for the layout
const layoutSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    elements: {
      type: Type.ARRAY,
      description: "List of all elements for the page layout.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["text", "image", "shape", "path"] },
          name: { type: Type.STRING },
          x: { type: Type.NUMBER },
          y: { type: Type.NUMBER },
          w: { type: Type.NUMBER },
          h: { type: Type.NUMBER },
          zIndex: { type: Type.INTEGER },
          content: { type: Type.STRING },
          textStyle: {
            type: Type.OBJECT,
            properties: {
              fontSize: { type: Type.NUMBER },
              fontWeight: { type: Type.STRING },
              fontStyle: { type: Type.STRING },
              textAlign: { type: Type.STRING },
              color: { type: Type.STRING },
              lineHeight: { type: Type.NUMBER }
            }
          },
          src: { type: Type.STRING },
          color: { type: Type.STRING }
        },
        required: ["id", "type", "x", "y", "w", "h"],
      },
    },
    reasoning: {
      type: Type.STRING,
      description: "Brief explanation of the design choices made.",
    }
  },
  required: ["elements"],
};

const getCanvasContextInstruction = (config: CanvasConfig) => {
  const { width, height } = getEffectiveDimensions(config);
  const safeZones = getSafeZones(config);
  
  return `
    CANVAS CONTEXT:
    - Dimensions: ${width}x${height} points.
    - Mode: ${config.isFlipbook ? 'FLIPBOOK (Spread)' : config.mode.toUpperCase()}.
    - Safe Zones: ${JSON.stringify(safeZones)}
    - Coordinate System: Top-left of TRIM is (0,0).
  `;
};

export const generateLayout = async (
  currentElements: CanvasElement[],
  config: CanvasConfig,
  userPrompt: string = ""
): Promise<{ elements: CanvasElement[]; reasoning?: string }> => {
  try {
    const imagesToAnalyze = currentElements.filter(el => el.type === 'image' && el.src);
    const hasImages = imagesToAnalyze.length > 0;
    const modelName = hasImages ? "gemini-3-pro-preview" : "gemini-3-flash-preview";
    
    // Get config for Gemini 3
    const { mediaResolution, thinkingLevel } = getModelConfig(modelName as any, hasImages);

    const parts: any[] = [];

    // Add Images
    imagesToAnalyze.forEach(img => {
        if (img.src && img.src.startsWith('data:')) {
            const [metadata, base64] = img.src.split(',');
            const mimeType = metadata.match(/:(.*?);/)?.[1] || 'image/png';
            
            parts.push({
                inlineData: {
                    data: base64,
                    mimeType: mimeType
                },
                mediaResolution: {
                    level: mediaResolution
                }
            });
            parts.push({ text: `Image ID ${img.id} context.` });
        }
    });

    const elementDescriptors = currentElements.map((el) => ({
      id: el.id,
      type: el.type,
      name: el.name,
      dimensions: { w: el.w, h: el.h },
      position: { x: el.x, y: el.y },
    }));

    const fullSystemPrompt = `
      ${getCanvasContextInstruction(config)}
      
      TASK: Create a professional layout based on: "${userPrompt || "Optimize layout"}"
      
      EXISTING ELEMENTS:
      ${JSON.stringify(elementDescriptors, null, 2)}
      
      Return a JSON object with 'elements' and 'reasoning'.
    `;

    parts.push({ text: fullSystemPrompt });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: layoutSchema,
        thinkingConfig: {
            thinkingLevel: thinkingLevel as any
        }
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI.");

    let cleanText = text.trim().replace(/```json/g, "").replace(/```/g, "");
    
    try {
        return JSON.parse(cleanText);
    } catch (e) {
        // Fallback for partial json
        const first = cleanText.indexOf('{');
        const last = cleanText.lastIndexOf('}');
        if (first > -1 && last > first) {
            return JSON.parse(cleanText.substring(first, last + 1));
        }
        throw e;
    }
  } catch (error) {
    console.error("Layout generation failed:", error);
    throw error;
  }
};