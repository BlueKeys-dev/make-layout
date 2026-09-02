import { CanvasConfig, CanvasElement, LayoutPlan, LayoutRole, ShapeType } from '../types';
import { DiagramType, DIAGRAM_CONFIGS } from '../types/diagramTypes';
import { richTextToPlainText, sanitizeMermaidSource, sanitizeRichText } from '../utils/contentSecurity';
import { generateLayoutPlan, validateLayout } from './layout_maker';
import type { LayoutValidationFocus } from './layout_maker';
import { searchImages, ImageSearchResult } from './imageService';
import { generateMindMapCode } from './mindMapService';
import { CANVAS_TOOL_CATALOG, CanvasToolName } from './canvasToolCatalog';
import { createContainerBoard } from '../utils/elementRegistry';
import {
  assignLayoutSlotRole,
  getLayoutTemplates,
  instantiateLayoutTemplate,
  LayoutTemplateError,
} from './layoutTemplates';

export interface CanvasToolExecutionContext {
  elements: CanvasElement[];
  canvasConfig: CanvasConfig;
  currentPage: number;
  pageCount: number;
  selectedIds: string[];
  activeBoardId: string | null;
  revision: number;
  uiLocked: boolean;
  requireUiLock: boolean;
}

export interface CanvasToolEffects {
  expectedRevision?: number;
  elementToAdd?: CanvasElement;
  elementIdToRemove?: string;
  removalReason?: string;
  pendingPlan?: LayoutPlan;
  imageSearchResults?: ImageSearchResult[];
  diagramCode?: string;
  diagramType?: DiagramType;
  uiLocked?: boolean;
  layoutElementsToAdd?: CanvasElement[];
  elementReplacement?: CanvasElement;
}

export interface CanvasToolOutcome {
  success: boolean;
  tool: CanvasToolName;
  message: string;
  data?: Record<string, unknown>;
  effects?: CanvasToolEffects;
  error?: { code: string; message: string; field?: string };
}

const fail = (tool: CanvasToolName, code: string, message: string, field?: string): CanvasToolOutcome => ({
  success: false,
  tool,
  message,
  error: { code, message, field },
});

const text = (value: unknown, field: string, maxLength: number, required = true): string => {
  if (typeof value !== 'string' || (required && !value.trim())) throw new Error(`${field} must be a non-empty string.`);
  if (value.length > maxLength) throw new Error(`${field} must be at most ${maxLength} characters.`);
  return value.trim();
};

