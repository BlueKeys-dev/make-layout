export type JsonSchema = Record<string, unknown>;

export type CanvasToolName =
  | 'list_tools'
  | 'describe_tools'
  | 'get_canvas_text'
  | 'capture_canvas'
  | 'list_boards'
  | 'inspect_board'
  | 'list_layout_templates'
  | 'get_layout_template'
  | 'load_layout_template'
  | 'set_layout_slot_role'
  | 'set_ui_lock'
  | 'add_page'
  | 'configure_canvas'
  | 'zoom_canvas'
  | 'search_internet_images'
  | 'add_board'
  | 'add_element'
  | 'add_table'
  | 'add_math'
  | 'remove_element'
  | 'generate_layout'
  | 'analyze_current_layout'
  | 'suggest_improvements'
  | 'generate_diagram'
  | 'generate_mind_map';

export interface CanvasToolCatalogEntry {
  name: CanvasToolName;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  chatCallable?: boolean;
  deprecated?: boolean;
}

const emptyInput = { type: 'object', additionalProperties: false, properties: {} };
const expectedRevision = {
  type: 'integer',
  minimum: 0,
  description: 'Revision returned by capture_canvas. The write is rejected if the canvas changed.',
};
const coordinate = (description: string) => ({
  type: 'number',
  minimum: -100000,
  maximum: 100000,
  description,
});
const textStyleSchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  description: 'Optional typography for text elements. textStyle.color controls rendered text color.',
  properties: {
    fontSize: { type: 'number', minimum: 8, maximum: 200, description: 'Font size in pixels.' },
    fontWeight: { type: 'string', minLength: 1, maxLength: 40, description: 'CSS font weight such as normal, bold, or 700.' },
    fontFamily: { type: 'string', minLength: 1, maxLength: 80, description: 'CSS font family.' },
    fontStyle: { type: 'string', enum: ['normal', 'italic'], description: 'Normal or italic text.' },
    textAlign: { type: 'string', enum: ['left', 'center', 'right', 'justify'], description: 'Horizontal text alignment.' },
    color: { type: 'string', minLength: 1, maxLength: 64, description: 'CSS text color.' },
    lineHeight: { type: 'number', minimum: 0.1, maximum: 10, description: 'Unitless line-height multiplier.' },
  },
};

