import assert from 'node:assert/strict';
import test from 'node:test';
import { assignLayoutSlotRole, instantiateLayoutTemplate } from './layoutTemplates.ts';

const portraitTemplate = {
  schemaVersion: 1 as const,
  id: 'user:test-layout',
  name: 'Test layout',
  description: 'Two normalized slots',
  orientation: 'portrait' as const,
  source: 'user' as const,
  slots: [
    { id: 'hero', name: 'Hero', x: 0.1, y: 0.05, w: 0.8, h: 0.25 },
    { id: 'body', name: 'Body', x: 0.1, y: 0.35, w: 0.8, h: 0.55 },
  ],
};

test('instantiates normalized rectangles and assigns an empty slot without moving it', () => {
  const page = instantiateLayoutTemplate(portraitTemplate, { width: 600, height: 800 });

  assert.equal(page.length, 2);
  assert.deepEqual(
    { x: page[0].x, y: page[0].y, w: page[0].w, h: page[0].h },
    { x: 60, y: 40, w: 480, h: 200 },
  );
  assert.equal(page[0].type, 'shape');
  assert.deepEqual(page[0].layoutSlot, {
    templateId: 'user:test-layout',
    templateSlotId: 'hero',
    role: null,
  });

  const assigned = assignLayoutSlotRole(page[0], 'text');

  assert.equal(assigned.type, 'text');
  assert.equal(assigned.id, page[0].id);
  assert.deepEqual(
    { x: assigned.x, y: assigned.y, w: assigned.w, h: assigned.h },
    { x: 60, y: 40, w: 480, h: 200 },
  );
  assert.equal(assigned.layoutSlot?.role, 'text');
});

test('refuses to replace a filled slot unless replacement is explicit', () => {
  const emptySlot = instantiateLayoutTemplate(portraitTemplate, { width: 600, height: 800 })[0];
  const filledSlot = { ...assignLayoutSlotRole(emptySlot, 'text'), content: 'Keep me' };

  assert.throws(
    () => assignLayoutSlotRole(filledSlot, 'image'),
    (error: unknown) => error instanceof Error && (error as Error & { code?: string }).code === 'SLOT_CONTENT_PRESENT',
  );

  const replaced = assignLayoutSlotRole(filledSlot, 'image', true);
  assert.equal(replaced.type, 'image');
  assert.equal(replaced.content, undefined);
  assert.equal(replaced.layoutSlot?.role, 'image');
});
