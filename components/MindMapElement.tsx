import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import mermaid from 'mermaid';
import { CanvasElement } from '../types';

interface MindMapElementProps {
  element: CanvasElement;
  onUpdateElement?: (id: string, updates: Partial<CanvasElement>) => void;
}

// ══════════════════════════════════════════════════════════════
// GLOBAL STATE
// ══════════════════════════════════════════════════════════════

let mermaidInitialized = false;

// LRU-style cache with max size
const SVG_CACHE_MAX_SIZE = 100;
const svgCache = new Map<string, string>();

// Track which original codes have been replaced by fallbacks
// Maps original broken code -> fallback code that works
const fallbackAppliedCache = new Map<string, string>();

const addToCache = (key: string, value: string) => {
  // Evict oldest entry if at capacity
  if (svgCache.size >= SVG_CACHE_MAX_SIZE) {
    const firstKey = svgCache.keys().next().value;
    if (firstKey) svgCache.delete(firstKey);
  }
  svgCache.set(key, value);
};

// ══════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════

/** Fix text colors for visibility on canvas backgrounds */
const applyTextColorFix = (svgString: string): string => {
  let fixed = svgString;

  // Replace white fills
  fixed = fixed.replace(/fill\s*=\s*["'](#fff|#ffffff|white|rgb\s*\(\s*255\s*,\s*255\s*,\s*255\s*\))["']/gi, 'fill="#1a1a2e"');

  // Replace white in inline styles
  fixed = fixed.replace(/style\s*=\s*["']([^"']*)color\s*:\s*(#fff|#ffffff|white)([^"']*)["']/gi, 'style="$1color: #1a1a2e$3"');
  fixed = fixed.replace(/style\s*=\s*["']([^"']*)fill\s*:\s*(#fff|#ffffff|white)([^"']*)["']/gi, 'style="$1fill: #1a1a2e$3"');

  // Replace very light colors
  fixed = fixed.replace(/fill\s*=\s*["'](#f[8-9a-f]{5}|#f[a-f]{2})["']/gi, 'fill="#2a2a4e"');

  // Inject CSS override
  const cssStyles = `<defs><style>
    text, tspan { fill: #1a1a2e !important; }
    foreignObject div, foreignObject span, foreignObject p { color: #1a1a2e !important; }
    .node rect, .node circle, .node polygon { stroke: #4a4a6e !important; }
  </style></defs>`;

  fixed = fixed.replace(/<svg([^>]*)>/, `<svg$1>${cssStyles}`);
  return fixed;
};

/** Extract ACTUAL content dimensions from SVG by rendering it in a hidden element */
const extractAndFixSvgDimensions = (svgString: string): { svg: string; width: number; height: number } => {
  let width = 300;
  let height = 200;

  try {
    // Create a temporary hidden container to measure actual SVG content
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position: absolute; visibility: hidden; left: -9999px; top: -9999px;';
    tempDiv.innerHTML = svgString;
    document.body.appendChild(tempDiv);

    const svgElement = tempDiv.querySelector('svg');
    if (svgElement) {
      // Try to get the bounding box of actual content
      try {
        const bbox = svgElement.getBBox();
        if (bbox.width > 0 && bbox.height > 0) {
          // Use actual content size
          width = bbox.width + bbox.x;
          height = bbox.height + bbox.y;
        }
      } catch {
        // getBBox might fail if SVG is complex, fall back to attributes
        const svgWidth = svgElement.getAttribute('width');
        const svgHeight = svgElement.getAttribute('height');

        if (svgWidth) width = parseFloat(svgWidth) || width;
        if (svgHeight) height = parseFloat(svgHeight) || height;

        // Also check viewBox
        const viewBox = svgElement.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.split(/[\s,]+/);
          if (parts.length >= 4) {
            const vbWidth = parseFloat(parts[2]);
            const vbHeight = parseFloat(parts[3]);
            // Use viewBox only if it's smaller (more accurate)
            if (vbWidth > 0 && vbWidth < width) width = vbWidth;
            if (vbHeight > 0 && vbHeight < height) height = vbHeight;
          }
        }
      }
    }

    document.body.removeChild(tempDiv);
  } catch (e) {
    console.warn('[extractAndFixSvgDimensions] Measurement failed, using defaults', e);
  }

  // Add small padding
  const padding = 13;
  width += padding * 2;
  height += padding * 2;

  // Ensure reasonable sizes (not too small, not too huge)
  width = Math.max(150, Math.min(width, 1200));
  height = Math.max(100, Math.min(height, 800));

  // Clean up SVG styling
  let fixedSvg = svgString;

  // Remove max-width constraints that mermaid adds
  fixedSvg = fixedSvg.replace(/max-width\s*:\s*[\d.]+px\s*;?/gi, '');
  fixedSvg = fixedSvg.replace(/style\s*=\s*["']([^"']*)max-width[^;]*;?([^"']*)["']/gi, 'style="$1$2"');

  // Add proper sizing attributes
  fixedSvg = fixedSvg.replace(
    /<svg([^>]*)>/,
    `<svg$1 preserveAspectRatio="xMidYMid meet" style="overflow: visible; width: 100%; height: 100%;">`
  );

  return { svg: fixedSvg, width: Math.round(width), height: Math.round(height) };
};

/** 
 * Robustly sanitize AI-generated mermaid mindmap code.
 * Fixes common issues where AI puts children on same line as root.
 */
const sanitizeMermaidCode = (code: string): string => {
  if (!code || typeof code !== 'string') {
    return 'mindmap\n  root((Diagram))\n    Content';
  }

  // Step 1: Normalize all whitespace and line endings
  let sanitized = code
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')  // Non-breaking space
    .replace(/\t/g, '  ');    // Tabs to spaces

  // Step 2: Check if this is a mindmap
  const isMindmap = sanitized.trim().toLowerCase().startsWith('mindmap');
  if (!isMindmap) {
    return sanitized;
  }

  // Step 3: Find and fix the root line - this is where the bug happens
  // The AI puts: root((Topic)):::root Child1 Child2 Child3
  // We need to split this into separate lines

  const lines = sanitized.split('\n');
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this line contains a root definition with content after it
    // Pattern: root((something)):::classname followed by more content
    const rootWithClassMatch = trimmed.match(/^(root\(\([^)]*\)\)):::([\w-]+)\s+(.+)$/);
    if (rootWithClassMatch) {
      const [, rootPart, className, restContent] = rootWithClassMatch;
      // Add the root line properly indented
      resultLines.push(`  ${rootPart}:::${className}`);

      // Split the rest content into children - try multiple strategies
      // Strategy 1: Split by double+ spaces or tabs
      let children = restContent.trim().split(/\s{2,}|\t/);

      // Strategy 2: If we only got 1 item with spaces, try splitting by capitalized words
      if (children.length === 1 && children[0].includes(' ')) {
        // Try splitting on space before capital letter (e.g., "Operating Principles Laser Sources")
        const words = children[0].split(/\s+/);
        if (words.length > 1) {
          // Each word or phrase becomes a child
          children = words.filter(w => w.trim());
        }
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

    // Pattern: root(something) single paren followed by content
    const rootSingleMatch = trimmed.match(/^(root\([^)]+\))::?([\w-]*)\s+(.+)$/);
    if (rootSingleMatch) {
      const [, rootPart, className, restContent] = rootSingleMatch;
      const classStr = className ? `:::${className}` : '';
      resultLines.push(`  ${rootPart}${classStr}`);

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
      // Root without trailing content
      if (!line.startsWith('  ')) {
        resultLines.push('  ' + trimmed);
      } else {
        resultLines.push(line);
      }
    } else if (trimmed.startsWith('classDef')) {
      // classDef lines go at the end
      resultLines.push('  ' + trimmed);
    } else if (trimmed) {
      // Child nodes need proper indentation (at least 4 spaces)
      const currentIndent = line.match(/^(\s*)/)?.[1]?.length || 0;
      if (currentIndent < 4) {
        resultLines.push('    ' + trimmed);
      } else {
        resultLines.push(line);
      }
    } else {
      // Empty line
      resultLines.push('');
    }
  }

  // Debug log to see what we're producing
  const result = resultLines.join('\n');
  console.log('[sanitizeMermaidCode] Output:\n', result);

  return result;
};

/**
 * Generate a fallback mindmap when the provided code can't be parsed.
 * Produces GUARANTEED valid mermaid mindmap syntax.
 */
const generateFallbackMindmap = (originalCode: string, errorHint?: string): string => {
  // Extract and sanitize the root topic
  const rootMatch = originalCode.match(/root\(\(([^)]+)\)/);
  let rootTopic = rootMatch ? rootMatch[1].trim() : 'Topic';
  // Remove any special characters that might break mermaid
  rootTopic = rootTopic.replace(/[()[\]{}:::]/g, '').substring(0, 25) || 'Topic';

  // Extract potential child keywords from the original code
  const cleanedText = originalCode
    .replace(/mindmap|root|classDef|:::\w+|[()[\]{}]/gi, ' ')
    .replace(/\s+/g, ' ');

  const potentialWords = cleanedText.split(' ')
    .map(w => w.trim())
    .filter(w => w.length >= 4 && w.length <= 20 && /^[A-Za-z]/.test(w))
    .filter(w => w.toLowerCase() !== rootTopic.toLowerCase());

  const uniqueWords = Array.from(new Set(potentialWords)).slice(0, 5);

  // Build the diagram line by line to ensure valid syntax
  const diagramLines: string[] = [
    'mindmap',
    `  root((${rootTopic}))`
  ];

  if (uniqueWords.length > 0) {
    for (const word of uniqueWords) {
      diagramLines.push(`    ${word}`);
    }
  } else {
    // Default children if we couldn't extract any
    diagramLines.push('    Overview');
    diagramLines.push('    Details');
    diagramLines.push('    Summary');
  }

  const result = diagramLines.join('\n');
  console.log('[generateFallbackMindmap] Generated fallback:\n', result);

  return result;
};

/** Generate stable render ID */
const getRenderIdCounter = (() => {
  let counter = 0;
  return () => ++counter;
})();

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export const MindMapElement: React.FC<MindMapElementProps> = React.memo(({ element, onUpdateElement }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRenderedCodeRef = useRef<string>('');
  const isMountedRef = useRef(true);

  // Initialize Mermaid once globally
  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'loose',
        themeVariables: {
          // Mindmap root node - light green
          mindmapRoot: '#f7faf7ff',           // emerald-200 (light green)
          mindmapRootColor: '#b3eeddff',      // emerald-800 (dark text) 
          mindmapRootBorder: '#cdf9a4ff',     // emerald-500
          // Child nodes
          mindmap1: '#d8fec7ff',              // amber-100
          mindmap2: '#fce7f3',              // pink-100
          mindmap3: '#dbeafe',              // blue-100
          mindmap4: '#e0e7ff',              // indigo-100
          mindmap5: '#f3e8ff',              // purple-100
        },
        flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis' },
        sequence: { useMaxWidth: false, mirrorActors: false },
        journey: { useMaxWidth: false },
        pie: { useMaxWidth: false },
        er: { useMaxWidth: false },
      });
      mermaidInitialized = true;
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Memoize the mermaid syntax
  const mermaidSyntax = useMemo(() => {
    if (element.mermaidCode) {
      // Check if we've already applied a fallback for this code
      const cachedFallback = fallbackAppliedCache.get(element.mermaidCode);
      if (cachedFallback) {
        console.log('[MindMapElement] Using cached fallback for known broken code');
        return cachedFallback;
      }
      // Runtime fix: sanitize AI-generated code for common syntax issues
      return sanitizeMermaidCode(element.mermaidCode);
    }

    const data = element.mindMapData;
    if (!data) return 'mindmap\n  root((Diagram))';

    let syntax = 'mindmap\n';

    const processNode = (node: any, depth: number) => {
      const indent = '  '.repeat(depth);
      const label = String(node.label || 'Node').replace(/[()[\]{}]/g, ''); // Sanitize
      syntax += `${indent}${label}\n`;
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child: any) => processNode(child, depth + 1));
      }
    };

    if (data.root) {
      const rootLabel = String(data.root).replace(/[()[\]{}]/g, '');
      syntax += `  root((${rootLabel}))\n`;
    }

    if (data.children && Array.isArray(data.children)) {
      data.children.forEach((child: any) => processNode(child, 2));
    }

    return syntax;
  }, [element.mermaidCode, element.mindMapData]);

  // Render diagram with caching
  const renderDiagram = useCallback(async () => {
    if (!containerRef.current || !isMountedRef.current) return;

    // Skip if identical to last render
    if (lastRenderedCodeRef.current === mermaidSyntax && svgContent) {
      return;
    }

    // Check cache
    if (svgCache.has(mermaidSyntax)) {
      const cached = svgCache.get(mermaidSyntax)!;
      setSvgContent(cached);
      lastRenderedCodeRef.current = mermaidSyntax;
      setRenderError(null);

      // Still need to measure and resize from cache
      const { width, height } = extractAndFixSvgDimensions(cached);
      if (onUpdateElement && (element.w !== width || element.h !== height)) {
        console.log(`[MindMapElement] Resizing cached element to ${width}x${height}`);
        onUpdateElement(element.id, { w: width, h: height });
      }
      return;
    }

    const renderId = `mermaid-el-${element.id}-${getRenderIdCounter()}`;

    try {
      const { svg } = await mermaid.render(renderId, mermaidSyntax);

      if (!isMountedRef.current) return;

      // Extract dimensions and fix SVG for proper display
      const { svg: dimensionFixedSvg, width, height } = extractAndFixSvgDimensions(svg);
      const fixedSvg = applyTextColorFix(dimensionFixedSvg);

      addToCache(mermaidSyntax, fixedSvg);
      setSvgContent(fixedSvg);
      lastRenderedCodeRef.current = mermaidSyntax;
      setRenderError(null);

      // Auto-resize element to fit diagram content (always apply correct size)
      if (onUpdateElement && (element.w !== width || element.h !== height)) {
        console.log(`[MindMapElement] Auto-resizing element from ${element.w}x${element.h} to ${width}x${height}`);
        onUpdateElement(element.id, { w: width, h: height });
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;

      const errorMsg = error.message || 'Syntax error';
      console.warn('[MindMapElement] Render error:', errorMsg);

      // Check if this is a mindmap and try fallback
      const isMindmapError = mermaidSyntax.trim().toLowerCase().startsWith('mindmap');

      if (isMindmapError && element.mermaidCode) {
        // Try to render a fallback diagram
        try {
          const fallbackCode = generateFallbackMindmap(element.mermaidCode, errorMsg);
          const fallbackId = `mermaid-fallback-${element.id}-${getRenderIdCounter()}`;
          const { svg: fallbackSvg } = await mermaid.render(fallbackId, fallbackCode);

          if (!isMountedRef.current) return;

          // Extract dimensions and fix SVG
          const { svg: dimensionFixedSvg, width, height } = extractAndFixSvgDimensions(fallbackSvg);
          const fixedFallback = applyTextColorFix(dimensionFixedSvg);
          setSvgContent(fixedFallback);
          lastRenderedCodeRef.current = fallbackCode;

          // Cache this fallback so we don't keep retrying the broken code
          fallbackAppliedCache.set(element.mermaidCode, fallbackCode);

          // Also add the fallback SVG to cache
          addToCache(fallbackCode, fixedFallback);

          // Update the element with the working code and proper dimensions
          if (onUpdateElement) {
            console.log('[MindMapElement] Updating element with working fallback code');
            onUpdateElement(element.id, { mermaidCode: fallbackCode, w: width, h: height });
          }

          setRenderError(null); // Clear error since fallback worked
          console.log('[MindMapElement] Fallback rendered successfully');
          return;
        } catch (fallbackError) {
          console.error('[MindMapElement] Fallback also failed:', fallbackError);
        }
      }

      setRenderError(errorMsg.substring(0, 60));
      // Keep last valid content if available
    }
  }, [mermaidSyntax, element.id, element.mermaidCode, svgContent, onUpdateElement]);

  // Debounced render effect
  useEffect(() => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    renderTimeoutRef.current = setTimeout(renderDiagram, 100);

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [mermaidSyntax, renderDiagram]);

  return (
    <div
      className="w-full h-full overflow-visible flex items-center justify-center bg-transparent relative p-2"
      ref={containerRef}
    >
      {renderError && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-red-500/20 text-red-500 text-[10px] rounded-md z-10">
          ⚠️ {renderError.substring(0, 50)}
        </div>
      )}
      <div
        className="w-full h-full flex items-center justify-center overflow-visible [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
        style={{ padding: '4px' }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
});

MindMapElement.displayName = 'MindMapElement';

// Export cache clear utility for testing/debugging
export const clearDiagramCache = () => {
  svgCache.clear();
  fallbackAppliedCache.clear();
};
