import type {
  CanvasElement,
  LayoutOrientation,
  LayoutRole,
  LayoutTemplate,
  LayoutTemplateSlot,
} from '../types.ts';
import { createElementFactory } from '../utils/elementRegistry.ts';

export const LAYOUT_TEMPLATE_STORAGE_KEY = 'ai-layout-templates-v1';

type CanvasSize = { width: number; height: number };

export class LayoutTemplateError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'LayoutTemplateError';
    this.code = code;
  }
}

const slot = (id: string, name: string, x: number, y: number, w: number, h: number): LayoutTemplateSlot => ({
  id, name, x, y, w, h,
});

export const BUILT_IN_LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    schemaVersion: 1, id: 'builtin:stacked-four', name: 'Stacked Four',
    description: 'Four equal horizontal content bands.', orientation: 'portrait', source: 'built-in',
    slots: [
      slot('band-1', 'Top', 0.08, 0.06, 0.84, 0.19),
      slot('band-2', 'Upper middle', 0.08, 0.28, 0.84, 0.19),
      slot('band-3', 'Lower middle', 0.08, 0.50, 0.84, 0.19),
      slot('band-4', 'Bottom', 0.08, 0.72, 0.84, 0.22),
    ],
  },
  {
    schemaVersion: 1, id: 'builtin:feature-stack', name: 'Feature Stack',
    description: 'Large feature area followed by two supporting bands.', orientation: 'portrait', source: 'built-in',
    slots: [
      slot('feature', 'Feature', 0.08, 0.06, 0.84, 0.39),
      slot('support', 'Support', 0.08, 0.48, 0.84, 0.22),
      slot('footer', 'Footer', 0.08, 0.73, 0.84, 0.21),
    ],
  },
  {
    schemaVersion: 1, id: 'builtin:sidebar-split', name: 'Sidebar Split',
    description: 'Two stacked areas with a tall right sidebar.', orientation: 'portrait', source: 'built-in',
    slots: [
      slot('main-top', 'Main top', 0.07, 0.07, 0.55, 0.40),
      slot('main-bottom', 'Main bottom', 0.07, 0.50, 0.55, 0.43),
      slot('sidebar', 'Sidebar', 0.65, 0.07, 0.28, 0.86),
    ],
  },
  {
    schemaVersion: 1, id: 'builtin:columns-footer', name: 'Columns and Footer',
    description: 'Two tall columns above a full-width footer.', orientation: 'portrait', source: 'built-in',
    slots: [
      slot('left', 'Left column', 0.08, 0.07, 0.40, 0.63),
      slot('right', 'Right column', 0.52, 0.07, 0.40, 0.63),
      slot('footer', 'Footer', 0.08, 0.73, 0.84, 0.20),
    ],
  },
  {
    schemaVersion: 1, id: 'builtin:hero-pair-footer', name: 'Hero, Pair, Footer',
    description: 'Wide hero, two supporting cards, and a footer.', orientation: 'portrait', source: 'built-in',
    slots: [
      slot('hero', 'Hero', 0.08, 0.06, 0.84, 0.33),
      slot('left-card', 'Left card', 0.08, 0.42, 0.40, 0.25),
      slot('right-card', 'Right card', 0.52, 0.42, 0.40, 0.25),
      slot('footer', 'Footer', 0.08, 0.70, 0.84, 0.24),
    ],
  },
  {
    schemaVersion: 1, id: 'builtin:header-columns', name: 'Header and Columns',
    description: 'Wide header above two equal columns.', orientation: 'portrait', source: 'built-in',
    slots: [
      slot('header', 'Header', 0.08, 0.06, 0.84, 0.31),
      slot('left', 'Left column', 0.08, 0.40, 0.40, 0.54),
      slot('right', 'Right column', 0.52, 0.40, 0.40, 0.54),
    ],
  },
  {
    schemaVersion: 1, id: 'builtin:showcase-grid', name: 'Showcase Grid',
    description: 'Large showcase, two compact cards, and a closing band.', orientation: 'portrait', source: 'built-in',
    slots: [
      slot('showcase', 'Showcase', 0.12, 0.08, 0.76, 0.35),
      slot('left-card', 'Left card', 0.12, 0.49, 0.29, 0.16),
      slot('right-card', 'Right card', 0.47, 0.49, 0.41, 0.16),
      slot('footer', 'Footer', 0.22, 0.74, 0.56, 0.16),
    ],
  },
  {
    schemaVersion: 1, id: 'builtin:banner-columns-footer', name: 'Banner Columns',
    description: 'Wide banner, asymmetric columns, and a closing band.', orientation: 'portrait', source: 'built-in',
    slots: [
      slot('banner', 'Banner', 0.08, 0.06, 0.84, 0.25),
      slot('main', 'Main', 0.08, 0.35, 0.56, 0.34),
      slot('side', 'Side', 0.68, 0.35, 0.24, 0.34),
      slot('footer', 'Footer', 0.08, 0.73, 0.84, 0.20),
    ],
  },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const finiteUnit = (value: unknown, field: string, allowZero: boolean) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1 || (!allowZero && value === 0)) {
    throw new LayoutTemplateError('INVALID_TEMPLATE', `${field} must be ${allowZero ? 'between 0 and 1' : 'greater than 0 and at most 1'}.`);
  }
  return value;
};