const number = (value: unknown, field: string, min = -100000, max = 100000): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${field} must be a finite number between ${min} and ${max}.`);
  }
  return value;
};

const integer = (value: unknown, field: string, min: number, max: number): number => {
  const parsed = number(value, field, min, max);
  if (!Number.isInteger(parsed)) throw new Error(`${field} must be an integer.`);
  return parsed;
};

const readWindow = (input: Record<string, unknown>) => ({
  offset: input.offset === undefined ? 0 : integer(input.offset, 'offset', 0, 100000),
  limit: input.limit === undefined ? 5 : integer(input.limit, 'limit', 1, 10),
});

const compactUrl = (source?: string) => {
  if (!source) return undefined;
  if (source.startsWith('data:')) return { kind: 'embedded', value: null };
  try {
    const url = new URL(source);
    return { kind: url.protocol === 'https:' ? 'https' : 'other', value: `${url.origin}${url.pathname}`.slice(0, 240) };
  } catch {
    return { kind: 'invalid', value: null };
  }
};

const compactElement = (element: CanvasElement) => {
  const summary: Record<string, unknown> = {
    id: element.id,
    type: element.type,
    name: element.name.slice(0, 120),
    bounds: { x: element.x, y: element.y, width: element.w, height: element.h },
    zIndex: element.zIndex,
  };
  if (element.rotation) summary.rotation = element.rotation;
  if (element.locked) summary.locked = true;
  if (element.layoutSlot) {
    summary.layoutSlot = {
      templateId: element.layoutSlot.templateId.slice(0, 160),
      templateSlotId: element.layoutSlot.templateSlotId.slice(0, 120),
      role: element.layoutSlot.role,
    };
  }
  if (element.type === 'text') {
    const content = richTextToPlainText(element.content || '');
    summary.text = {
      preview: content.slice(0, 160),
      truncated: content.length > 160,
      style: element.textStyle ? {
        fontSize: element.textStyle.fontSize,
        fontWeight: element.textStyle.fontWeight?.slice(0, 40),
        fontFamily: element.textStyle.fontFamily?.slice(0, 80),
        fontStyle: element.textStyle.fontStyle,
        textAlign: element.textStyle.textAlign,
        color: element.textStyle.color?.slice(0, 64),
        lineHeight: element.textStyle.lineHeight,
      } : null,
    };
  } else if (element.type === 'image') {
    summary.image = compactUrl(element.src);
  } else if (element.type === 'shape') {
    summary.shape = {
      shapeType: element.shapeType || 'rectangle',
      color: element.color?.slice(0, 64),
      strokeColor: element.strokeColor?.slice(0, 64),
      strokeWidth: element.strokeWidth,
      pointCount: element.points?.length || 0,
    };
  } else if (element.type === 'path') {
    summary.path = {
      pointCount: element.points?.length || 0,
      strokeColor: element.strokeColor?.slice(0, 64),
      strokeWidth: element.strokeWidth,
    };
  } else if (element.type === 'table' && element.tableData) {
    summary.table = { rows: element.tableData.rows, cols: element.tableData.cols, headers: element.tableData.headers.slice(0, 10).map(value => value.slice(0, 80)) };
  } else if (element.type === 'mindmap') {
    summary.diagram = { hasMermaidCode: Boolean(element.mermaidCode), sourceLength: element.mermaidCode?.length || 0 };
  } else if (element.type === 'math') {
    const formula = element.content || '';
    summary.math = { preview: formula.slice(0, 160), truncated: formula.length > 160 };
  } else if (element.type === 'p5' && element.p5Data) {
    summary.sketch = {
      topic: element.p5Data.topic?.slice(0, 160),
      modelUsed: element.p5Data.modelUsed,
      codeLength: element.p5Data.code.length,
    };
  } else if (element.type === 'geogebra' && element.geogebraData) {
    summary.geogebra = {
      topic: element.geogebraData.topic?.slice(0, 160),
      appType: element.geogebraData.appType,
      codeLength: element.geogebraData.code.length,
      hasSavedState: Boolean(element.geogebraData.base64State),
    };
  } else if (element.type === 'figure') {
    const caption = richTextToPlainText(element.content || '');
    summary.figure = { preview: caption.slice(0, 160), truncated: caption.length > 160 };
  }
  return summary;
};

type BoardBounds = { x: number; y: number; width: number; height: number };
type BoardSummary = {
  id: string;
  name: string;
  isPrimary: boolean;
  active: boolean;
  bounds: BoardBounds;
  config: Record<string, unknown>;
};

const containsPoint = (bounds: BoardBounds, x: number, y: number) =>
  x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;

const fullyContainsElement = (bounds: BoardBounds, element: CanvasElement) =>
  element.x >= bounds.x
  && element.y >= bounds.y
  && element.x + element.w <= bounds.x + bounds.width
  && element.y + element.h <= bounds.y + bounds.height;

const getBoardState = (context: CanvasToolExecutionContext) => {
  const effectiveWidth = context.canvasConfig.isFlipbook ? context.canvasConfig.width * 2 : context.canvasConfig.width;
  const primaryBounds = { x: 0, y: 0, width: effectiveWidth, height: context.canvasConfig.height };
  const primary: BoardSummary = {
    id: 'primary',
    name: 'Main Board',
    isPrimary: true,
    active: context.activeBoardId === null,
    bounds: primaryBounds,
    config: {
      backgroundColor: context.canvasConfig.backgroundColor,
      borderRadius: context.canvasConfig.borderRadius,
      showGrid: context.canvasConfig.showGrid,
      gridRows: context.canvasConfig.gridRows,
      gridCols: context.canvasConfig.gridCols,
      showGuides: context.canvasConfig.showGuides,
      bleed: context.canvasConfig.bleed,
    },
  };
  const secondaryElements = context.elements.filter(element => element.type === 'container');
  const secondary = secondaryElements.map(element => ({
    id: element.id,
    name: element.name.slice(0, 120),
    isPrimary: false,
    active: context.activeBoardId === element.id,
    bounds: { x: element.x, y: element.y, width: element.w, height: element.h },
    config: {
      backgroundColor: element.boardConfig?.backgroundColor || element.color,
      borderRadius: element.boardConfig?.borderRadius,
      showGrid: element.boardConfig?.showGrid,
      gridRows: element.boardConfig?.gridRows,
      gridCols: element.boardConfig?.gridCols,
      showGuides: element.boardConfig?.showGuides,
      bleed: element.boardConfig?.bleed,
    },
  } satisfies BoardSummary));
  const boards = [primary, ...secondary];
  const objectsByBoard = new Map(boards.map(board => [board.id, [] as CanvasElement[]]));

  for (const element of context.elements) {
    if (element.type === 'container') continue;
    const centerX = element.x + element.w / 2;
    const centerY = element.y + element.h / 2;
    const owner = [...secondary].reverse().find(board => containsPoint(board.bounds, centerX, centerY))
      || (containsPoint(primaryBounds, centerX, centerY) ? primary : undefined);
    if (owner) objectsByBoard.get(owner.id)?.push(element);
  }

  return { boards, objectsByBoard };
};

const boundedPage = (base: Record<string, unknown>, items: Record<string, unknown>[], offset: number) => {
  const accepted: Record<string, unknown>[] = [];
  for (const item of items) {
    const candidate = { ...base, items: [...accepted, item], nextOffset: offset + accepted.length + 1 };
    if (JSON.stringify(candidate).length > 1400) break;
    accepted.push(item);
  }
  const consumed = accepted.length;
  return {
    ...base,
    items: accepted,
    truncated: offset + consumed < (base.total as number),
    nextOffset: offset + consumed < (base.total as number) ? offset + consumed : null,
  };
};

const validateMutation = (tool: CanvasToolName, input: Record<string, unknown>, context: CanvasToolExecutionContext) => {
  if (context.requireUiLock && !context.uiLocked) {
    return fail(tool, 'UI_NOT_LOCKED', 'Lock human editing with set_ui_lock before changing the canvas.');
  }
  const expected = integer(input.expectedRevision, 'expectedRevision', 0, Number.MAX_SAFE_INTEGER);
  if (expected !== context.revision) {
    return fail(tool, 'STALE_CANVAS', `Canvas revision is ${context.revision}; capture the canvas again before retrying.`, 'expectedRevision');
  }
  return expected;
};

const safeImageSource = (value: unknown) => {
  const source = text(value, 'src', 2048);
  const url = new URL(source);
  if (url.protocol !== 'https:') throw new Error('src must use HTTPS.');
  return source;
};

const elementSummary = (element: CanvasElement) => ({
  id: element.id,
  type: element.type,
  name: element.name,
  bounds: { x: element.x, y: element.y, width: element.w, height: element.h },
  ...(element.layoutSlot ? { layoutSlot: element.layoutSlot } : {}),
});

export const executeCanvasTool = async (
  tool: CanvasToolName,
  rawInput: unknown,
  context: CanvasToolExecutionContext,
  signal?: AbortSignal,
): Promise<CanvasToolOutcome> => {
  const input = rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput) ? rawInput as Record<string, unknown> : {};
  signal?.throwIfAborted();

  try {
    const definition = CANVAS_TOOL_CATALOG.find(entry => entry.name === tool);
    if (!definition) return fail(tool, 'UNKNOWN_TOOL', `No design tool named "${tool}" exists.`);
    const allowedProperties = new Set(Object.keys((definition.inputSchema.properties as Record<string, unknown> | undefined) || {}));
    const unexpectedProperty = Object.keys(input).find(property => !allowedProperties.has(property));
    if (unexpectedProperty) return fail(tool, 'INVALID_INPUT', `Unexpected parameter: ${unexpectedProperty}.`, unexpectedProperty);

    if (tool === 'list_tools') {
      return {
        success: true,
        tool,
        message: `${CANVAS_TOOL_CATALOG.length} design tools are available.`,
        data: {
          tools: CANVAS_TOOL_CATALOG.map(entry => ({ name: entry.name, mode: entry.annotations.readOnlyHint ? 'read' : 'write', ...(entry.deprecated ? { deprecated: true } : {}) })),
        },
      };
    }

    if (tool === 'describe_tools') {
      const name = text(input.name, 'name', 128) as CanvasToolName;
      const entry = CANVAS_TOOL_CATALOG.find(candidate => candidate.name === name);
      if (!entry) return fail(tool, 'UNKNOWN_TOOL', `No design tool named "${name}" exists.`, 'name');
      return {
        success: true,
        tool,
        message: `Description for ${name}.`,
        data: {
          name: entry.name,
          title: entry.title,
          description: entry.description,
          required: (entry.inputSchema.required as string[] | undefined) || [],
          parameters: Object.keys((entry.inputSchema.properties as Record<string, unknown> | undefined) || {}),
          readOnly: entry.annotations.readOnlyHint,
          untrustedOutput: entry.annotations.untrustedContentHint,
          deprecated: Boolean(entry.deprecated),
        },
      };
    }

    if (tool === 'get_canvas_text') {
      const { offset, limit } = readWindow(input);
      const allText = context.elements.filter(element => element.type === 'text');
      const items = allText.slice(offset, offset + limit).map(compactElement);
      return { success: true, tool, message: `Read ${items.length} text elements.`, data: boundedPage({ total: allText.length, offset }, items, offset) };
    }

    if (tool === 'capture_canvas') {
      const { offset, limit } = readWindow(input);
      const items = context.elements.slice(offset, offset + limit).map(compactElement);
      const { width, height, presetName, mode, isFlipbook } = context.canvasConfig;
      const effectiveWidth = isFlipbook ? width * 2 : width;
      return {
        success: true,
        tool,
        message: `Captured revision ${context.revision} of the active canvas page.`,
        data: boundedPage({
          revision: context.revision,
          page: { index: context.currentPage, count: context.pageCount },
          canvas: { width: effectiveWidth, height, presetName, mode, isFlipbook },
          selectedIds: context.selectedIds.slice(0, 5).map(id => id.slice(0, 120)),
          activeBoardId: context.activeBoardId?.slice(0, 120) || null,
          uiLocked: context.uiLocked,
          total: context.elements.length,
          offset,
        }, items, offset),
      };
    }

    if (tool === 'list_boards') {
      const { offset, limit } = readWindow(input);
      const { boards, objectsByBoard } = getBoardState(context);
      const items = boards.slice(offset, offset + limit).map(board => ({
        ...board,
        objectCount: objectsByBoard.get(board.id)?.length || 0,
      }));
      return {
        success: true,
        tool,
        message: `Read ${items.length} canvas boards.`,
        data: boundedPage({
          revision: context.revision,
          page: { index: context.currentPage, count: context.pageCount },
          total: boards.length,
          offset,
        }, items, offset),
      };
    }

    if (tool === 'inspect_board') {
      const boardId = text(input.boardId, 'boardId', 160);
      const { offset, limit } = readWindow(input);
      const { boards, objectsByBoard } = getBoardState(context);
      const board = boards.find(candidate => candidate.id === boardId);
      if (!board) {
        return fail(tool, 'BOARD_NOT_FOUND', `No board named "${boardId}" exists. Call list_boards and retry with one returned id.`, 'boardId');
      }
      const objects = objectsByBoard.get(board.id) || [];
      const items = objects.slice(offset, offset + limit).map(element => ({
        ...compactElement(element),
        partiallyOutside: !fullyContainsElement(board.bounds, element),
      }));
      return {
        success: true,
        tool,
        message: `Inspected ${items.length} objects in ${board.name}.`,
        data: boundedPage({
          revision: context.revision,
          board,
          total: objects.length,
          offset,
        }, items, offset),
      };
    }

    if (tool === 'list_layout_templates') {
      const { offset, limit } = readWindow(input);
      const library = getLayoutTemplates();
      const items = library.templates.slice(offset, offset + limit).map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        orientation: template.orientation,
        source: template.source,
        slotCount: template.slots.length,
      }));
      return {
        success: true,
        tool,
        message: `Read ${items.length} reusable layouts.`,
        data: boundedPage({ total: library.templates.length, offset, warning: library.error }, items, offset),
      };
    }

    if (tool === 'get_layout_template') {
      const templateId = text(input.templateId, 'templateId', 160);
      const library = getLayoutTemplates();
      const template = library.templates.find(candidate => candidate.id === templateId);
      if (!template) return fail(tool, 'UNKNOWN_TEMPLATE', `No layout template named "${templateId}" exists.`, 'templateId');
      return {
        success: true,
        tool,
        message: `Read ${template.name}.`,
        data: {
          id: template.id,
          name: template.name,
          description: template.description,
          orientation: template.orientation,
          source: template.source,
          slotCount: template.slots.length,
          slots: template.slots.map(templateSlot => ({
            id: templateSlot.id,
            name: templateSlot.name,
            bounds: { x: templateSlot.x, y: templateSlot.y, width: templateSlot.w, height: templateSlot.h },
          })),
          warning: library.error,
        },
      };
    }

    if (tool === 'set_ui_lock') {
      if (typeof input.locked !== 'boolean') return fail(tool, 'INVALID_INPUT', 'locked must be true or false.', 'locked');
      return {
        success: true,
        tool,
        message: input.locked ? 'Human editing is locked for agent work.' : 'Human editing is unlocked.',
        data: { locked: input.locked, autoUnlockMinutes: input.locked ? 5 : null },
        effects: { uiLocked: input.locked },
      };
    }

    if (tool === 'search_internet_images') {
      const query = text(input.query, 'query', 200);
      const results = await searchImages(query, signal);
      signal?.throwIfAborted();
      const compactResults = results.slice(0, 3).map(image => ({
        id: image.id,
        url: compactUrl(image.url)?.value,
        alt: image.alt.slice(0, 120),
        photographer: image.photographer.slice(0, 80),
      }));
      return {
        success: true,
        tool,
        message: results.length ? `Found ${results.length} images for "${query}".` : `No images found for "${query}".`,
        data: { query, resultCount: results.length, images: compactResults },
        effects: { imageSearchResults: results },
      };
    }

    if (tool === 'analyze_current_layout' || tool === 'suggest_improvements') {
      const focusArea = tool === 'analyze_current_layout'
        ? text(input.focusArea, 'focusArea', 40) as LayoutValidationFocus
        : 'all';
      if (tool === 'analyze_current_layout' && !['overlaps', 'spacing', 'balance', 'readability', 'all'].includes(focusArea)) {
        throw new Error('focusArea is not supported.');
      }
      const { boards, objectsByBoard } = getBoardState(context);
      const boardAnalyses = boards.map(board => {
        const layoutElements = (objectsByBoard.get(board.id) || []).map(element => ({
          ...element,
          x: element.x - board.bounds.x,
          y: element.y - board.bounds.y,
          description: 'Existing canvas element',
        }));
        const analysis = validateLayout(
          layoutElements as any,
          board.bounds.width,
          board.bounds.height,
          focusArea,
        );
        return analysis.issues.map(issue => `${board.name}: ${issue}`);
      });
      const allIssues = boardAnalyses.flat();
      const issues = allIssues.slice(0, 5).map(issue => issue.slice(0, 140));
      if (tool === 'analyze_current_layout') {
        return {
          success: true,
          tool,
          message: allIssues.length === 0 ? 'No deterministic layout issues found.' : `Found ${allIssues.length} layout issues.`,
          data: {
            focusArea,
            isValid: allIssues.length === 0,
            issueCount: allIssues.length,
            issues,
          },
        };
      }
      const improvementType = text(input.improvementType, 'improvementType', 40);
      if (!['spacing', 'alignment', 'hierarchy', 'balance', 'typography'].includes(improvementType)) throw new Error('improvementType is not supported.');
      return { success: true, tool, message: issues.length ? `Prepared ${issues.length} improvement suggestions.` : 'No deterministic improvements are required.', data: { improvementType, suggestions: issues.map(issue => `Resolve ${issue}`) } };
    }

    const expected = validateMutation(tool, input, context);
    if (typeof expected !== 'number') return expected;

    if (tool === 'add_board') {
      const effectiveWidth = context.canvasConfig.isFlipbook ? context.canvasConfig.width * 2 : context.canvasConfig.width;
      const rightmost = context.elements.length > 0
        ? Math.max(...context.elements.map(element => element.x + element.w))
        : 0;
      const x = input.x === undefined
        ? (rightmost > 0 ? rightmost + 100 : effectiveWidth + 100)
        : number(input.x, 'x');
      const y = input.y === undefined ? 0 : number(input.y, 'y');
      const width = input.width === undefined ? effectiveWidth : number(input.width, 'width', 0.1);
      const height = input.height === undefined ? context.canvasConfig.height : number(input.height, 'height', 0.1);
      const backgroundColor = input.backgroundColor === undefined
        ? '#ffffff'
        : text(input.backgroundColor, 'backgroundColor', 64);
      const secondaryBoardCount = context.elements.filter(element => element.type === 'container').length;
      const name = input.name === undefined ? `Board ${secondaryBoardCount + 2}` : text(input.name, 'name', 120);
      const board = createContainerBoard({
        name,
        x,
        y,
        w: width,
        h: height,
        color: backgroundColor,
        boardConfig: {
          backgroundColor,
          borderRadius: context.canvasConfig.borderRadius,
          showGrid: context.canvasConfig.showGrid,
          gridRows: context.canvasConfig.gridRows,
          gridCols: context.canvasConfig.gridCols,
          showGuides: context.canvasConfig.showGuides,
          bleed: context.canvasConfig.bleed,
        },
      });
      return {
        success: true,
        tool,
        message: `Added board ${board.name}.`,
        data: {
          board: {
            id: board.id,
            name: board.name,
            bounds: { x: board.x, y: board.y, width: board.w, height: board.h },
            config: board.boardConfig,
          },
        },
        effects: { expectedRevision: expected, elementToAdd: board },
      };
    }

    if (tool === 'load_layout_template') {
      const templateId = text(input.templateId, 'templateId', 160);
      const library = getLayoutTemplates();
      const template = library.templates.find(candidate => candidate.id === templateId);
      if (!template) return fail(tool, 'UNKNOWN_TEMPLATE', `No layout template named "${templateId}" exists.`, 'templateId');
      const targetBoard = context.activeBoardId
        ? context.elements.find(element => element.id === context.activeBoardId && element.type === 'container')
        : undefined;
      if (context.activeBoardId && !targetBoard) {
        return fail(tool, 'BOARD_NOT_FOUND', 'The selected board no longer exists. Capture the canvas and select a board again.');
      }
      const target = targetBoard
        ? { x: targetBoard.x, y: targetBoard.y, width: targetBoard.w, height: targetBoard.h }
        : {
            x: 0,
            y: 0,
            width: context.canvasConfig.isFlipbook ? context.canvasConfig.width * 2 : context.canvasConfig.width,
            height: context.canvasConfig.height,
          };
      const zIndexStart = context.elements.reduce((max, element) => Math.max(max, element.zIndex), 0) + 1;
      const layoutElements = instantiateLayoutTemplate(template, target, zIndexStart);
      const targetName = targetBoard?.name || 'main board';
      return {
        success: true,
        tool,
        message: `Added ${template.name} to ${targetName} without removing existing content.`,
        data: {
          templateId: template.id,
          pageIndex: context.currentPage,
          targetBoardId: targetBoard?.id || null,
          slotCount: layoutElements.length,
          slots: layoutElements.map(element => ({ elementId: element.id, name: element.name, templateSlotId: element.layoutSlot?.templateSlotId })),
          warning: library.error,
        },
        effects: { expectedRevision: expected, layoutElementsToAdd: layoutElements },
      };
    }

    if (tool === 'set_layout_slot_role') {
      const elementId = text(input.elementId, 'elementId', 160);
      const role = text(input.role, 'role', 20) as LayoutRole;
      if (!['text', 'image', 'table', 'math', 'diagram'].includes(role)) {
        return fail(tool, 'INVALID_INPUT', 'role must be text, image, table, math, or diagram.', 'role');
      }
      if (input.replaceContent !== undefined && typeof input.replaceContent !== 'boolean') {
        return fail(tool, 'INVALID_INPUT', 'replaceContent must be true or false.', 'replaceContent');
      }
      const element = context.elements.find(candidate => candidate.id === elementId);
      if (!element) return fail(tool, 'ELEMENT_NOT_FOUND', 'No matching slot element exists.', 'elementId');
      if (!element.layoutSlot) return fail(tool, 'NOT_LAYOUT_SLOT', 'The matching element is not a layout slot.', 'elementId');
      const replacement = assignLayoutSlotRole(element, role, input.replaceContent === true);
      return {
        success: true,
        tool,
        message: `Assigned ${role} to ${element.name}.`,
        data: { element: elementSummary(replacement) },
        effects: { expectedRevision: expected, elementReplacement: replacement },
      };
    }

    if (tool === 'add_element') {
      const elementType = text(input.elementType, 'elementType', 20) as 'text' | 'shape' | 'image';
      if (!['text', 'shape', 'image'].includes(elementType)) throw new Error('elementType must be text, shape, or image.');
      const element: CanvasElement = {
        id: crypto.randomUUID(),
        type: elementType,
        name: text(input.name, 'name', 120),
        x: number(input.x, 'x'), y: number(input.y, 'y'),
        w: number(input.width, 'width', 0.1), h: number(input.height, 'height', 0.1),
        color: typeof input.color === 'string' ? input.color.slice(0, 64) : '#e2e8f0',
        zIndex: context.elements.reduce((max, element) => Math.max(max, element.zIndex), 0) + 1,
      };
      if (elementType === 'text') element.content = sanitizeRichText(typeof input.content === 'string' ? input.content.slice(0, 4000) : 'New Text');
      if (elementType === 'image') element.src = safeImageSource(input.src);
      if (elementType === 'shape') {
        element.shapeType = (input.shapeType === undefined ? 'rectangle' : text(input.shapeType, 'shapeType', 64)) as ShapeType;
        if (Array.isArray(input.vertices)) {
          if (input.vertices.length > 100) throw new Error('vertices must contain at most 100 points.');
          element.points = input.vertices.map((vertex, index) => {
            if (!vertex || typeof vertex !== 'object' || Array.isArray(vertex)) throw new Error(`vertices[${index}] must be an object.`);
            const point = vertex as Record<string, unknown>;
            return { x: number(point.x, `vertices[${index}].x`), y: number(point.y, `vertices[${index}].y`) };
          });
        }
      }
      return { success: true, tool, message: `Added ${element.name}.`, data: { element: elementSummary(element) }, effects: { expectedRevision: expected, elementToAdd: element } };
    }

    if (tool === 'add_table') {
      const rows = integer(input.rows, 'rows', 1, 30);
      const cols = integer(input.cols, 'cols', 1, 20);
      const headers = Array.isArray(input.headers) ? input.headers.map((value, index) => text(value, `headers[${index}]`, 200)) : [];
      const data = Array.isArray(input.data) ? input.data.map((row, rowIndex) => {
        if (!Array.isArray(row)) throw new Error(`data[${rowIndex}] must be an array.`);
        return row.map((value, columnIndex) => text(value, `data[${rowIndex}][${columnIndex}]`, 500, false));
      }) : [];
      if (headers.length !== cols || data.length !== Math.max(0, rows - 1) || data.some(row => row.length !== cols)) {
        throw new Error('headers and every data row must match cols; data length must equal rows minus one.');
      }
      const element: CanvasElement = {
        id: crypto.randomUUID(), type: 'table', name: text(input.name, 'name', 120),
        x: number(input.x, 'x'), y: number(input.y, 'y'), w: number(input.width, 'width', 0.1), h: number(input.height, 'height', 0.1),
        color: '#ffffff', zIndex: context.elements.reduce((max, item) => Math.max(max, item.zIndex), 0) + 1,
        tableData: { rows, cols, headers, data },
      };
      return { success: true, tool, message: `Added table ${element.name}.`, data: { element: elementSummary(element) }, effects: { expectedRevision: expected, elementToAdd: element } };
    }

    if (tool === 'add_math') {
      const element: CanvasElement = {
        id: crypto.randomUUID(), type: 'math', name: text(input.name, 'name', 120),
        x: number(input.x, 'x'), y: number(input.y, 'y'), w: number(input.width, 'width', 0.1), h: number(input.height, 'height', 0.1),
        color: 'transparent', content: text(input.formula, 'formula', 2000),
        textStyle: input.fontSize === undefined ? undefined : { fontSize: number(input.fontSize, 'fontSize', 8, 200) },
        zIndex: context.elements.reduce((max, item) => Math.max(max, item.zIndex), 0) + 1,
      };
      return { success: true, tool, message: `Added formula ${element.name}.`, data: { element: elementSummary(element) }, effects: { expectedRevision: expected, elementToAdd: element } };
    }

    if (tool === 'remove_element') {
      const elementId = typeof input.elementId === 'string' ? input.elementId : '';
      const elementName = typeof input.elementName === 'string' ? input.elementName.trim().toLowerCase() : '';
      if (!elementId && !elementName) throw new Error('Provide elementId or elementName.');
      const matches = elementId
        ? context.elements.filter(element => element.id === elementId)
        : context.elements.filter(element => element.name.toLowerCase() === elementName);
      if (!matches.length) return fail(tool, 'ELEMENT_NOT_FOUND', 'No matching element exists.');
      if (matches.length > 1) return fail(tool, 'AMBIGUOUS_ELEMENT', 'Multiple elements have that name; retry with elementId.', 'elementName');
      const element = matches[0];
      return {
        success: true,
        tool,
        message: `Remove ${element.name} after human confirmation.`,
        data: { element: elementSummary(element), requiresConfirmation: true, reason: typeof input.reason === 'string' ? input.reason.slice(0, 300) : null },
        effects: { expectedRevision: expected, elementIdToRemove: element.id, removalReason: typeof input.reason === 'string' ? input.reason.slice(0, 300) : undefined },
      };
    }

    if (tool === 'generate_layout') {
      const description = text(input.layoutDescription, 'layoutDescription', 2000);
      const style = text(input.layoutStyle, 'layoutStyle', 200);
      const primaryElement = input.primaryElement === undefined ? '' : text(input.primaryElement, 'primaryElement', 200);
      const elementCount = input.elementCount === undefined ? undefined : integer(input.elementCount, 'elementCount', 1, 100);
      const generationPrompt = [
        description,
        `Visual style: ${style}`,
        primaryElement ? `Primary element: ${primaryElement}` : '',
        elementCount ? `Approximate element count: ${elementCount}` : '',
      ].filter(Boolean).join('\n');
      const { plan } = await generateLayoutPlan(context.elements, context.canvasConfig, generationPrompt, undefined, undefined, signal);
      signal?.throwIfAborted();
      plan.baseRevision = expected;
      return {
        success: true, tool, message: 'Generated a layout plan for human review.',
        data: { planId: plan.id, title: plan.title, elementCount: plan.elements.length, baseRevision: expected, requiresReview: true },
        effects: { expectedRevision: expected, pendingPlan: plan },
      };
    }

    if (tool === 'generate_diagram' || tool === 'generate_mind_map') {
      const prompt = tool === 'generate_diagram' ? text(input.prompt, 'prompt', 2000) : text(input.topic, 'topic', 2000);
      const requestedType = tool === 'generate_diagram' ? text(input.diagramType, 'diagramType', 40) as DiagramType : 'mindmap';
      if (!['mindmap', 'flowchart', 'sequenceDiagram', 'classDiagram', 'erDiagram', 'pie', 'requirementDiagram', 'auto'].includes(requestedType)) throw new Error('diagramType is not supported.');
      const result = await generateMindMapCode(prompt, requestedType, 3, signal);
      signal?.throwIfAborted();
      const diagramCode = sanitizeMermaidSource(result.code);
      const typeLabel = result.type === 'auto' ? result.type : (DIAGRAM_CONFIGS[result.type]?.label || result.type);
      return {
        success: true, tool, message: `Generated ${typeLabel}.`,
        data: { diagramType: result.type, sourceLength: diagramCode.length },
        effects: { expectedRevision: expected, diagramCode, diagramType: result.type },
      };
    }

    return fail(tool, 'NOT_IMPLEMENTED', `${tool} is not implemented.`);
  } catch (error: any) {
    if (error?.name === 'AbortError') throw error;
    console.error(`[CanvasTool:${tool}]`, error);
    if (error instanceof LayoutTemplateError) return fail(tool, error.code, error.message);
    return fail(tool, 'INVALID_INPUT', error?.message || 'The tool could not complete.');
  }
};
