import { GoogleGenAI } from "@google/genai";
import { DiagramType, DIAGRAM_CONFIGS } from "../types/diagramTypes";

// Validate API key at module load. Browser builds have no `process`; AI calls are future work.
const API_KEY = typeof process !== 'undefined' ? process.env.API_KEY : undefined;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;
const getClient = (): GoogleGenAI => {
  if (!ai) throw new Error('AI diagram generation is not configured in this deployment.');
  return ai;
};

const BASE_SYSTEM_INSTRUCTION = `You are an expert educator and visual designer. You create premium, highly engaging diagrams using Mermaid.js.
Your goal is to make diagrams that look modern, professional, and visually rich.
The diagrams should be logically structured, high-contrast, and optimized for both presentation and learning.`;

// ══════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════

/** Delay for exponential backoff */
const delay = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason);
    return;
  }
  const timeout = setTimeout(() => {
    signal?.removeEventListener('abort', handleAbort);
    resolve();
  }, ms);
  const handleAbort = () => {
    clearTimeout(timeout);
    reject(signal?.reason);
  };
  signal?.addEventListener('abort', handleAbort, { once: true });
});

/** Check if error is a rate limit error */
const isRateLimitError = (error: any): boolean => {
  if (!error) return false;
  if (error.status === 429) return true;
  if (error.code === 429) return true;
  const msg = error.message?.toLowerCase() || '';
  return msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota') || msg.includes('rate limit');
};

/** Validate and sanitize user input */
const sanitizePrompt = (prompt: string): string => {
  if (!prompt || typeof prompt !== 'string') return '';
  return prompt.trim().substring(0, 2000); // Limit length to prevent abuse
};

/** Clean markdown code blocks from AI output and sanitize mindmap syntax */
const cleanMermaidResponse = (text: string): string => {
  let cleaned = text.trim();

  // Remove various markdown code block formats
  if (cleaned.startsWith('```mermaid')) {
    cleaned = cleaned.replace(/^```mermaid\s*\n?/, '').replace(/\n?```\s*$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // Normalize all whitespace and line endings
  cleaned = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')  // Non-breaking space
    .replace(/\t/g, '  ');    // Tabs to spaces

  // Check if this is a mindmap - other diagram types don't need this fix
  const isMindmap = cleaned.trim().toLowerCase().startsWith('mindmap');
  if (!isMindmap) {
    return cleaned.trim();
  }

  // Parse and fix the mindmap line by line
  const lines = cleaned.split('\n');
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this line contains a root definition with content after it
    // Pattern: root((something)):::classname followed by more content
    const rootWithClassMatch = trimmed.match(/^(root\(\([^)]*\)\)):::([\w-]+)\s+(.+)$/);
    if (rootWithClassMatch) {
      const [, rootPart, className, restContent] = rootWithClassMatch;
      resultLines.push(`  ${rootPart}:::${className}`);

      // Smart split: try double spaces first, then single spaces
      let children = restContent.trim().split(/\s{2,}|\t/);
      if (children.length === 1 && children[0].includes(' ')) {
        children = children[0].split(/\s+/).filter(w => w.trim());
      }

      for (const child of children) {
        const cleanChild = child.trim();
        if (cleanChild && !cleanChild.startsWith('classDef') && cleanChild.length > 0) {
          resultLines.push(`    ${cleanChild}`);
        }
      }
      continue;
    }

    // Pattern: root((something)) followed by content (no class)
    const rootNoClassMatch = trimmed.match(/^(root\(\([^)]*\)\))\s+(.+)$/);
    if (rootNoClassMatch) {
      const [, rootPart, restContent] = rootNoClassMatch;
      resultLines.push(`  ${rootPart}`);

      let children = restContent.trim().split(/\s{2,}|\t/);
      if (children.length === 1 && children[0].includes(' ')) {
        children = children[0].split(/\s+/).filter(w => w.trim());
      }

      for (const child of children) {
        const cleanChild = child.trim();
        if (cleanChild && !cleanChild.startsWith('classDef') && cleanChild.length > 0) {
          resultLines.push(`    ${cleanChild}`);
        }
      }
      continue;
    }

    // For normal lines, ensure proper indentation
    if (trimmed.toLowerCase() === 'mindmap') {
      resultLines.push('mindmap');
    } else if (trimmed.startsWith('root(')) {
      if (!line.startsWith('  ')) {
        resultLines.push('  ' + trimmed);
      } else {
        resultLines.push(line);
      }
    } else if (trimmed.startsWith('classDef')) {
      resultLines.push('  ' + trimmed);
    } else if (trimmed) {
      const currentIndent = line.match(/^(\s*)/)?.[1]?.length || 0;
      if (currentIndent < 4) {
        resultLines.push('    ' + trimmed);
      } else {
        resultLines.push(line);
      }
    } else {
      resultLines.push('');
    }
  }

  return resultLines.join('\n').trim();
};