const boundedText = (value: unknown, field: string, maxLength: number) => {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new LayoutTemplateError('INVALID_TEMPLATE', `${field} must be a non-empty string of at most ${maxLength} characters.`);
  }
  return value.trim();
};

export const getLayoutOrientation = ({ width, height }: CanvasSize): LayoutOrientation => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new LayoutTemplateError('INVALID_CANVAS_SIZE', 'Canvas width and height must be positive numbers.');
  }
  if (Math.abs(width - height) < 0.001) return 'square';
  return width > height ? 'landscape' : 'portrait';
};

export const validateLayoutTemplate = (value: unknown): LayoutTemplate => {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new LayoutTemplateError('INVALID_TEMPLATE', 'Layout template schemaVersion must be 1.');
  }
  const orientation = value.orientation;
  const source = value.source;
  if (!['portrait', 'landscape', 'square'].includes(String(orientation))) {
    throw new LayoutTemplateError('INVALID_TEMPLATE', 'Layout template orientation is invalid.');
  }
  if (!['built-in', 'user'].includes(String(source))) {
    throw new LayoutTemplateError('INVALID_TEMPLATE', 'Layout template source is invalid.');
  }
  if (!Array.isArray(value.slots) || value.slots.length < 1 || value.slots.length > 50) {
    throw new LayoutTemplateError('MISSING_SLOTS', 'A layout template must contain between 1 and 50 slots.');
  }

  const seen = new Set<string>();
  const slots = value.slots.map((candidate, index): LayoutTemplateSlot => {
    if (!isRecord(candidate)) throw new LayoutTemplateError('INVALID_TEMPLATE', `slots[${index}] must be an object.`);
    const id = boundedText(candidate.id, `slots[${index}].id`, 120);
    if (seen.has(id)) throw new LayoutTemplateError('INVALID_TEMPLATE', `Duplicate slot id: ${id}.`);
    seen.add(id);
    const x = finiteUnit(candidate.x, `slots[${index}].x`, true);
    const y = finiteUnit(candidate.y, `slots[${index}].y`, true);
    const w = finiteUnit(candidate.w, `slots[${index}].w`, false);
    const h = finiteUnit(candidate.h, `slots[${index}].h`, false);
    if (x + w > 1.000001 || y + h > 1.000001) {
      throw new LayoutTemplateError('INVALID_TEMPLATE', `Slot ${id} extends outside the normalized canvas.`);
    }
    return { id, name: boundedText(candidate.name, `slots[${index}].name`, 120), x, y, w, h };
  });

  for (let left = 0; left < slots.length; left += 1) {
    for (let right = left + 1; right < slots.length; right += 1) {
      const a = slots[left];
      const b = slots[right];
      const overlaps = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      if (overlaps) throw new LayoutTemplateError('OVERLAPPING_SLOTS', `Slots ${a.id} and ${b.id} overlap.`);
    }
  }

  return {
    schemaVersion: 1,
    id: boundedText(value.id, 'id', 160),
    name: boundedText(value.name, 'name', 120),
    description: boundedText(value.description, 'description', 300),
    orientation: orientation as LayoutOrientation,
    source: source as 'built-in' | 'user',
    slots,
  };
};

