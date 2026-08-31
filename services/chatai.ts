// Chat AI Service with Function Calling for Layout Generation

import { GoogleGenAI, FunctionCallingConfigMode, Type, ThinkingLevel } from '@google/genai';
import { CanvasElement, CanvasConfig, ChatMessage, LayoutPlan, AIModelId } from '../types';
import { DiagramType, DIAGRAM_CONFIGS } from '../types/diagramTypes';
import { generateLayoutPlan, validateLayout } from './layout_maker';
import { getModelConfig } from './aiProviders';
import { searchImages } from './imageService';
import { generateMindMapCode } from './mindMapService';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const layoutFunctionDeclarations = [
  { name: 'get_canvas_text', description: 'Read all text content from canvas.', parameters: { type: Type.OBJECT, properties: {} } },
  { name: 'capture_canvas_screenshot', description: 'Capture canvas screenshot for visual analysis.', parameters: { type: Type.OBJECT, properties: {} } },
  { name: 'search_internet_images', description: 'Search internet for images.', parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ['query'] } },
  {
    name: 'add_element',
    description: 'Add element to canvas. Use shapeType for shapes (rectangle,circle,star,hexagon,heart,etc). Use custom_polygon with vertices for custom shapes.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        elementType: { type: Type.STRING, enum: ['text', 'shape', 'image'] },
        shapeType: { type: Type.STRING },
        vertices: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } }, required: ['x', 'y'] } },
        name: { type: Type.STRING },
        x: { type: Type.NUMBER }, y: { type: Type.NUMBER },
        width: { type: Type.NUMBER }, height: { type: Type.NUMBER },
        content: { type: Type.STRING },
        src: { type: Type.STRING },
        color: { type: Type.STRING },
      },
      required: ['elementType', 'name', 'x', 'y', 'width', 'height'],
    },
  },
  {
    name: 'add_table',
    description: 'Add a table to the canvas. USE THIS when user asks for: table, schedule, timetable, comparison, list, grid, data, pricing table, specs. Provide headers array and data as 2D array.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Descriptive name like "weekly_schedule" or "comparison_table"' },
        x: { type: Type.NUMBER, description: 'X position, default 50' }, 
        y: { type: Type.NUMBER, description: 'Y position, default 50' },
        width: { type: Type.NUMBER, description: 'Table width, default 400' }, 
        height: { type: Type.NUMBER, description: 'Table height, default 250' },
        rows: { type: Type.NUMBER, description: 'Total rows including header row' },
        cols: { type: Type.NUMBER, description: 'Number of columns' },
        headers: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Column headers like ["Name","Price","Status"]' },
        data: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } }, description: 'Row data as 2D array: [["Row1Col1","Row1Col2"],["Row2Col1","Row2Col2"]]' },
      },
      required: ['name', 'x', 'y', 'width', 'height', 'rows', 'cols', 'headers', 'data'],
    },
  },
  {
    name: 'add_math',
    description: 'Add a math formula using LaTeX/KaTeX. USE THIS when user asks for: formula, equation, math, expression, calculate, mathematical notation. Common: \\frac{}{}, \\sqrt{}, \\sum, \\int, x^2, x_n, \\alpha, \\pi',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Descriptive name like "quadratic_formula" or "pythagorean_theorem"' },
        x: { type: Type.NUMBER, description: 'X position, default 50' }, 
        y: { type: Type.NUMBER, description: 'Y position, default 50' },
        width: { type: Type.NUMBER, description: 'Width, default 300' }, 
        height: { type: Type.NUMBER, description: 'Height, default 80' },
        formula: { type: Type.STRING, description: 'LaTeX string. Examples: "E=mc^2", "\\\\frac{-b \\\\pm \\\\sqrt{b^2-4ac}}{2a}", "\\\\int_0^\\\\infty e^{-x^2}dx", "\\\\sum_{i=1}^n i = \\\\frac{n(n+1)}{2}"' },
        fontSize: { type: Type.NUMBER, description: 'Font size in pixels, default 18' },
      },
      required: ['name', 'x', 'y', 'width', 'height', 'formula'],
    },
  },
  { name: 'remove_element', description: 'Remove element from canvas.', parameters: { type: Type.OBJECT, properties: { elementName: { type: Type.STRING }, reason: { type: Type.STRING } }, required: ['elementName'] } },
  { name: 'generate_layout', description: 'Generate layout plan from requirements.', parameters: { type: Type.OBJECT, properties: { layoutDescription: { type: Type.STRING }, layoutStyle: { type: Type.STRING }, primaryElement: { type: Type.STRING }, elementCount: { type: Type.NUMBER } }, required: ['layoutDescription', 'layoutStyle'] } },
  { name: 'analyze_current_layout', description: 'Analyze canvas for issues.', parameters: { type: Type.OBJECT, properties: { focusArea: { type: Type.STRING, enum: ['overlaps', 'spacing', 'balance', 'readability', 'all'] } }, required: ['focusArea'] } },
  { name: 'suggest_improvements', description: 'Suggest layout improvements.', parameters: { type: Type.OBJECT, properties: { improvementType: { type: Type.STRING, enum: ['spacing', 'alignment', 'hierarchy', 'balance', 'typography'] } }, required: ['improvementType'] } },
  { name: 'generate_mind_map', description: 'Generate mind map diagram for topic. DEPRECATED: Use generate_diagram instead.', parameters: { type: Type.OBJECT, properties: { topic: { type: Type.STRING } }, required: ['topic'] } },
  {
    name: 'generate_diagram',
    description: 'Generate Mermaid diagrams. Types: mindmap (concepts), flowchart (processes), sequenceDiagram (interactions), classDiagram (OOP), erDiagram (database), pie (data), requirementDiagram (specs). Use "auto" to let AI choose.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: 'What to visualize' },
        diagramType: { type: Type.STRING, enum: ['mindmap', 'flowchart', 'sequenceDiagram', 'classDiagram', 'erDiagram', 'pie', 'requirementDiagram', 'auto'], description: 'Diagram type. Use auto to let AI pick.' },
      },
      required: ['prompt', 'diagramType'],
    },
  },
];

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
- For diagrams: Call generate_diagram when user asks to visualize/chart/graph/map something
- For tables: Call add_table immediately when user asks
- For math: Call add_math immediately when user asks
- For images: Search first, show options, wait for user selection`;

export interface ChatResponse {
  message: string;
  layoutPlan?: LayoutPlan;
  functionCalled?: string;
  requiresReview?: boolean;
  canvasText?: string;
  canvasScreenshot?: string;
  elementToAdd?: Partial<CanvasElement>;
  elementToRemove?: { name: string; moveToWorkflow: boolean };
  imageSearchResults?: Array<{ id: string; url: string; thumbnail: string; alt: string; photographer: string }>;
  mindMapCode?: string;
}

export const processChatMessage = async (
  userMessage: string,
  conversationHistory: ChatMessage[],
  currentElements: CanvasElement[],
  canvasConfig: CanvasConfig,
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
    const { mediaResolution } = getModelConfig('gemini-3-flash-preview', true);
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

          let response;
          if (signal) {
              const abortPromise = new Promise<never>((_, reject) => {
                  const onAbort = () => {
                      signal.removeEventListener('abort', onAbort);
                      reject(new Error("Aborted"));
                  };
                  signal.addEventListener('abort', onAbort);
              });
              response = await Promise.race([generatePromise, abortPromise]);
          } else {
              response = await generatePromise;
          }

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
            
            // NOTE: If we were doing multi-step, we'd need to send back the thoughtSignature here.
            
            if (name === 'capture_canvas_screenshot') {
                return {
                    message: "I'll take a look...",
                    functionCalled: 'capture_canvas_screenshot',
                    canvasScreenshot: 'REQUEST_SCREENSHOT'
                };
            }
            
            if (name === 'add_element') {
                const elementArgs = args as any;
                const shapeType = elementArgs.shapeType || 'rectangle';
                const isCustomPolygon = shapeType === 'custom_polygon' && elementArgs.vertices;
                
                // Log shape_auto_added action for AI-created shapes
                console.log(JSON.stringify({ 
                    action: 'shape_auto_added', 
                    shapeType,
                    vertices: isCustomPolygon ? elementArgs.vertices : null,
                    polygon_closed: isCustomPolygon,
                    message: `Shape "${shapeType}" added by AI at (${elementArgs.x}, ${elementArgs.y})`
                }));

                return {
                    message: `Added ${elementArgs.name} (${shapeType})`,
                    functionCalled: 'add_element',
                    elementToAdd: {
                         id: crypto.randomUUID(), 
                         ...elementArgs,
                         type: elementArgs.elementType || elementArgs.type || 'shape',
                         shapeType: elementArgs.elementType === 'shape' ? shapeType : undefined,
                         points: isCustomPolygon ? elementArgs.vertices : undefined,
                         w: elementArgs.width || elementArgs.w || 100,
                         h: elementArgs.height || elementArgs.h || 100,
                         content: elementArgs.content || (elementArgs.elementType === 'text' ? 'New Text' : undefined),
                         color: elementArgs.color || '#e2e8f0', 
                         zIndex: currentElements.length + 1 
                    }
                };
            }

            if (name === 'remove_element') {
                return {
                    message: `Removed ${args.elementName}`,
                    functionCalled: 'remove_element',
                    elementToRemove: { name: args.elementName as string, moveToWorkflow: true }
                };
            }

            // Table creation handler
            if (name === 'add_table') {
                const tableArgs = args as any;
                console.log(JSON.stringify({ 
                    action: 'table_auto_added', 
                    rows: tableArgs.rows,
                    cols: tableArgs.cols,
                    message: `Table "${tableArgs.name}" added by AI at (${tableArgs.x}, ${tableArgs.y})`
                }));

                return {
                    message: `Added table "${tableArgs.name}" (${tableArgs.rows}×${tableArgs.cols})`,
                    functionCalled: 'add_table',
                    elementToAdd: {
                        id: crypto.randomUUID(),
                        type: 'table',
                        name: tableArgs.name,
                        x: tableArgs.x,
                        y: tableArgs.y,
                        w: tableArgs.width || 300,
                        h: tableArgs.height || 200,
                        color: '#ffffff',
                        zIndex: currentElements.length + 1,
                        tableData: {
                            rows: tableArgs.rows,
                            cols: tableArgs.cols,
                            headers: tableArgs.headers || Array(tableArgs.cols).fill('Header'),
                            data: tableArgs.data || Array(tableArgs.rows - 1).fill(Array(tableArgs.cols).fill(''))
                        }
                    }
                };
            }

            // Math formula handler
            if (name === 'add_math') {
                const mathArgs = args as any;
                console.log(JSON.stringify({ 
                    action: 'math_auto_added', 
                    formula: mathArgs.formula,
                    message: `Math formula "${mathArgs.name}" added by AI at (${mathArgs.x}, ${mathArgs.y})`
                }));

                return {
                    message: `Added math formula "${mathArgs.name}"`,
                    functionCalled: 'add_math',
                    elementToAdd: {
                        id: crypto.randomUUID(),
                        type: 'math',
                        name: mathArgs.name,
                        x: mathArgs.x,
                        y: mathArgs.y,
                        w: mathArgs.width || 200,
                        h: mathArgs.height || 80,
                        color: 'transparent',
                        content: mathArgs.formula,
                        textStyle: mathArgs.fontSize ? { fontSize: mathArgs.fontSize } : undefined,
                        zIndex: currentElements.length + 1,
                    }
                };
            }

            // Logic for layout generation via layout_maker (existing import)
           if (name === 'generate_layout') {
                 // ... delegate to layout_maker (omitted for brevity, assume similar to previous)
                 // Re-using previous logic:
                 const { plan } = await generateLayoutPlan(currentElements, canvasConfig, (args as any).layoutDescription, imageContext);
                 return {
                     message: "Generated layout.",
                     layoutPlan: plan,
                     functionCalled: 'generate_layout',
                     requiresReview: true
                 };
            }

            if (name === 'search_internet_images') {
                const results = await searchImages((args as any).query);
                if (results.length === 0) {
                    return { message: `No images found for "${(args as any).query}".` };
                }
                
                // Return simplified message with image data
                const imageList = results.slice(0, 4).map((img, index) => 
                    `${index + 1}. ${img.alt} by ${img.photographer}`
                ).join('\n');
                
                return {
                    message: `Found ${results.length} images for **${(args as any).query}**:\n\n${imageList}\n\nWhich one would you like to use?`,
                    functionCalled: 'search_internet_images',
                    imageSearchResults: results
                };
            }

            if (name === 'generate_mind_map') {
                try {
                    const topic = (args as any).topic;
                    const result = await generateMindMapCode(topic, 'mindmap');
                    return {
                        message: `✅ Generated mind map for **${topic}**!\n\nThe mind map has been created and is ready to insert into the workspace.`,
                        functionCalled: 'generate_mind_map',
                        mindMapCode: result.code
                    };
                } catch (error) {
                    return {
                        message: `❌ Failed to generate mind map. Please try again.`,
                        functionCalled: 'generate_mind_map'
                    };
                }
            }

            // NEW: Multi-diagram generation handler
            if (name === 'generate_diagram') {
                try {
                    const prompt = (args as any).prompt;
                    const diagramType = ((args as any).diagramType || 'auto') as DiagramType;
                    const result = await generateMindMapCode(prompt, diagramType);
                    const typeLabel = result.type === 'auto' ? 'diagram' : DIAGRAM_CONFIGS[result.type]?.label || result.type;
                    return {
                        message: `✅ Generated **${typeLabel}** for "${prompt}"!\n\nClick the button below to add it to your canvas.`,
                        functionCalled: 'generate_diagram',
                        mindMapCode: result.code // Reusing mindMapCode field for all diagram types
                    };
                } catch (error) {
                    return {
                        message: `❌ Failed to generate diagram. Please try again.`,
                        functionCalled: 'generate_diagram'
                    };
                }
            }
             
             // ... other tools similar logic
            if (name === 'get_canvas_text') {
                 const textContent = currentElements
                    .filter(el => el.type === 'text' || el.content)
                    .map(el => `- ${el.name}: "${el.content}"`)
                    .join('\n');
                 return {
                     message: `Here is the text on the canvas:\n\n${textContent || 'No text found.'}`,
                     functionCalled: 'get_canvas_text'
                 };
            }

            if (name === 'analyze_current_layout' || name === 'suggest_improvements') {
                 // Use validateLayout shared logic
                 // Use a default size if canvasConfig is weird, but it should be fine.
                 const { width, height } = canvasConfig;
                 // Elements need to be mapped to LayoutPlanElement structure if needed, or pass CanvasElement if compatible.
                 // validateLayout expects LayoutPlanElement which has similar structure.
                 const layoutElements = currentElements.map(el => ({
                     ...el,
                     description: 'Existing element'
                 }));
                 
                 const { isValid, issues } = validateLayout(layoutElements as any, width, height); // Cast as any for compatibility
                 
                 const analysis = isValid 
                    ? "The layout looks technically valid with no overlaps or boundary issues." 
                    : `Found some issues:\n${issues.map(i => `- ${i}`).join('\n')}`;
                 
                 return {
                     message: analysis,
                     functionCalled: name
                 };
            }
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
  canvasConfig: CanvasConfig
): Promise<{ plan: LayoutPlan; message: string }> => {
  const { plan } = await generateLayoutPlan(
    currentElements,
    canvasConfig,
    prompt || 'Create a professional, balanced layout'
  );
  return { plan, message: `Generated layout: **${plan.title}**` };
};