/** Validate if the generated code is valid Mermaid syntax (basic check) */
const validateMermaidSyntax = (code: string, type: DiagramType): boolean => {
  if (!code || code.length < 10) return false;

  // Check if it starts with expected keywords
  const typeKeywords: Record<string, string[]> = {
    mindmap: ['mindmap'],
    flowchart: ['flowchart', 'graph'],
    sequenceDiagram: ['sequencediagram'],
    classDiagram: ['classdiagram'],
    erDiagram: ['erdiagram'],
    pie: ['pie'],
    requirementDiagram: ['requirementdiagram'],
  };

  const keywords = typeKeywords[type] || [];
  const codeLower = code.toLowerCase();
  return keywords.length === 0 || keywords.some(kw => codeLower.startsWith(kw));
};

// ══════════════════════════════════════════════════════════════
// AUTO-DETECTION
// ══════════════════════════════════════════════════════════════

const AUTO_DETECT_PROMPT = `Analyze the user prompt and determine the best Mermaid.js diagram type.

Available types:
- mindmap: hierarchical concepts, brainstorming, topic overviews
- flowchart: processes, decision trees, algorithms, workflows
- sequenceDiagram: interactions between systems, API flows, protocols
- classDiagram: object-oriented structures, class hierarchies, data models
- erDiagram: database schemas, entity relationships
- pie: statistics, proportions, percentages
- requirementDiagram: system requirements, specifications

Return JSON ONLY:
{"type": "one of the above", "reasoning": "1-line explanation"}`;

// ══════════════════════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════════════════════

export interface DiagramGenerationResult {
  code: string;
  type: DiagramType;
}

