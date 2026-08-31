//layout maker - Gemini Flash Layout AI Service

import { GoogleGenAI, Type, Schema } from '@google/genai';
import { CanvasElement, CanvasConfig, LayoutPlan, LayoutPlanElement, ElementType, ShapeType } from '../types';
import { DiagramType, DIAGRAM_CONFIGS } from '../types/diagramTypes';
import { generateMindMapCode, generateDiagramsBatch, BatchDiagramRequest } from './mindMapService';
import { RegisteredImage, formatImageRegistryForAI, resolveImageReferences } from './imageService';

// Validate API key at module load - fail fast if missing
if (!process.env.API_KEY) {
  console.error('[LayoutMaker] CRITICAL: Missing API_KEY environment variable.');
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS - Centralized configuration for maintainability
// ═══════════════════════════════════════════════════════════════════════════
const LAYOUT_CONSTANTS = {
  /** Minimum margin from canvas edges (pt) */
  MARGIN: 26,
  /** Preferred margin from canvas edges (pt) */
  SAFE_MARGIN: 26,
  /** Minimum spacing between elements (pt) */
  MIN_SPACING: 12,
  /** Preferred spacing between elements (pt) */
  PREFERRED_SPACING: 18,
  /** Minimum text container width (pt) */
  MIN_TEXT_WIDTH: 150,
  /** Minimum element dimension (pt) */
  MIN_ELEMENT_SIZE: 10,
  /** Default element size when not specified (pt) */
  DEFAULT_ELEMENT_SIZE: 100,
  /** Truncation threshold for logs */
  LOG_TRUNCATE_LENGTH: 500,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS - Proper interfaces for AI response parsing
// ═══════════════════════════════════════════════════════════════════════════

/** Structure of bounds from AI response */
interface AIBounds {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/** Structure of a single element from AI response */
interface AILayoutElement {
  id?: string;
  type?: string;
  name?: string;
  bounds?: AIBounds;
  priority?: 'primary' | 'secondary' | 'tertiary';
  // Fix: Renamed justification to description
  description?: string;
  // Fix: Explicitly support isBoard
  isBoard?: boolean;
  content?: string;
  src?: string;
  mermaidCode?: string;
  boardConfig?: { bgColor?: string; BR?: number };
  textStyle?: {
    fontSize?: number;
    fontWeight?: 'normal' | 'bold' | 'semibold';
    textAlign?: 'left' | 'center' | 'right';
    lineHeight?: number;
    color?: string;
  };
  shapeType?: string;
  shapeColor?: string;
  color?: string;
  vertices?: Array<{ x: number; y: number }>;
  tableData?: {
    headers?: string[];
    data?: string[][];
  };
}

/** Structure of the full AI layout response */
interface AILayoutResponse {
  layoutStrategy?: string;
  elements?: AILayoutElement[];
  reasoning?: string;
}

/** Return type for generateLayoutPlan */
export interface LayoutGenerationResult {
  plan: LayoutPlan;
  rawResponse: AILayoutResponse;
}

/** Validated bounds after clamping */
interface SafeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// TABLE UTILITIES - Robust table creation and validation
// ═══════════════════════════════════════════════════════════════════════════

/** Table sizing constants */
const TABLE_CONSTANTS = {
  HEADER_HEIGHT: 40,
  ROW_HEIGHT: 32,
  MIN_COL_WIDTH: 80,
  MAX_COL_WIDTH: 200,
  CELL_PADDING: 8,
  DEFAULT_COLS: 3,
  DEFAULT_ROWS: 4,
} as const;

/** Estimate table dimensions based on content */
const estimateTableBounds = (
  cols: number,
  rows: number,
  maxWidth: number
): { width: number; height: number } => {
  const colWidth = Math.min(
    TABLE_CONSTANTS.MAX_COL_WIDTH,
    Math.max(TABLE_CONSTANTS.MIN_COL_WIDTH, (maxWidth - LAYOUT_CONSTANTS.MARGIN * 2) / cols)
  );
  return {
    width: Math.min(cols * colWidth + TABLE_CONSTANTS.CELL_PADDING * 2, maxWidth - LAYOUT_CONSTANTS.MARGIN * 2),
    height: TABLE_CONSTANTS.HEADER_HEIGHT + (rows * TABLE_CONSTANTS.ROW_HEIGHT) + TABLE_CONSTANTS.CELL_PADDING * 2,
  };
};

/** Normalize and validate table data from AI response */
const normalizeTableData = (td: AILayoutElement['tableData']): {
  rows: number;
  cols: number;
  headers: string[];
  data: string[][];
} => {
  if (!td) {
    return {
      rows: TABLE_CONSTANTS.DEFAULT_ROWS,
      cols: TABLE_CONSTANTS.DEFAULT_COLS,
      headers: ['Column 1', 'Column 2', 'Column 3'],
      data: Array(TABLE_CONSTANTS.DEFAULT_ROWS - 1).fill(null).map(() => Array(TABLE_CONSTANTS.DEFAULT_COLS).fill('')),
    };
  }

  const headers = Array.isArray(td.headers) ? td.headers.filter(h => typeof h === 'string') : [];
  const rawData = Array.isArray(td.data) ? td.data : [];
  
  // Determine column count from headers or longest data row
  const maxDataCols = rawData.reduce((max, row) => 
    Array.isArray(row) ? Math.max(max, row.length) : max, 0
  );
  const cols = Math.max(headers.length, maxDataCols, 2);
  
  // Normalize headers to match column count
  const normalizedHeaders = headers.length === cols
    ? headers
    : [...headers, ...Array(cols - headers.length).fill(null).map((_, i) => `Column ${headers.length + i + 1}`)].slice(0, cols);
  
  // Normalize data rows to match column count
  const normalizedData = rawData.map((row: unknown) => {
    if (!Array.isArray(row)) return Array(cols).fill('');
    // Fix #16: Handle object data in table cells safely
    const stringRow = row.map(cell => {
      if (cell === null || cell === undefined) return '';
      if (typeof cell === 'object') {
        const val = (cell as any).value || (cell as any).text || (cell as any).content;
        return val ? String(val) : '';
      }
      return String(cell);
    });

    if (stringRow.length === cols) return stringRow;
    return [...stringRow, ...Array(cols - stringRow.length).fill('')].slice(0, cols);
  });
  
  // Ensure at least one data row
  if (normalizedData.length === 0) {
    normalizedData.push(Array(cols).fill(''));
  }
  
  return {
    rows: normalizedData.length + 1, // +1 for header row
    cols,
    headers: normalizedHeaders,
    data: normalizedData,
  };
};

 // Layout response schema - simplified for reliability
const layoutResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    layoutStrategy: { type: Type.STRING },
    elements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["text", "image", "shape", "mindmap", "flowchart", "sequenceDiagram", "classDiagram", "erDiagram", "pie", "requirementDiagram", "container", "table", "math"] },
          name: { type: Type.STRING },
          // Fix: Added description to schema
          description: { type: Type.STRING },
          bounds: {
            type: Type.OBJECT,
            properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, width: { type: Type.NUMBER }, height: { type: Type.NUMBER } },
            required: ["x", "y", "width", "height"],
          },
          content: { type: Type.STRING },
          src: { type: Type.STRING },
          mermaidCode: { type: Type.STRING },
          boardConfig: { type: Type.OBJECT, properties: { bgColor: { type: Type.STRING }, BR: { type: Type.NUMBER } } },
          textStyle: {
            type: Type.OBJECT,
            properties: {
              fontSize: { type: Type.NUMBER },
              fontWeight: { type: Type.STRING, enum: ["normal", "bold", "semibold"] },
              textAlign: { type: Type.STRING, enum: ["left", "center", "right"] },
              lineHeight: { type: Type.NUMBER },
              color: { type: Type.STRING },
            }
          },
          shapeType: { type: Type.STRING },
          shapeColor: { type: Type.STRING },
          tableData: {
            type: Type.OBJECT,
            properties: {
              headers: { type: Type.ARRAY, items: { type: Type.STRING } },
              data: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } },
            },
            required: ["headers", "data"],
          },
          isBoard: { type: Type.BOOLEAN },
        },
        required: ["id", "type", "bounds"],
      },
    },
    reasoning: { type: Type.STRING },
  },
  required: ["layoutStrategy", "elements"],
};

