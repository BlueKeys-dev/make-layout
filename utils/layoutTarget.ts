import type { CanvasElement } from '../types';

export type LayoutTargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const resolveLayoutTargetRect = (
  elements: CanvasElement[],
  activeBoardId: string | null,
  fallback: { width: number; height: number },
): LayoutTargetRect => {
  const targetBoard = activeBoardId
    ? elements.find(element => element.id === activeBoardId && element.type === 'container')
    : undefined;

  if (activeBoardId && !targetBoard) {
    throw new Error('The selected board no longer exists. Select it again.');
  }

  return targetBoard
    ? { x: targetBoard.x, y: targetBoard.y, width: targetBoard.w, height: targetBoard.h }
    : { x: 0, y: 0, width: fallback.width, height: fallback.height };
};
