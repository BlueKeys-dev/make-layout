// Chat AI Service with Function Calling for Layout Generation

import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';
import { CanvasElement, CanvasConfig, ChatMessage, LayoutPlan, AIModelId } from '../types';
import { generateLayoutPlan } from './layout_maker';
import { getModelConfig } from './aiProviders';
import { CHAT_CANVAS_TOOLS, CanvasToolName, validateCanvasToolCatalog } from './canvasToolCatalog';
import { executeCanvasTool } from './canvasToolEngine';
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

validateCanvasToolCatalog();
const layoutFunctionDeclarations = CHAT_CANVAS_TOOLS.map(tool => ({
  name: tool.name,
  description: tool.description,
  parametersJsonSchema: tool.inputSchema,
}));

// System prompt - balanced for reliability
const CHAT_SYSTEM_PROMPT = `You are a Layout Design Assistant. Help users create and modify canvas layouts.

AVAILABLE TOOLS:
- add_element: Add text, shape, or image to canvas
- add_table: Create tables with headers and data cells
- add_math: Add mathematical formulas using LaTeX
- search_internet_images: Find images online
- generate_mind_map: Create mind map diagrams (legacy)
- generate_diagram: Create any Mermaid diagram (mindmap, flowchart, sequence, class, ER, piechart, requirement)
- remove_element: Remove elements from canvas
- generate_layout: Generate complete layout plans
- capture_canvas: Read a bounded semantic snapshot with the current revision

TOOL USAGE:

generate_diagram (for visualizations):
  Types:
  - mindmap: Concepts, brainstorming, hierarchy
  - flowchart: Processes, workflows, decision trees
  - sequenceDiagram: System interactions, timelines
  - classDiagram: Object relationships, coding structures
  - erDiagram: Database schemas, entity relationships
  - pieChart: Statistics, proportions (provide data)
  - requirementDiagram: Systems engineering specs

add_table (for schedules, comparisons, data):
  Required: name, x, y, width, height, rows, cols, headers[], data[][]
  Example: rows:4, cols:3, headers:["Day","Task","Time"], data:[["Mon","Meeting","9am"],...]
  For math in tables: Use LaTeX properly.

add_math (for equations, formulas):
  Required: name, x, y, width, height, formula
  formula: LaTeX string like "E=mc^2" or "\\int_0^1 x^2 dx"

add_element:
  elementType: "text", "shape", or "image"
  For shapes: include shapeType (rectangle, circle, star, heart, etc.)
  For images: include src URL

BEHAVIOR:
- Chat naturally for questions
- Use tools only when user requests canvas actions
- For every canvas write, pass the exact Current Canvas Context revision as expectedRevision
- For diagrams: Call generate_diagram when user asks to visualize/chart/graph/map something
- For tables: Call add_table immediately when user asks
- For math: Call add_math immediately when user asks
- For images: Search first, show options, wait for user selection`;

export interface ChatResponse {
  message: string;
  layoutPlan?: LayoutPlan;
  functionCalled?: string;
  expectedRevision?: number;
  requiresReview?: boolean;
  elementToAdd?: Partial<CanvasElement>;
  elementToRemove?: { id: string };
  removalReason?: string;
  imageSearchResults?: Array<{ id: string; url: string; thumbnail: string; alt: string; photographer: string; photographerUrl: string }>;
  mindMapCode?: string;
}