// System prompt for layout generation
const LAYOUT_SYSTEM_PROMPT = `You are a Layout AI. Create creative page layouts with NO overlapping elements.use professional layout techique. create engaing and interesting layout

RULES:
- All elements must fit within canvas bounds (0,0) to (width,height)
- Maintain 36pt margins from edges
- Keep 12pt minimum spacing between elements
- Use REAL content, never placeholder text like "Header", "Cell", "Item 1"

ELEMENT TYPES:
- text: Include content and textStyle (fontSize, fontWeight, textAlign, color)
- image: Include src URL. Use https://picsum.photos/W/H?random=N for placeholders
- shape: Include shapeType and shapeColor. Available shapes:
  • Geometric: parallelogram, trapezium, rhombus, kite, right_triangle
  • Polygons: pentagon, hexagon, heptagon, octagon, nonagon, decagon
  • Decorative: arrow, heart, cloud, lightning, shield, badge, speech_bubble, flower, wave
  • Other: ring, crescent, semicircle, minus, plus, capsule, cross_sign, chevron
- table: MUST include tableData with REAL headers[] and data[][] - never use generic words
- mindmap: Include mermaidCode with topic description. AI will generate actual Mermaid mindmap code.
- flowchart: Include mermaidCode with process description. AI will generate Mermaid flowchart code.
- sequenceDiagram: Include mermaidCode with interaction description. AI will generate sequence diagram.
- classDiagram: Include mermaidCode with class structure description. AI will generate class diagram.
- erDiagram: Include mermaidCode with database entity description. AI will generate ER diagram.
- pie: Include mermaidCode with data description. AI will generate pie chart.
- requirementDiagram: Include mermaidCode with requirements description. AI will generate requirement diagram.
- container: Include boardConfig (bgColor, BR)
- math: Include content as LaTeX

TABLE REQUIREMENTS:
- tableData.headers: Array of descriptive column names (e.g. ["Country", "Population", "Capital"])
- tableData.data: 2D array of ACTUAL values (e.g. [["USA", "331 million", "Washington D.C."]])
- Size: width = columns * 120pt, height = (rows + 1) * 36pt
- NEVER use generic text like "Header", "Cell", "Value", "Item"

Boards/Containers (Multi-Page Support):
CRITICAL RULES FOR MULTI-BOARD LAYOUTS:
1. Use type: "container" with "isBoard": true ONLY for top-level PAGES/BOARDS.
2. Each board MUST have width = canvas width, height = canvas height.
3. Boards are positioned SIDE-BY-SIDE horizontally with 100pt gaps:
   - Board 1: bounds = { x: 0, y: 0, width: [CANVAS_WIDTH], height: [CANVAS_HEIGHT] }
   - Board 2: bounds = { x: [CANVAS_WIDTH] + 100, y: 0, width: [CANVAS_WIDTH], height: [CANVAS_HEIGHT] }
   - Board 3: bounds = { x: ([CANVAS_WIDTH] + 100) * 2, y: 0, width: [CANVAS_WIDTH], height: [CANVAS_HEIGHT] }
4. NEVER overlap boards - they must be strictly side-by-side.
5. Set boardConfig with distinct background colors according to text color (e.g. bgColor: "#f0f4ff" and fontcolor:"#00000") and borderRadius: 12.
6. ALL content elements must have bounds WITHIN their parent board:
   - If element is on Board 2, its x must be >= Board2.x + 26 AND x + width <= Board2.x + Board2.width - 26
   - Same for y coordinates
7. Use type: "container" with "isBoard": false for internal grouping boxes within a board.

BOUNDS FORMAT: { "x": number, "y": number, "width": number, "height": number }
shapeType: rectangle, square, circle, triangle, star, polygon, parallelogram, trapezium, rhombus, kite, right_triangle, pentagon, hexagon, heptagon, octagon, nonagon, decagon, arrow, ring, crescent, heart, semicircle, minus, plus, cloud, lightning, shield, badge, speech_bubble, capsule, cross_sign, chevron, flower, wave.
shapeColor: Hex code.
Custom: shapeType: "custom_polygon", vertices: [{x, y}] (relative points)

EDUCATIONAL CONTENT (when user asks to explain a topic):
Create ENGAGING, INTERACTIVE explanations using MULTIPLE element types together:
- Use a title text with large fontSize (32-48) for the topic name
- Add explanatory text blocks breaking down the concept step-by-step
- Include math elements with LaTeX for formulas (e.g. "\\int_a^b f(x)dx", "\\frac{d}{dx}[x^n]=nx^{n-1}")
- Create tables for comparisons, rules, or examples with REAL mathematical content
- Use shapes to create visual diagrams (arrows for flow, shapes for graphs, layout grid)
- Add mindmaps for concept relationships or overview structures
- Use colorful containers/boards to organize sections visually
- Make layouts that TEACH - not just display. Each element should contribute to understanding.

Return valid JSON with layoutStrategy and elements array. Each element needs id, type, and bounds.`;

