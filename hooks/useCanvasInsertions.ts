import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CanvasConfig, CanvasElement, P5Data } from '../types';
import { createContainerBoard } from '../utils/elementRegistry';
import { getNextBoardX, getNextElementZIndex, placeElementInCanvas } from '../utils/canvasPlacement';
import type { SetCanvasElements } from './useCanvasPages';

type UseCanvasInsertionsOptions = {
  elements: CanvasElement[];
  activeBoardId: string | null;
  logicalWidth: number;
  logicalHeight: number;
  canvasConfig: CanvasConfig;
  scale: number;
  setElements: SetCanvasElements;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setSelectedBoardId: Dispatch<SetStateAction<string | 'primary'>>;
  setActiveTool: Dispatch<SetStateAction<string>>;
  setViewPos: Dispatch<SetStateAction<{ x: number; y: number }>>;
  closePdfViewer: () => void;
  closeMindMapGenerator: () => void;
  closeP5Generator: () => void;
};

export const useCanvasInsertions = ({
  elements,
  activeBoardId,
  logicalWidth,
  logicalHeight,
  canvasConfig,
  scale,
  setElements,
  setSelectedIds,
  setSelectedBoardId,
  setActiveTool,
  setViewPos,
  closePdfViewer,
  closeMindMapGenerator,
  closeP5Generator,
}: UseCanvasInsertionsOptions) => {
  const centerViewOn = useCallback((x: number, y: number) => {
    setViewPos({ x: -x * scale, y: -y * scale });
  }, [scale, setViewPos]);

  const createPdfElements = useCallback((text: string, pageNumber: number, x: number, index = 0) => {
    const y = 100;
    const board = createContainerBoard({
      x,
      y,
      w: 600,
      h: 800,
      color: '#ffffff',
      name: `PDF Page ${pageNumber}`,
      content: 'board',
      boardConfig: { backgroundColor: '#ffffff', gridCols: 12, gridRows: 12, showGrid: true },
    });
    const textElement: CanvasElement = {
      id: `text-${Date.now()}-${index}`,
      type: 'text',
      x: x + 40,
      y: y + 40,
      w: 500,
      h: 700,
      color: '#000000',
      zIndex: getNextElementZIndex(elements) + index,
      name: `Page ${pageNumber} Text`,
      content: text,
      textStyle: { fontSize: 14, fontFamily: 'Inter', textAlign: 'left', lineHeight: 1.5 },
    };
    return [board, textElement];
  }, [elements]);

  const handleAddPDFPage = useCallback((text: string, pageNumber: number) => {
    const boardX = getNextBoardX(elements, 100);
    const additions = createPdfElements(text, pageNumber, boardX);
    setElements(previous => [...previous, ...additions]);
    closePdfViewer();
    centerViewOn(boardX + 300, 500);
  }, [centerViewOn, closePdfViewer, createPdfElements, elements, setElements]);

  const handleAddAllPDFPages = useCallback((pdfPages: Array<{ text: string; pageNumber: number }>) => {
    const startX = getNextBoardX(elements, 100);
    const additions = pdfPages.flatMap((page, index) =>
      createPdfElements(page.text, page.pageNumber, startX + index * 700, index));
    setElements(previous => [...previous, ...additions]);
    closePdfViewer();
    if (additions.length > 0) centerViewOn(startX + 300, 500);
  }, [centerViewOn, closePdfViewer, createPdfElements, elements, setElements]);

  const handleInsertMindMap = useCallback((mermaidCode: string) => {
    closeMindMapGenerator();
    const size = { width: 400, height: 300 };
    const position = placeElementInCanvas({
      elements,
      activeBoardId,
      fallback: { width: logicalWidth, height: logicalHeight },
      size,
      avoidOverlap: true,
    });
    const element: CanvasElement = {
      id: crypto.randomUUID(),
      type: 'mindmap',
      name: 'Mind Map',
      ...position,
      w: size.width,
      h: size.height,
      zIndex: getNextElementZIndex(elements),
      color: 'transparent',
      mermaidCode,
    };
    setElements(previous => [...previous, element]);
    setSelectedIds([element.id]);
  }, [activeBoardId, closeMindMapGenerator, elements, logicalHeight, logicalWidth, setElements, setSelectedIds]);

  const handleInsertP5 = useCallback((p5Data: P5Data) => {
    closeP5Generator();
    const size = { width: 500, height: 400 };
    const position = placeElementInCanvas({
      elements,
      activeBoardId,
      fallback: { width: logicalWidth, height: logicalHeight },
      size,
    });
    const element: CanvasElement = {
      id: crypto.randomUUID(),
      type: 'p5',
      name: p5Data.topic || 'P5.js Animation',
      ...position,
      w: size.width,
      h: size.height,
      zIndex: getNextElementZIndex(elements),
      color: '#1a1a1a',
      p5Data,
    };
    setElements(previous => [...previous, element]);
    setSelectedIds([element.id]);
  }, [activeBoardId, closeP5Generator, elements, logicalHeight, logicalWidth, setElements, setSelectedIds]);

  const handleAddBoard = useCallback(() => {
    const rightmost = elements.length > 0
      ? Math.max(...elements.map(element => element.x + element.w))
      : 0;
    const boardX = rightmost > 0 ? rightmost + 100 : logicalWidth + 100;
    const board = createContainerBoard({
      name: `Board ${elements.filter(element => element.type === 'container').length + 2}`,
      x: boardX,
      y: 0,
      w: logicalWidth,
      h: logicalHeight,
      color: '#ffffff',
      boardConfig: {
        backgroundColor: '#ffffff',
        borderRadius: canvasConfig.borderRadius,
        showGrid: canvasConfig.showGrid,
        gridRows: canvasConfig.gridRows,
        gridCols: canvasConfig.gridCols,
        showGuides: canvasConfig.showGuides,
        bleed: canvasConfig.bleed,
      },
    });
    setElements(previous => [...previous, board]);
    centerViewOn(boardX + board.w / 2, board.h / 2);
    setSelectedIds([board.id]);
    setSelectedBoardId(board.id);
    setActiveTool('select');
  }, [canvasConfig, centerViewOn, elements, logicalHeight, logicalWidth, setActiveTool, setElements, setSelectedBoardId, setSelectedIds]);

  return { handleAddPDFPage, handleAddAllPDFPages, handleInsertMindMap, handleInsertP5, handleAddBoard };
};