export const processChatMessage = async (
  userMessage: string,
  conversationHistory: ChatMessage[],
  currentElements: CanvasElement[],
  canvasConfig: CanvasConfig,
  currentRevision: number = 0,
  imageContext?: string,
  signal?: AbortSignal
): Promise<ChatResponse> => {
  
  // Extract Thought Signatures from history if present (stored in metadata usually, but here we might need to rely on the model managing it if we send full history of turns with function calls)
  // However, Gemini 3 requires strict return of thoughtSignature in tool use.
  // We need to verify if our ChatMessage type stores thoughtSignature.
  // If not, we should probably add it to the type definition, but for now we might lose context if we don't.
  // Given the scope, I will assume basic history passing. The SDK usually handles this if we use specialized chat methods, but we are using `generateContent` raw.
  
  // Refactoring to use `generateContent` statelessly means we manually construct history.
  // Ideally we should use `startChat` for automatic history management, but existing code uses one-off calls.
  
  const contents: any[] = conversationHistory.slice(-10).map(msg => {
     // NOTE: If we had stored thoughtSignature in msg, we would include it here.
     return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
     };
  });

  const parts: any[] = [{ text: userMessage }];

  if (imageContext) {
    const { mediaResolution } = getModelConfig('gemini-3.5-flash-preview', true);
    const mimeType = imageContext.startsWith('data:') 
        ? imageContext.substring(5, imageContext.indexOf(';')) 
        : "image/png";

    parts.push({
      inlineData: {
        mimeType,
        data: imageContext.split(',')[1] || imageContext,
      },
      mediaResolution: { level: mediaResolution }
    });
  }

  contents.push({
    role: 'user',
    parts
  });

  const { width, height } = {
    width: canvasConfig.width * (canvasConfig.isFlipbook ? 2 : 1),
    height: canvasConfig.height,
  };

  // Extract recent image search results from conversation history
  const recentSearchResults = conversationHistory
    .slice(-5) // Last 5 messages
    .reverse()
    .find(msg => msg.imageSearchResults && msg.imageSearchResults.length > 0)
    ?.imageSearchResults || [];

  const searchContext = recentSearchResults.length > 0
    ? `\n\nRecent Image Search Results:\n${recentSearchResults.map((img, i) => `${i + 1}. ${img.alt} - URL: ${img.url}`).join('\n')}`
    : '';

  const canvasContext = `
Current Canvas Context:
- Size: ${width}×${height}pt (${canvasConfig.presetName})
- Revision: ${currentRevision}
- Current Elements: ${currentElements.length} items${searchContext}
`;

  // Use Flash by default for chat, upgrade to Pro if images
  const modelName = imageContext ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

  // Determine thinking level based on model compatibility
  const { thinkingLevel, mediaResolution } = getModelConfig(modelName as AIModelId, !!imageContext);

  let attempt = 0;
  const maxRetries = 3;

  while (attempt < maxRetries) {
      try {
          if (signal?.aborted) throw new Error("Aborted");
          
          const generatePromise = ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction: `${CHAT_SYSTEM_PROMPT}\n\n${canvasContext}`,
              abortSignal: signal,
              tools: [
                { functionDeclarations: layoutFunctionDeclarations },
                // Removed googleSearch to save quota as user has search_internet_images tool
              ],
              toolConfig: {
                functionCallingConfig: {
                  mode: FunctionCallingConfigMode.AUTO,
                },
              },
              thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: 24576,
              },
            },
          });

          const response = await generatePromise;

          const candidate = response.candidates?.[0];
          const resParts = candidate?.content?.parts || [];
          const thoughtSignature = resParts.find(p => p.thoughtSignature)?.thoughtSignature;

          // Log thoughts if available
          const thoughtParts = resParts.filter((p: any) => p.thought === true && p.text);
          if (thoughtParts.length > 0) {
            console.log("\n==================== CHAT AI THOUGHTS ====================");
            thoughtParts.forEach((p: any) => {
              console.log(p.text);
            });
            console.log("==========================================================\n");
          }

          console.log('🤖 [CHAT AI RESPONSE]:', {
            model: modelName,
            candidateCount: response.candidates?.length,
            thinkingEnabled: true,
            thoughtsCount: thoughtParts.length,
            parts: resParts.map(p => ({
              hasText: !!p.text,
              hasFunctionCall: !!p.functionCall,
              functionName: p.functionCall?.name,
              hasThoughtSignature: !!p.thoughtSignature,
              isThought: !!(p as any).thought
            }))
          });

          // START TOOL EXECUTION LOOP (Simplified for single turn)
          for (const part of resParts) {
        if (part.functionCall) {
            const { name, args } = part.functionCall;
            
            console.log('🔧 [CHAT AI FUNCTION CALL]:', {
              functionName: name,
              args: args
            });

            const outcome = await executeCanvasTool(
              name as CanvasToolName,
              args,
              {
                elements: currentElements,
                canvasConfig,
                currentPage: 0,
                pageCount: 1,
                selectedIds: [],
                activeBoardId: null,
                revision: currentRevision,
                scale: 1,
                uiLocked: false,
                requireUiLock: false,
              },
              signal,
            );

            const effect = outcome.effects;
            const readMessage = outcome.data && ['capture_canvas', 'get_canvas_text', 'analyze_current_layout', 'suggest_improvements'].includes(name)
              ? `${outcome.message}\n\n${JSON.stringify(outcome.data, null, 2)}`
              : outcome.message;
            return {
              message: outcome.success ? readMessage : outcome.error?.message || outcome.message,
              functionCalled: name,
              expectedRevision: effect?.expectedRevision,
              layoutPlan: effect?.pendingPlan,
              requiresReview: Boolean(effect?.pendingPlan),
              elementToAdd: effect?.elementToAdd,
              elementToRemove: effect?.elementIdToRemove ? { id: effect.elementIdToRemove } : undefined,
              removalReason: effect?.removalReason,
              imageSearchResults: effect?.imageSearchResults,
              mindMapCode: effect?.diagramCode,
            };
        }

        // Text check moved to after function call check to prioritize tools
      }
      
      // Pass 2: Check for text if no tool was executed
      for (const part of resParts) {
        if (part.text) {
            const text = part.text.trim();
            if (text && text !== '{}') {
                console.log('💬 [CHAT AI TEXT RESPONSE]:', text);
                return { message: part.text };
            }
        }
      }

      return { message: "I'm not sure how to help with that." };

  } catch (error: any) {
      if (signal?.aborted || error?.name === 'AbortError') throw error;
      // Check for 429 (Too Many Requests)
      if (error.message?.includes('429') || error.status === 429 || error.message?.includes('limit')) {
          attempt++;
          console.warn(`Gemini API Rate Limit hit. Retrying (${attempt}/${maxRetries})...`);
          
          // Exponential backoff: 2s, 4s, 8s or use error details if available
          const match = error.message?.match(/retry in ([0-9.]+)s/);
          const waitTime = match ? parseFloat(match[1]) * 1000 : Math.pow(2, attempt) * 2000;
          
          if (attempt < maxRetries) {
               await new Promise(resolve => setTimeout(resolve, waitTime + 500)); // Add 500ms buffer
               continue;
          } else {
               return { message: "I'm currently overloaded with requests (Rate Limit). Please waiting a minute before talking to me again." };
          }
      }

      console.error("Chat error", error);
      return { message: "Sorry, I encountered an error. Please try again." };
  }
  } // End while loop

  return { message: "Sorry, I couldn't get a response." };
};

export const quickGenerateLayout = async (
  prompt: string,
  currentElements: CanvasElement[],
  canvasConfig: CanvasConfig,
  signal?: AbortSignal
): Promise<{ plan: LayoutPlan; message: string }> => {
  const { plan } = await generateLayoutPlan(
    currentElements,
    canvasConfig,
    prompt || 'Create a professional, balanced layout',
    undefined,
    undefined,
    signal,
  );
  return { plan, message: `Generated layout: **${plan.title}**` };
};