/**
 * Generate a layout plan based on user description and canvas context
 */
export const generateLayoutPlan = async (
  currentElements: CanvasElement[],
  canvasConfig: CanvasConfig,
  userPrompt: string,
  imageContext?: string,
  imageRegistry?: RegisteredImage[]
): Promise<LayoutGenerationResult> => {
  const { width, height } = { 
    width: canvasConfig.width * (canvasConfig.isFlipbook ? 2 : 1), 
    height: canvasConfig.height 
  };

  const existingElementsContext = currentElements.length > 0
    ? `\n\nExisting Elements (PRIORITIZE preserving these with their content):\n${JSON.stringify(currentElements.map(el => ({
        id: el.id,
        type: el.type,
        name: el.name,
        src: el.src, // URL of the image
        x: el.x, y: el.y, w: el.w, h: el.h,
        // Include actual content data for the AI to understand context
        content: el.content || undefined,
        tableData: el.tableData || undefined,
        mermaidCode: el.mermaidCode || undefined,
        textStyle: el.textStyle || undefined,
      })), null, 2)}`
    : '';

  // Format image registry for AI
  const imageRegistryContext = imageRegistry ? formatImageRegistryForAI(imageRegistry) : '';

  const prompt = `
Canvas Configuration:
- Size: ${width}pt × ${height}pt
- Mode: ${canvasConfig.mode} (${canvasConfig.presetName})
- Safe Margins: 36pt from edges
- Bleed: ${canvasConfig.bleed}pt
${canvasConfig.isFlipbook ? '- FLIPBOOK MODE: Left page 0-' + (width/2) + 'pt, Right page ' + (width/2) + '-' + width + 'pt. Avoid spine area.' : ''}
${existingElementsContext}
${imageRegistryContext}

User Request: "${userPrompt}"
${imageContext ? '\nNOTE: A NEW image has been provided. Analyze its aspect ratio and content. You MUST include this NEW image in the layout plan (type="image", src="PROVIDED_IMAGE") IN ADDITION to any "Existing Elements" that are already images. Do not replace existing images with this new one.' : ''}

Plan an optimal layout. Return precise coordinates for all elements.`;

  const contentParts: any[] = [{ text: prompt }];

  if (imageContext) {
      if (imageContext.startsWith('data:image')) {
          const mimeType = imageContext.substring(5, imageContext.indexOf(';'));
          const data = imageContext.substring(imageContext.indexOf(',') + 1);
          contentParts.push({
              inlineData: {
                  mimeType,
                  data
              }
          });
      } else if (imageContext.startsWith('http://') || imageContext.startsWith('https://')) {
          // URL-based image: inform AI about the URL since we can't inline it
          console.warn('[LayoutMaker] URL image context provided. For best results, convert to base64.');
          contentParts.push({ text: `[User provided an image via URL: ${imageContext}. Include this image in the layout with src set to this URL.]` });
      }
  }

  // Use Gemini 3 Flash for layout generation with error handling
  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: contentParts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: layoutResponseSchema,
        systemInstruction: LAYOUT_SYSTEM_PROMPT,
        thinkingConfig: {
            includeThoughts: true,
            thinkingBudget: 46999,
        }
      },
    });
  } catch (error: any) {
    const isRateLimit = error.status === 429 || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('quota');
    console.error('[LayoutMaker] AI generation failed:', error.message || error);
    throw new Error(isRateLimit 
      ? 'Rate limit exceeded. Please wait a moment and try again.' 
      : 'Layout generation failed. Please try again.');
  }

  // Handle response.text as property or method (SDK version compatibility)
  const text = typeof response.text === 'function' 
    ? await (response.text as () => Promise<string>)() 
    : response.text;
  if (!text) throw new Error('Empty response from layout AI');

  // Log thoughts if available
  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts) {
    const thoughtParts = candidate.content.parts
      .filter((p: any) => p.thought === true && p.text);
    
    if (thoughtParts.length > 0) {
      console.log("\n==================== LAYOUT AI THOUGHTS ====================");
      thoughtParts.forEach((p: any) => {
        console.log(p.text);
      });
      console.log("=============================================================\n");
    }
  }

  console.log('🤖 [LAYOUT AI RESPONSE]:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));

  let cleanText = text.trim()
    .replace(/```json/g, '')
    .replace(/```/g, '');

  // Helper to clamp numeric bounds to valid canvas range
  // Fix: Cast input to any to allow access to removed x,y,w,h properties if present in JSON
  const clampBounds = (bounds: AIBounds | any, maxW: number, maxH: number): SafeBounds => {
    const { MIN_ELEMENT_SIZE, DEFAULT_ELEMENT_SIZE } = LAYOUT_CONSTANTS;
    return {
      x: Math.max(0, Math.min(Number(bounds?.x) || 0, maxW - MIN_ELEMENT_SIZE * 5)),
      y: Math.max(0, Math.min(Number(bounds?.y) || 0, maxH - MIN_ELEMENT_SIZE * 5)),
      width: Math.max(MIN_ELEMENT_SIZE, Math.min(Number(bounds?.width || bounds?.w) || DEFAULT_ELEMENT_SIZE, maxW)),
      height: Math.max(MIN_ELEMENT_SIZE, Math.min(Number(bounds?.height || bounds?.h) || DEFAULT_ELEMENT_SIZE, maxH)),
    };
  };

  let result: AILayoutResponse;
  try {
    result = JSON.parse(cleanText) as AILayoutResponse;
    console.log('✅ [LAYOUT AI PARSED]:', JSON.stringify(result, null, 2).substring(0, LAYOUT_CONSTANTS.LOG_TRUNCATE_LENGTH));
  } catch (e) {
    console.error('❌ [LAYOUT AI PARSE ERROR]:', e);
    throw new Error('Failed to parse layout response');
  }

  // --- STRICT BOARD LOGIC ENFORCEMENT ---
  // Fix board coordinates to ensure NO OVERLAPS, regardless of AI output
  const boardGap = 100;
  
  const extractBounds = (el: any): { x: number; y: number; w: number; h: number } => ({
    // Fix: Prioritize bounds object, fallback to flat properties for robustness
    x: Number(el.bounds?.x ?? el.x ?? 0),
    y: Number(el.bounds?.y ?? el.y ?? 0),
    w: Number(el.bounds?.width ?? el.w ?? width),
    h: Number(el.bounds?.height ?? el.h ?? height),
  });
  
  // Separate boards (isBoard: true) from other containers and elements
  const boards = (result.elements || []).filter((el: any) => el.type === 'container' && el.isBoard === true);
  const nonBoardElements = (result.elements || []).filter((el: any) => !(el.type === 'container' && el.isBoard === true));
  
  console.log(`[LayoutMaker] Found ${boards.length} boards and ${nonBoardElements.length} other elements`);
  
  // Fix: defined in outer scope for visibility
  const fixedBoards: Array<{ el: any; bounds: { x: number; y: number; w: number; h: number } }> = [];

  // Fix board positions - enforce strict side-by-side placement
  if (boards.length > 0) {
    // Sort boards by their intended X position to maintain order
    boards.sort((a: any, b: any) => {
      const ax = extractBounds(a).x;
      const bx = extractBounds(b).x;
      return ax - bx;
    });
    
    let currentX = 0;
    
    boards.forEach((board: any, index: number) => {
      const bounds = extractBounds(board);
      
      // Ensure minimum board size (at least canvas size)
      const boardW = Math.max(bounds.w, width);
      const boardH = Math.max(bounds.h, height);
      
      // Update board with fixed position
      if (board.bounds) {
        board.bounds.x = currentX;
        board.bounds.y = 0;
        board.bounds.width = boardW;
        board.bounds.height = boardH;
      } else {
        board.x = currentX;
        board.y = 0;
        board.w = boardW;
        board.h = boardH;
      }
      
      fixedBoards.push({
        el: board,
        bounds: { x: currentX, y: 0, w: boardW, h: boardH }
      });
      
      console.log(`[LayoutMaker] Board ${index + 1} (${board.name || board.id}): x=${currentX}, w=${boardW}, h=${boardH}`);
      
      // Move to next board position
      currentX += boardW + boardGap;
    });
    
    // --- CONSTRAIN ELEMENTS TO BOARDS ---
    // Ensure all non-board elements are placed INSIDE a board
    nonBoardElements.forEach((el: any) => {
      const elBounds = extractBounds(el);
      
      // Find which board this element belongs to based on its X position
      // Fix #8: Consistent boundary check (using > instead of >= for end range)
      let parentBoard = fixedBoards.find(b => elBounds.x >= b.bounds.x && elBounds.x < b.bounds.x + b.bounds.w);
      
      // If no board found, assign to the first board
      if (!parentBoard && fixedBoards.length > 0) {
        parentBoard = fixedBoards[0];
        console.warn(`[LayoutMaker] Element "${el.name || el.id}" (x=${elBounds.x}) outside all boards, moving to first board`);
      }
      
      if (parentBoard) {
        const margin = LAYOUT_CONSTANTS.SAFE_MARGIN;
        const b = parentBoard.bounds;
        
        // Clamp element to stay within board bounds
        let newX = Math.max(b.x + margin, Math.min(elBounds.x, b.x + b.w - elBounds.w - margin));
        let newY = Math.max(b.y + margin, Math.min(elBounds.y, b.y + b.h - elBounds.h - margin));
        
        // Ensure element doesn't exceed board dimensions
        const newW = Math.min(elBounds.w, b.w - margin * 2);
        const newH = Math.min(elBounds.h, b.h - margin * 2);
        
        // Apply fixed bounds
        if (el.bounds) {
          el.bounds.x = newX;
          el.bounds.y = newY;
          el.bounds.width = newW;
          el.bounds.height = newH;
        } else {
          el.x = newX;
          el.y = newY;
          el.w = newW;
          el.h = newH;
        }
      }
    });
    
    // --- DETECT AND FIX OVERLAPS WITHIN BOARDS ---
    fixedBoards.forEach((boardInfo, boardIndex) => {
      const boardBounds = boardInfo.bounds; // Fix #7: Renamed 'b' to 'boardBounds' to avoid confusion
      const elementsInBoard = nonBoardElements.filter((el: any) => {
        const elBounds = extractBounds(el);
        // Fix #8 (Partial): Consistent boundary check
        return elBounds.x >= boardBounds.x && elBounds.x < boardBounds.x + boardBounds.w;
      });
      
      // Fix #6: Multi-pass overlap resolution to handle cascading moves
      const MAX_PASSES = 5;
      let passes = 0;
      let hasOverlap = true;

      while (hasOverlap && passes < MAX_PASSES) {
        hasOverlap = false;
        passes++;

        for (let i = 0; i < elementsInBoard.length; i++) {
          for (let j = i + 1; j < elementsInBoard.length; j++) {
            const elA = elementsInBoard[i];
            const elB = elementsInBoard[j];

            const boundsA = extractBounds(elA);
            const boundsB = extractBounds(elB);
            
            // Check overlap
            const overlapX = boundsA.x < boundsB.x + boundsB.w && boundsA.x + boundsA.w > boundsB.x;
            const overlapY = boundsA.y < boundsB.y + boundsB.h && boundsA.y + boundsA.h > boundsB.y;
            
            if (overlapX && overlapY) {
              hasOverlap = true;
              // Move element B below element A
              const newY = boundsA.y + boundsA.h + LAYOUT_CONSTANTS.PREFERRED_SPACING;
              
              // Only move if it still fits in the board
              if (newY + boundsB.h <= boardBounds.y + boardBounds.h - LAYOUT_CONSTANTS.SAFE_MARGIN) {
                if (elB.bounds) {
                  elB.bounds.y = newY;
                } else {
                  (elB as any).y = newY;
                }
                console.log(`[LayoutMaker] Fixed overlap (Pass ${passes}): moved "${elB.name || elB.id}" to y=${newY}`);
              }
            }
          }
        }
      }
    });
  }
  
  // Fix #17: If no boards exist (single page), ensure elements fit within canvas
  if (fixedBoards.length === 0) {
    nonBoardElements.forEach((el: any) => {
      const elBounds = extractBounds(el);
      const margin = LAYOUT_CONSTANTS.SAFE_MARGIN;
      
      // Clamp to canvas
      let newX = Math.max(margin, Math.min(elBounds.x, width - elBounds.w - margin));
      let newY = Math.max(margin, Math.min(elBounds.y, height - elBounds.h - margin));

      if (el.bounds) {
        el.bounds.x = newX;
        el.bounds.y = newY;
      } else {
        el.x = newX;
        el.y = newY;
      }
    });
  }
  
  // --- COLOR CONTRAST ENFORCEMENT ---
  // Ensure text is readable against board backgrounds
  const getLuminance = (hex: string): number => {
    // Fix #9: Handle short hex codes (e.g. #FFF)
    let c = hex.replace('#', '');
    if (c.length === 3) {
      c = c.split('').map(char => char + char).join('');
    }
    const r = parseInt(c.substring(0, 2), 16) / 255;
    const g = parseInt(c.substring(2, 4), 16) / 255;
    const b = parseInt(c.substring(4, 6), 16) / 255;
    const getC = (val: number) => val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    return 0.2126 * getC(r) + 0.7152 * getC(g) + 0.0722 * getC(b);
  };

  const getContrastColor = (bgHex: string | undefined): string => {
    if (!bgHex) return '#000000';
    try {
      return getLuminance(bgHex) > 0.179 ? '#000000' : '#FFFFFF';
    } catch (e) { return '#000000'; }
  };

  // Apply contrast fix to text-containing elements
  // Fix #10: Safe iteration with optional chaining
  result.elements?.forEach((el: any) => {
    if (el.type === 'container') return;
    
    // Only process text-containing element types
    const textTypes = ['text', 'table', 'math'];
    if (!textTypes.includes(el.type)) return;

    const elBounds = extractBounds(el);
    
    // Find parent board by position
    const parentBoard = boards.find((c: any) => {
      const cb = extractBounds(c);
      return elBounds.x >= cb.x && elBounds.x <= cb.x + cb.w && elBounds.y >= cb.y && elBounds.y <= cb.y + cb.h;
    });

    // Get background color: from parent board, or default to white
    const bgColor = parentBoard?.boardConfig?.bgColor || '#ffffff';
    const bestTextColor = getContrastColor(bgColor);
    
    // Apply the contrasting color
    if (el.type === 'text') {
      if (!el.textStyle) el.textStyle = {};
      // Only override if AI set a potentially bad color or no color
      if (!el.textStyle.color || el.textStyle.color === bgColor) {
        el.textStyle.color = bestTextColor;
        console.log(`[LayoutMaker] Fixed text contrast for "${el.name || el.id}": ${bestTextColor} on ${bgColor}`);
      }
    }
  });

  // Convert to LayoutPlan format with proper typing
  const plan: LayoutPlan = {
    id: crypto.randomUUID(),
    title: result.layoutStrategy || 'Generated Layout',
    description: result.reasoning || 'engaging optimized layout with zero overlaps',
    elements: (result.elements || []).map((el: AILayoutElement) => {
      const isCustomPolygon = el.shapeType === 'custom_polygon' && el.vertices;
      
      // Clamp bounds to canvas dimensions for safety
      const safeBounds = clampBounds(el.bounds || (el as any), width, height);
      
      // Log shape_auto_added for shape elements
      if (el.type === 'shape' && el.shapeType) {
        console.log(JSON.stringify({ 
          action: 'shape_auto_added', 
          shapeType: el.shapeType,
          vertices: isCustomPolygon ? el.vertices : null,
          polygon_closed: isCustomPolygon,
          message: `Layout AI added shape "${el.shapeType}" at (${safeBounds.x}, ${safeBounds.y})`
        }));
      }

      return {
        id: el.id || crypto.randomUUID(),
        type: (el.type || 'shape') as ElementType,
        name: el.name || el.type || 'Element',
        // Fix: Map description from new field
        description: el.description || '',
        x: safeBounds.x,
        y: safeBounds.y,
        w: safeBounds.width,
        h: safeBounds.height,
        content: el.content || '',
        src: el.src === 'PROVIDED_IMAGE' && imageContext ? imageContext : (el.src || ''),
        mermaidCode: el.mermaidCode || '',
        boardConfig: el.boardConfig ? {
          backgroundColor: el.boardConfig.bgColor,
          borderRadius: el.boardConfig.BR,
        } : undefined,
        textStyle: el.textStyle || undefined,
        shapeType: (el.shapeType || (el.type === 'shape' ? 'rectangle' : undefined)) as ShapeType | undefined,
        color: el.shapeColor || el.color || undefined,
        points: isCustomPolygon ? el.vertices : undefined,
        // Use normalizeTableData for robust validation
        tableData: el.tableData ? normalizeTableData(el.tableData) : undefined,
      };
    }),
    reasoning: result.reasoning || result.layoutStrategy || '',
    status: 'pending',
  };

  // Post-process diagram elements: generate actual Mermaid code from topics
  // Use parallel batch generation for efficiency
  const diagramTypes: DiagramType[] = ['mindmap', 'flowchart', 'sequenceDiagram', 'classDiagram', 'erDiagram', 'pie', 'requirementDiagram'];
  
  // Collect all diagram elements that need generation
  const diagramRequests: BatchDiagramRequest[] = [];
  const diagramElementIndices: number[] = [];
  
  for (let i = 0; i < plan.elements.length; i++) {
    const element = plan.elements[i];
    if (diagramTypes.includes(element.type as DiagramType) && element.mermaidCode) {
      // Fix #3: Check if the content is already valid Mermaid code to avoid re-generating
      const code = element.mermaidCode.trim();
      const isMermaid = /^(mindmap|graph|flowchart|sequenceDiagram|classDiagram|erDiagram|pie|requirementDiagram)/i.test(code);

      if (!isMermaid) {
        diagramRequests.push({
          id: element.id,
          prompt: element.mermaidCode, // Contains the topic/description
          type: element.type as DiagramType,
        });
        diagramElementIndices.push(i);
      } else {
        console.log(`[LayoutMaker] Element "${element.name}" already has valid Mermaid code. Skipping generation.`);
      }
    }
  }
  
  // Generate all diagrams in parallel batches
  if (diagramRequests.length > 0) {
    console.log(`[LayoutMaker] Generating ${diagramRequests.length} diagrams in parallel...`);
    const results = await generateDiagramsBatch(diagramRequests, 2);
    
    // Apply results to elements
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const elementIndex = diagramElementIndices[i];
      const element = plan.elements[elementIndex];
      
      element.mermaidCode = result.code;
      element.type = 'mindmap' as ElementType; // Normalize for consistent rendering
      
      if (result.error) {
        console.warn(`[LayoutMaker] Diagram ${result.id} used fallback: ${result.error}`);
      }
    }
  }

  // Post-process image elements: smart URL validation
  for (const element of plan.elements) {
    if (element.type === 'image') {
      const src = element.src || '';
      const isValidUrl = src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:');
      const isRegistryRef = /^IMAGE_\d+$/i.test(src);
      const isProvidedImage = src === 'PROVIDED_IMAGE';
      const trustedDomains = ['picsum.photos', 'unsplash.com', 'pexels.com', 'pixabay.com', 'weserv.nl', 'images.unsplash.com'];
      const isTrustedSource = trustedDomains.some(domain => src.includes(domain));
      
      // Only replace if genuinely invalid (empty, or not valid URL/registry/provided)
      if (!src || (!isValidUrl && !isRegistryRef && !isProvidedImage)) {
        const imgWidth = Math.round(element.w) || 400;
        const imgHeight = Math.round(element.h) || 300;
        const seed = Math.floor(Math.random() * 1000);
        element.src = `https://picsum.photos/${imgWidth}/${imgHeight}?random=${seed}`;
        console.log(`[LayoutMaker] Generated placeholder for "${element.name}": ${element.src}`);
      } else if (isValidUrl && !isTrustedSource && !isRegistryRef) {
        console.log(`[LayoutMaker] Preserved custom URL for "${element.name}": ${src.substring(0, 50)}...`);
      }
    }
  }

  // Resolve IMAGE_x references from the registry
  if (imageRegistry && imageRegistry.length > 0) {
    plan.elements = resolveImageReferences(plan.elements, imageRegistry) as LayoutPlanElement[];
  }

  return { plan, rawResponse: result };
};