export const CANVAS_TOOL_CATALOG: CanvasToolCatalogEntry[] = [
  {
    name: 'list_tools',
    title: 'List design tools',
    description: 'Lists the design tools available on this page with their read, write, and deprecation status.',
    inputSchema: emptyInput,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'describe_tools',
    title: 'Describe design tools',
    description: 'Returns complete schemas and annotations for one or more exact tool names from list_tools.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['names'],
      properties: {
        names: {
          description: 'One tool name or an array of tool names returned by list_tools. At most 10 are described.',
          oneOf: [
            { type: 'string', enum: [] as string[] },
            { type: 'array', minItems: 1, items: { type: 'string', enum: [] as string[] } },
          ],
        },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'get_canvas_text',
    title: 'Read canvas text',
    description: 'Reads bounded plain-text previews and typography metadata from text elements on the active canvas page.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        offset: { type: 'integer', minimum: 0, default: 0, description: 'Zero-based text element offset.' },
        limit: { type: 'integer', minimum: 1, maximum: 10, default: 5, description: 'Maximum text elements returned.' },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    chatCallable: true,
  },
  {
    name: 'capture_canvas',
    title: 'Capture semantic canvas',
    description: 'Returns a bounded semantic snapshot of the active canvas page, including revision, dimensions, selection, and element metadata.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        offset: { type: 'integer', minimum: 0, default: 0, description: 'Zero-based element offset.' },
        limit: { type: 'integer', minimum: 1, maximum: 10, default: 5, description: 'Maximum elements returned.' },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    chatCallable: true,
  },
  {
    name: 'list_boards',
    title: 'List canvas boards',
    description: 'Lists the main board and secondary boards on the active page with bounded geometry, configuration, active state, and object counts.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        offset: { type: 'integer', minimum: 0, default: 0, description: 'Zero-based board offset.' },
        limit: { type: 'integer', minimum: 1, maximum: 10, default: 5, description: 'Maximum boards returned.' },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
  {
    name: 'inspect_board',
    title: 'Inspect canvas board',
    description: 'Returns bounded semantic details for objects owned by one board. Use list_boards to obtain a board id.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['boardId'],
      properties: {
        boardId: { type: 'string', minLength: 1, maxLength: 160, description: 'Board id returned by list_boards. Use primary for the main board.' },
        offset: { type: 'integer', minimum: 0, default: 0, description: 'Zero-based object offset.' },
        limit: { type: 'integer', minimum: 1, maximum: 10, default: 5, description: 'Maximum objects returned.' },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
  {
    name: 'list_layout_templates',
    title: 'List reusable layouts',
    description: 'Lists reusable layout templates with slot counts and compatibility for the active board. Use get_layout_template before loading a candidate.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        offset: { type: 'integer', minimum: 0, default: 0, description: 'Zero-based template offset.' },
        limit: { type: 'integer', minimum: 1, maximum: 10, default: 5, description: 'Maximum templates returned.' },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'get_layout_template',
    title: 'Inspect reusable layout',
    description: 'Returns normalized slot geometry and active-board compatibility for one reusable layout without changing the canvas.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['templateId'],
      properties: {
        templateId: { type: 'string', minLength: 1, maxLength: 160, description: 'Template id returned by list_layout_templates.' },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'load_layout_template',
    title: 'Load reusable layout',
    description: 'Adds empty slots from a compatible template to the selected board, or the main board when no secondary board is selected. Existing boards and canvas objects are preserved. Requires the UI lock and current revision.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['templateId', 'expectedRevision'],
      properties: {
        templateId: { type: 'string', minLength: 1, maxLength: 160, description: 'Template id returned by list_layout_templates.' },
        expectedRevision,
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'set_layout_slot_role',
    title: 'Assign layout slot role',
    description: 'Assigns text, image, table, math, or diagram content to a loaded layout slot while preserving its id and bounds. Set replaceContent only after the human explicitly approves replacing an assigned role.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['elementId', 'role', 'expectedRevision'],
      properties: {
        elementId: { type: 'string', minLength: 1, maxLength: 160, description: 'Slot element id returned by capture_canvas.' },
        role: { type: 'string', enum: ['text', 'image', 'table', 'math', 'diagram'], description: 'Content role to assign.' },
        replaceContent: { type: 'boolean', default: false, description: 'True only after explicit human approval to discard the current slot content.' },
        expectedRevision,
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'set_ui_lock',
    title: 'Lock or unlock editor UI',
    description: 'Locks human editing while an agent works, or unlocks it. The page always shows a manual unlock control and auto-unlocks after five minutes.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['locked'],
      properties: {
        locked: { type: 'boolean', description: 'True to lock human editing; false to unlock it.' },
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'add_page',
    title: 'Add workspace page',
    description: 'Adds one blank workspace page and makes it active. Lock the UI and capture the canvas first.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['expectedRevision'],
      properties: { expectedRevision },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'configure_canvas',
    title: 'Configure shared canvas',
    description: 'Atomically updates supplied shared canvas settings for every workspace page. Lock the UI and capture first.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['expectedRevision'],
      properties: {
        expectedRevision,
        width: { type: 'number', exclusiveMinimum: 0, maximum: 100000, description: 'Canvas width in points.' },
        height: { type: 'number', exclusiveMinimum: 0, maximum: 100000, description: 'Canvas height in points.' },
        mode: { type: 'string', enum: ['page', 'slide', 'custom'], description: 'Canvas aspect-ratio mode.' },
        presetName: { type: 'string', minLength: 1, maxLength: 120, description: 'Human-readable preset name.' },
        isFlipbook: { type: 'boolean', description: 'Whether the canvas displays a two-page spread.' },
        borderRadius: { type: 'number', minimum: 0, maximum: 100000, description: 'Canvas corner radius.' },
        backgroundColor: { type: 'string', minLength: 1, maxLength: 64, description: 'CSS canvas background color.' },
        bleed: { type: 'number', minimum: 0, maximum: 100000, description: 'Bleed size in points.' },
        showGuides: { type: 'boolean', description: 'Whether safe-area guides are visible.' },
        gridRows: { type: 'integer', minimum: 1, maximum: 1000, description: 'Grid row count.' },
        gridCols: { type: 'integer', minimum: 1, maximum: 1000, description: 'Grid column count.' },
        showGrid: { type: 'boolean', description: 'Whether the canvas grid is visible.' },
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'zoom_canvas',
    title: 'Zoom the viewport',
    description: 'Zooms the editing viewport in constant 0.1 scale steps, centered on the canvas. Does not change canvas content or revision. Lock the UI first.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['direction'],
      properties: {
        direction: { type: 'string', enum: ['in', 'out', 'reset'], description: 'Zoom in, zoom out, or reset to scale 1.' },
        steps: { type: 'integer', minimum: 1, maximum: 10, description: 'Number of constant 0.1 steps. Defaults to 1. Ignored for reset.' },
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'search_internet_images',
    title: 'Search licensed images',
    description: 'Searches the configured image provider and displays the results in the editor chat for the human and agent to review.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['query'],
      properties: { query: { type: 'string', minLength: 1, maxLength: 200, description: 'Concrete image search phrase.' } },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    chatCallable: true,
  },
  {
    name: 'add_board',
    title: 'Add canvas board',
    description: 'Adds and selects one secondary board using optional absolute geometry or safe defaults. Lock the UI and capture the canvas first.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['expectedRevision'],
      properties: {
        expectedRevision,
        name: { type: 'string', minLength: 1, maxLength: 120, description: 'Optional board name. Defaults to the next Board N name.' },
        x: coordinate('Optional absolute left position. Defaults to a safe position right of existing content.'),
        y: coordinate('Optional absolute top position. Defaults to zero.'),
        width: { type: 'number', exclusiveMinimum: 0, maximum: 100000, description: 'Optional board width. Defaults to the effective main-canvas width.' },
        height: { type: 'number', exclusiveMinimum: 0, maximum: 100000, description: 'Optional board height. Defaults to the main-canvas height.' },
        backgroundColor: { type: 'string', minLength: 1, maxLength: 64, description: 'Optional CSS background color. Defaults to white.' },
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
  },
  {
    name: 'add_element',
    title: 'Add canvas element',
    description: 'Adds one text, shape, or HTTPS image element at absolute canvas coordinates. Lock the UI and capture the canvas first.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['expectedRevision', 'elementType', 'name', 'x', 'y', 'width', 'height'],
      properties: {
        expectedRevision,
        elementType: { type: 'string', enum: ['text', 'shape', 'image'], description: 'Element kind to create.' },
        name: { type: 'string', minLength: 1, maxLength: 120, description: 'Short unique human-readable name.' },
        x: coordinate('Absolute left position in canvas points.'),
        y: coordinate('Absolute top position in canvas points.'),
        width: { type: 'number', exclusiveMinimum: 0, maximum: 100000, description: 'Element width in canvas points.' },
        height: { type: 'number', exclusiveMinimum: 0, maximum: 100000, description: 'Element height in canvas points.' },
        content: { type: 'string', maxLength: 4000, description: 'Text-element content only. Label shapes by adding a separate text element. Unsafe markup is removed.' },
        src: { type: 'string', maxLength: 2048, description: 'HTTPS image URL. Other URL schemes are rejected.' },
        color: { type: 'string', maxLength: 64, description: 'Element fill or background color. For rendered text color, use textStyle.color.' },
        textStyle: textStyleSchema,
        shapeType: { type: 'string', maxLength: 64, description: 'Existing shape identifier such as rectangle or circle.' },
        vertices: {
          type: 'array',
          maxItems: 100,
          description: 'Custom polygon vertices.',
          items: { type: 'object', additionalProperties: false, required: ['x', 'y'], properties: { x: coordinate('Vertex X.'), y: coordinate('Vertex Y.') } },
        },
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    chatCallable: true,
  },
  {
    name: 'add_table',
    title: 'Add table',
    description: 'Adds a bounded table to the visible canvas at absolute coordinates. Lock the UI and capture the canvas first.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      required: ['expectedRevision', 'name', 'x', 'y', 'width', 'height', 'rows', 'cols', 'headers', 'data'],
      properties: {
        expectedRevision,
        name: { type: 'string', minLength: 1, maxLength: 120, description: 'Short table name.' },
        x: coordinate('Absolute left position.'), y: coordinate('Absolute top position.'),
        width: { type: 'number', exclusiveMinimum: 0, maximum: 100000, description: 'Table width.' },
        height: { type: 'number', exclusiveMinimum: 0, maximum: 100000, description: 'Table height.' },
        rows: { type: 'integer', minimum: 1, maximum: 30, description: 'Total rows including the header.' },
        cols: { type: 'integer', minimum: 1, maximum: 20, description: 'Column count.' },
        headers: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 200 }, description: 'One header per column.' },
        data: { type: 'array', maxItems: 29, items: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 500 } }, description: 'Body rows matching cols.' },
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    chatCallable: true,
  },
  {
    name: 'add_math',
    title: 'Add math formula',
    description: 'Adds a KaTeX formula to the visible canvas. Trusted HTML commands are disabled. Lock the UI and capture first.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      required: ['expectedRevision', 'name', 'x', 'y', 'width', 'height', 'formula'],
      properties: {
        expectedRevision,
        name: { type: 'string', minLength: 1, maxLength: 120, description: 'Short formula name.' },
        x: coordinate('Absolute left position.'), y: coordinate('Absolute top position.'),
        width: { type: 'number', exclusiveMinimum: 0, maximum: 100000, description: 'Formula width.' },
        height: { type: 'number', exclusiveMinimum: 0, maximum: 100000, description: 'Formula height.' },
        formula: { type: 'string', minLength: 1, maxLength: 2000, description: 'LaTeX formula.' },
        fontSize: { type: 'number', minimum: 8, maximum: 200, description: 'Optional font size in pixels.' },
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    chatCallable: true,
  },
  {
    name: 'remove_element',
    title: 'Remove canvas element',
    description: 'Requests human confirmation, then removes one current element by ID or unambiguous name. Lock the UI and capture first.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['expectedRevision'],
      properties: {
        expectedRevision,
        elementId: { type: 'string', maxLength: 120, description: 'Preferred exact ID from capture_canvas.' },
        elementName: { type: 'string', maxLength: 120, description: 'Fallback name; duplicates are rejected.' },
        reason: { type: 'string', maxLength: 300, description: 'Short reason shown in confirmation.' },
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    chatCallable: true,
  },
  {
    name: 'generate_layout',
    title: 'Generate layout plan',
    description: 'Generates a complete layout plan for the current revision and opens the existing human review card without applying it.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['expectedRevision', 'layoutDescription', 'layoutStyle'],
      properties: {
        expectedRevision,
        layoutDescription: { type: 'string', minLength: 1, maxLength: 2000, description: 'Desired layout and content.' },
        layoutStyle: { type: 'string', minLength: 1, maxLength: 200, description: 'Visual style direction.' },
        primaryElement: { type: 'string', maxLength: 200, description: 'Optional main visual or content element.' },
        elementCount: { type: 'integer', minimum: 1, maximum: 100, description: 'Optional approximate element count.' },
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    chatCallable: true,
  },
  {
    name: 'analyze_current_layout',
    title: 'Analyze current layout',
    description: 'Checks current element bounds, spacing, overlaps, and text widths without changing the canvas.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['focusArea'],
      properties: { focusArea: { type: 'string', enum: ['overlaps', 'spacing', 'balance', 'readability', 'all'], description: 'Layout concern to emphasize.' } },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    chatCallable: true,
  },
  {
    name: 'suggest_improvements',
    title: 'Suggest layout improvements',
    description: 'Returns bounded actionable suggestions based on current deterministic layout checks without changing the canvas.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['improvementType'],
      properties: { improvementType: { type: 'string', enum: ['spacing', 'alignment', 'hierarchy', 'balance', 'typography'], description: 'Improvement category.' } },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    chatCallable: true,
  },
  {
    name: 'generate_diagram',
    title: 'Generate Mermaid diagram',
    description: 'Generates a safe Mermaid diagram and places it inside the active board. Lock the UI and capture the canvas first. The async auto-resizer may expand the diagram and bump the revision afterward; capture again for final geometry.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['expectedRevision', 'prompt', 'diagramType'],
      properties: {
        expectedRevision,
        prompt: { type: 'string', minLength: 1, maxLength: 2000, description: 'What to visualize.' },
        diagramType: { type: 'string', enum: ['mindmap', 'flowchart', 'sequenceDiagram', 'classDiagram', 'erDiagram', 'pie', 'requirementDiagram', 'auto'], description: 'Mermaid diagram type.' },
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    chatCallable: true,
  },
  {
    name: 'generate_mind_map',
    title: 'Generate mind map (deprecated)',
    description: 'Deprecated compatibility alias that generates and inserts a Mermaid mind map. Prefer generate_diagram.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['expectedRevision', 'topic'],
      properties: {
        expectedRevision,
        topic: { type: 'string', minLength: 1, maxLength: 2000, description: 'Mind-map topic.' },
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    chatCallable: true,
    deprecated: true,
  },
];

const toolNames = CANVAS_TOOL_CATALOG.map(tool => tool.name);
const describeTool = CANVAS_TOOL_CATALOG.find(tool => tool.name === 'describe_tools');
const describeNames = (describeTool?.inputSchema.properties as Record<string, any>)?.names;
if (describeNames?.oneOf) {
  describeNames.oneOf[0].enum = toolNames;
  describeNames.oneOf[1].items.enum = toolNames;
}

export const CHAT_CANVAS_TOOLS = CANVAS_TOOL_CATALOG.filter(tool => tool.chatCallable);

export const validateCanvasToolCatalog = () => {
  const seen = new Set<string>();
  for (const tool of CANVAS_TOOL_CATALOG) {
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(tool.name)) throw new Error(`Invalid WebMCP tool name: ${tool.name}`);
    if (tool.chatCallable && tool.name.length > 64) throw new Error(`Gemini tool name exceeds 64 characters: ${tool.name}`);
    if (!tool.description.trim() || tool.description.length > 500) throw new Error(`Invalid description for ${tool.name}`);
    if (seen.has(tool.name)) throw new Error(`Duplicate WebMCP tool name: ${tool.name}`);
    seen.add(tool.name);
  }
};
