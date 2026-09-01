export type JsonSchema = Record<string, unknown>;

export type CanvasToolName =
  | 'list_tools'
  | 'describe_tools'
  | 'get_canvas_text'
  | 'capture_canvas'
  | 'list_layout_templates'
  | 'get_layout_template'
  | 'load_layout_template'
  | 'set_layout_slot_role'
  | 'set_ui_lock'
  | 'search_internet_images'
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
    title: 'Describe a design tool',
    description: 'Returns the purpose, parameters, side effects, and usage notes for one named design tool.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['name'],
      properties: {
        name: { type: 'string', enum: [] as string[], description: 'Exact tool name returned by list_tools.' },
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
    name: 'list_layout_templates',
    title: 'List reusable layouts',
    description: 'Lists built-in and locally saved layout templates with orientation and slot-count summaries. Use get_layout_template before loading a candidate.',
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
    description: 'Returns normalized slot geometry for one reusable layout template without changing the canvas.',
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
    description: 'Appends a new page containing empty slots from a compatible template. Requires the UI lock and current revision; existing pages are preserved.',
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
        content: { type: 'string', maxLength: 4000, description: 'Text content. Unsafe markup is removed.' },
        src: { type: 'string', maxLength: 2048, description: 'HTTPS image URL. Other URL schemes are rejected.' },
        color: { type: 'string', maxLength: 64, description: 'CSS color value.' },
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
    description: 'Generates a safe Mermaid diagram and inserts it on the visible canvas. Lock the UI and capture the canvas first.',
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
const describeName = (describeTool?.inputSchema.properties as Record<string, any>)?.name;
if (describeName) describeName.enum = toolNames;

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