export const chatWithLayoutAI = async (
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  canvasConfig: CanvasConfig
): Promise<string> => {
  const { width, height } = { 
    width: canvasConfig.width * (canvasConfig.isFlipbook ? 2 : 1), 
    height: canvasConfig.height 
  };

  const contextPrompt = `You are helping plan engaging layouts for a ${width}×${height}pt ${canvasConfig.presetName} canvas.`;

  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: contents,
    config: {
        systemInstruction: `${LAYOUT_SYSTEM_PROMPT}\n\n${contextPrompt}\n\nRespond conversationally to help the user refine their layout ideas. When ready to generate, provide precise coordinates.`,
          // Fixed: Removed invalid 'thinkingLevel' which was causing type errors.
        // Using standard generation for chat interactions.
    },
  });

  // Fix #5: Handle response.text as property or method (SDK version compatibility)
  const text = typeof response.text === 'function' 
    ? await (response.text as () => Promise<string>)() 
    : response.text;

  return text || 'I understand. How would you like to proceed with the layout?';
};

export const validateLayout = (
  elements: LayoutPlanElement[],
  canvasWidth: number,
  canvasHeight: number
): { isValid: boolean; issues: string[] } => {
  const issues: string[] = [];
  const { MARGIN, MIN_SPACING, MIN_TEXT_WIDTH } = LAYOUT_CONSTANTS;

  for (const el of elements) {
    // Boundary check
    if (el.x < MARGIN) issues.push(`${el.name}: Too close to left edge (x=${el.x})`);
    if (el.y < MARGIN) issues.push(`${el.name}: Too close to top edge (y=${el.y})`);
    if (el.x + el.w > canvasWidth - MARGIN) issues.push(`${el.name}: Exceeds right boundary`);
    if (el.y + el.h > canvasHeight - MARGIN) issues.push(`${el.name}: Exceeds bottom boundary`);

    // Text width check
    if (el.type === 'text' && el.w < MIN_TEXT_WIDTH) {
      issues.push(`${el.name}: Text container too narrow (${el.w}pt < ${MIN_TEXT_WIDTH}pt)`);
    }
  }

  // Overlap detection
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i];
      const b = elements[j];
      
      const overlap = !(
        a.x + a.w + MIN_SPACING <= b.x ||
        b.x + b.w + MIN_SPACING <= a.x ||
        a.y + a.h + MIN_SPACING <= b.y ||
        b.y + b.h + MIN_SPACING <= a.y
      );

      if (overlap) {
        issues.push(`OVERLAP: ${a.name} and ${b.name}`);
      }
    }
  }

  return { isValid: issues.length === 0, issues };
};