export const generateMindMapCode = async (
  userPrompt: string,
  diagramType: DiagramType = 'mindmap',
  maxRetries: number = 3,
  signal?: AbortSignal
): Promise<DiagramGenerationResult> => {
  const sanitizedPrompt = sanitizePrompt(userPrompt);
  if (!sanitizedPrompt) {
    throw new Error('Invalid prompt: Please provide a non-empty description.');
  }

  const modelName = 'gemini-3-flash-preview';
  let targetType: DiagramType = diagramType === 'auto' ? 'mindmap' : diagramType;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      signal?.throwIfAborted();
      console.log(`[DiagramService] Attempt ${attempt + 1}/${maxRetries} for type: ${diagramType}`);

      // Handle Auto Mode - detect best diagram type
      if (diagramType === 'auto' && attempt === 0) {
        try {
          const autoResponse = await getClient().models.generateContent({
            model: modelName,
            contents: { parts: [{ text: `${AUTO_DETECT_PROMPT}\n\nUser Prompt: "${sanitizedPrompt}"` }] },
            config: { responseMimeType: "application/json", abortSignal: signal }
          });

          const result = JSON.parse(autoResponse.text || '{}');
          if (result.type && DIAGRAM_CONFIGS[result.type as keyof typeof DIAGRAM_CONFIGS]) {
            targetType = result.type as DiagramType;
            console.log(`[DiagramService] Auto-detected: ${targetType} (${result.reasoning || 'no reason'})`);
          }
        } catch (autoErr) {
          console.warn('[DiagramService] Auto-detect failed, defaulting to mindmap:', autoErr);
          targetType = 'mindmap';
        }
      }

      const config = DIAGRAM_CONFIGS[targetType as keyof typeof DIAGRAM_CONFIGS];
      if (!config) {
        throw new Error(`Unknown diagram type: ${targetType}`);
      }

      const prompt = `Create a diagram for: "${sanitizedPrompt}"

${config.systemPrompt}

IMPORTANT: Return ONLY the raw Mermaid code. No explanations, no markdown, no backticks.`;

      const response = await getClient().models.generateContent({
        model: modelName,
        contents: { parts: [{ text: prompt }] },
        config: {
          systemInstruction: BASE_SYSTEM_INSTRUCTION,
          responseMimeType: "text/plain",
          abortSignal: signal,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from AI");

      const cleanedCode = cleanMermaidResponse(text);

      // Validate the output
      if (!validateMermaidSyntax(cleanedCode, targetType)) {
        console.warn(`[DiagramService] Validation warning: Code may not match expected ${targetType} syntax`);
        // Don't fail, mermaid.render will catch actual syntax errors
      }

      console.log(`[DiagramService] Success on attempt ${attempt + 1}, type: ${targetType}`);
      return { code: cleanedCode, type: targetType };

    } catch (error: any) {
      if (error?.name === 'AbortError') throw error;
      lastError = error;
      console.warn(`[DiagramService] Attempt ${attempt + 1} failed:`, error.message || error);

      if (isRateLimitError(error) && attempt < maxRetries - 1) {
        const waitTime = (attempt + 1) * 15000; // 15s, 30s, 45s
        console.log(`[DiagramService] Rate limited. Waiting ${waitTime / 1000}s before retry...`);
        await delay(waitTime, signal);
        continue;
      }

      // For non-rate-limit errors, throw immediately
      break;
    }
  }

  // Provide user-friendly error message
  const errorMessage = isRateLimitError(lastError)
    ? 'Rate limit exceeded. Please wait a moment and try again.'
    : lastError?.message || 'Failed to generate diagram. Please try again.';

  console.error("[DiagramService] All retries exhausted:", lastError);
  throw new Error(errorMessage);
};

// ══════════════════════════════════════════════════════════════
// BATCH GENERATION (for Layout Maker)
// ══════════════════════════════════════════════════════════════

export interface BatchDiagramRequest {
  id: string;
  prompt: string;
  type: DiagramType;
}

export interface BatchDiagramResult {
  id: string;
  code: string;
  type: DiagramType;
  error?: string;
}

/**
 * Generate multiple diagrams in parallel (with concurrency limit)
 * Used by Layout Maker for efficiency
 */
export const generateDiagramsBatch = async (
  requests: BatchDiagramRequest[],
  concurrencyLimit: number = 2,
  signal?: AbortSignal,
): Promise<BatchDiagramResult[]> => {
  if (!requests.length) return [];

  const results: BatchDiagramResult[] = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < requests.length; i += concurrencyLimit) {
    signal?.throwIfAborted();
    const batch = requests.slice(i, i + concurrencyLimit);

    const batchPromises = batch.map(async (req): Promise<BatchDiagramResult> => {
      try {
        const result = await generateMindMapCode(req.prompt, req.type, 2, signal); // Fewer retries for batch
        return { id: req.id, code: result.code, type: result.type };
      } catch (error: any) {
        if (error?.name === 'AbortError') throw error;
        console.warn(`[DiagramService] Batch item ${req.id} failed:`, error.message);
        // Return fallback on error
        const fallback = DIAGRAM_CONFIGS[req.type as keyof typeof DIAGRAM_CONFIGS]?.defaultCode ||
          `mindmap\n  root((${req.prompt.substring(0, 20)}))\n    Subtopic 1`;
        return { id: req.id, code: fallback, type: 'mindmap', error: error.message };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay between batches to avoid rate limits
    if (i + concurrencyLimit < requests.length) {
      await delay(500, signal);
    }
  }

  return results;
};