const createEmptySlotElement = (
  template: LayoutTemplate,
  templateSlot: LayoutTemplateSlot,
  size: CanvasSize,
  zIndex: number,
): CanvasElement => ({
  id: crypto.randomUUID(),
  type: 'shape',
  name: templateSlot.name,
  x: templateSlot.x * size.width,
  y: templateSlot.y * size.height,
  w: templateSlot.w * size.width,
  h: templateSlot.h * size.height,
  color: 'transparent',
  strokeColor: '#38bdf8',
  strokeWidth: 1,
  shapeType: 'rectangle',
  snapToBox: true,
  zIndex,
  layoutSlot: {
    templateId: template.id,
    templateSlotId: templateSlot.id,
    role: null,
  },
});

export const instantiateLayoutTemplate = (templateValue: unknown, size: CanvasSize): CanvasElement[] => {
  const template = validateLayoutTemplate(templateValue);
  const orientation = getLayoutOrientation(size);
  if (template.orientation !== orientation) {
    throw new LayoutTemplateError(
      'INCOMPATIBLE_CANVAS_ORIENTATION',
      `${template.name} is ${template.orientation}; switch the canvas to ${template.orientation} before loading it.`,
    );
  }
  return template.slots.map((templateSlot, index) => createEmptySlotElement(template, templateSlot, size, index + 1));
};

const roleToElementType = (role: LayoutRole) => role === 'diagram' ? 'mindmap' : role;

export const assignLayoutSlotRole = (
  element: CanvasElement,
  role: LayoutRole | null,
  replaceContent = false,
): CanvasElement => {
  if (!element.layoutSlot) throw new LayoutTemplateError('NOT_LAYOUT_SLOT', 'The selected element is not a layout slot.');
  if (element.layoutSlot.role === role) return element;
  if (element.layoutSlot.role !== null && !replaceContent) {
    throw new LayoutTemplateError('SLOT_CONTENT_PRESENT', 'This slot already has content. Confirm replacement before changing its role.');
  }

  const metadata = { ...element.layoutSlot, role };
  if (role === null) {
    return {
      id: element.id, type: 'shape', name: element.name,
      x: element.x, y: element.y, w: element.w, h: element.h,
      color: 'transparent', strokeColor: '#38bdf8', strokeWidth: 1,
      shapeType: 'rectangle', snapToBox: true, zIndex: element.zIndex,
      layoutSlot: metadata,
    };
  }

  const next = createElementFactory(roleToElementType(role), element.x, element.y, element.zIndex);
  return {
    ...next,
    id: element.id,
    name: element.name,
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    zIndex: element.zIndex,
    ...(role === 'math' ? { content: 'x = y', color: 'transparent', textStyle: { fontSize: 32 } } : {}),
    layoutSlot: metadata,
  };
};

export const markElementAsLayoutSlot = (element: CanvasElement, slotName?: string): CanvasElement => {
  if (element.layoutSlot) return { ...element, name: slotName?.trim() || element.name };
  if (element.type !== 'shape' || (element.shapeType || 'rectangle') !== 'rectangle') {
    throw new LayoutTemplateError('INVALID_SLOT_ELEMENT', 'Only rectangle shapes can be marked as layout slots.');
  }
  return {
    ...element,
    name: slotName?.trim() || element.name,
    color: 'transparent',
    strokeColor: '#38bdf8',
    strokeWidth: 1,
    layoutSlot: { templateId: 'draft', templateSlotId: crypto.randomUUID(), role: null },
  };
};

export const unmarkLayoutSlot = (element: CanvasElement, replaceContent = false): CanvasElement => {
  if (!element.layoutSlot) return element;
  if (element.layoutSlot.role !== null && !replaceContent) {
    throw new LayoutTemplateError('SLOT_CONTENT_PRESENT', 'Clear or replace the slot content before removing its slot marker.');
  }
  const empty = assignLayoutSlotRole(element, null, replaceContent);
  const { layoutSlot: _layoutSlot, ...ordinaryShape } = empty;
  return { ...ordinaryShape, color: '#e2e8f0', strokeColor: undefined, strokeWidth: 0 };
};

