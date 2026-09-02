import type { CanvasElement } from '../types';
import { resolveLayoutTargetRect, type LayoutTargetRect } from './layoutTarget';

type ElementSize = { width: number; height: number };

const overlaps = (elements: CanvasElement[], x: number, y: number, size: ElementSize) =>
  elements.some(element => element.type !== 'container'
    && x < element.x + element.w
    && x + size.width > element.x
    && y < element.y + element.h
    && y + size.height > element.y);

const clampToTarget = (
  target: LayoutTargetRect,
  size: ElementSize,
  x: number,
  y: number,
  padding: number,
) => ({
  x: Math.max(target.x + padding, Math.min(x, target.x + target.width - size.width - padding)),
  y: Math.max(target.y + padding, Math.min(y, target.y + target.height - size.height - padding)),
});

export const getNextElementZIndex = (elements: CanvasElement[]) =>
  elements.reduce((maximum, element) => Math.max(maximum, element.zIndex), 0) + 1;

export const getNextBoardX = (elements: CanvasElement[], fallbackX: number, gap = 100) => {
  if (elements.length === 0) return fallbackX;
  return Math.max(...elements.map(element => element.x + element.w)) + gap;
};

export const placeElementAtViewportCenter = (
  viewPosition: { x: number; y: number },
  scale: number,
  viewport: ElementSize,
  size: ElementSize,
) => ({
  x: Math.round(-viewPosition.x + viewport.width / (2 * scale) - size.width / 2),
  y: Math.round(-viewPosition.y + viewport.height / (2 * scale) - size.height / 2),
});

export const placeElementInCanvas = ({
  elements,
  activeBoardId,
  fallback,
  size,
  padding = 20,
  avoidOverlap = false,
}: {
  elements: CanvasElement[];
  activeBoardId: string | null;
  fallback: ElementSize;
  size: ElementSize;
  padding?: number;
  avoidOverlap?: boolean;
}) => {
  const target = resolveLayoutTargetRect(elements, activeBoardId, fallback);
  const centered = clampToTarget(
    target,
    size,
    target.x + (target.width - size.width) / 2,
    target.y + (target.height - size.height) / 2,
    padding,
  );

  if (!avoidOverlap || !overlaps(elements, centered.x, centered.y, size)) {
    return { x: Math.round(centered.x), y: Math.round(centered.y) };
  }

  const offsets = [
    { x: 50, y: 50 }, { x: -50, y: 50 },
    { x: 50, y: -50 }, { x: -50, y: -50 },
    { x: 100, y: 0 }, { x: 0, y: 100 },
    { x: -100, y: 0 }, { x: 0, y: -100 },
  ];
  for (const offset of offsets) {
    const candidate = clampToTarget(
      target,
      size,
      centered.x + offset.x,
      centered.y + offset.y,
      padding,
    );
    if (!overlaps(elements, candidate.x, candidate.y, size)) {
      return { x: Math.round(candidate.x), y: Math.round(candidate.y) };
    }
  }

  return { x: Math.round(centered.x), y: Math.round(centered.y) };
};