export const createUserLayoutTemplate = (
  name: string,
  elements: CanvasElement[],
  size: CanvasSize,
): LayoutTemplate => {
  const marked = elements.filter(element => element.layoutSlot);
  if (!marked.length) throw new LayoutTemplateError('MISSING_SLOTS', 'Mark at least one rectangle as a layout slot before saving.');
  const template: LayoutTemplate = {
    schemaVersion: 1,
    id: `user:${crypto.randomUUID()}`,
    name: boundedText(name, 'name', 120),
    description: `Saved layout with ${marked.length} slot${marked.length === 1 ? '' : 's'}.`,
    orientation: getLayoutOrientation(size),
    source: 'user',
    slots: marked.map((element, index) => ({
      id: `slot-${index + 1}`,
      name: element.name || `Slot ${index + 1}`,
      x: element.x / size.width,
      y: element.y / size.height,
      w: element.w / size.width,
      h: element.h / size.height,
    })),
  };
  return validateLayoutTemplate(template);
};

type ReadableLayoutStorage = Pick<Storage, 'getItem'>;
type WritableLayoutStorage = Pick<Storage, 'setItem'>;

const browserStorage = () => typeof window === 'undefined' ? null : window.localStorage;

export const loadUserLayoutTemplates = (storage?: ReadableLayoutStorage | null) => {
  let raw: string | null;
  try {
    raw = (storage ?? browserStorage())?.getItem(LAYOUT_TEMPLATE_STORAGE_KEY) ?? null;
  } catch {
    return { templates: [] as LayoutTemplate[], error: 'Saved layouts could not be read and were skipped.' };
  }
  if (!raw) return { templates: [] as LayoutTemplate[], error: null as string | null };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new LayoutTemplateError('INVALID_TEMPLATE_STORAGE', 'Saved layout data is not an array.');
    const templates: LayoutTemplate[] = [];
    let skipped = 0;
    for (const candidate of parsed) {
      try {
        const template = validateLayoutTemplate(candidate);
        if (template.source !== 'user') throw new LayoutTemplateError('INVALID_TEMPLATE', 'Saved templates must use the user source.');
        templates.push(template);
      } catch {
        skipped += 1;
      }
    }
    return {
      templates,
      error: skipped ? `${skipped} corrupted saved layout${skipped === 1 ? ' was' : 's were'} skipped.` : null,
    };
  } catch {
    return { templates: [] as LayoutTemplate[], error: 'Saved layouts could not be read and were skipped.' };
  }
};

export const storeUserLayoutTemplates = (
  templates: LayoutTemplate[],
  storage?: WritableLayoutStorage | null,
) => {
  const validated = templates.map(validateLayoutTemplate);
  if (validated.some(template => template.source !== 'user')) {
    throw new LayoutTemplateError('INVALID_TEMPLATE', 'Only user layouts can be stored.');
  }
  const target = storage ?? browserStorage();
  if (!target) throw new LayoutTemplateError('STORAGE_UNAVAILABLE', 'Browser storage is unavailable.');
  target.setItem(LAYOUT_TEMPLATE_STORAGE_KEY, JSON.stringify(validated));
};

export const getLayoutTemplates = (storage?: ReadableLayoutStorage | null) => {
  const saved = loadUserLayoutTemplates(storage);
  return { templates: [...BUILT_IN_LAYOUT_TEMPLATES, ...saved.templates], error: saved.error };
};

export const deleteUserLayoutTemplate = (
  templateId: string,
  storage?: (ReadableLayoutStorage & WritableLayoutStorage) | null,
) => {
  if (!templateId.startsWith('user:')) throw new LayoutTemplateError('BUILT_IN_TEMPLATE', 'Built-in layouts cannot be deleted.');
  const loaded = loadUserLayoutTemplates(storage);
  storeUserLayoutTemplates(loaded.templates.filter(template => template.id !== templateId), storage);
};
