import { CanvasElement, ElementType } from '../types';

/**
 * Element Registry & Factory
 * Centralizes the definition of new elements to ensure consistency.
 */

export const createElementFactory = (
  type: ElementType, 
  x: number, 
  y: number, 
  zIndex: number,
  // Optional specific properties
  shapeType?: any,
  points?: number[][] | {x: number, y: number}[]
): CanvasElement => {
  const id = Math.random().toString(36).substr(2, 9);
  
  const base: CanvasElement = {
    id,
    type,
    x,
    y,
    w: 200,
    h: 150,
    color: 'bg-transparent',
    zIndex,
    name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`
  };

  switch (type) {
    case 'text':
      return {
        ...base,
        w: 300,
        h: 60,
        content: 'Double click to edit text',
        textStyle: {
          fontSize: 16,
          fontWeight: 'normal',
          textAlign: 'center',
          color: '#111827'
        }
      };
    
    case 'image':
      return {
        ...base,
        w: 300,
        h: 300,
        color: 'bg-gray-100',
        name: 'Image Placeholder'
      };

    case 'shape':
      return {
        ...base,
        w: 150,
        h: 150,
        color: '#ef601eff', // Indigo 500
        name: shapeType ? shapeType.charAt(0).toUpperCase() + shapeType.slice(1) : 'Shape',
        shapeType: shapeType || 'rectangle',
        points: points // Assign initial vertex points if provided
      };

    case 'path':
      return {
        ...base,
        w: 200,
        h: 150,
        color: 'transparent',
        name: 'page',
        path: "M10 80 Q 50 10 90 80 T 180 80",
        strokeColor: "#ec5b13",
        strokeWidth: 4
      };

    case 'table':
      return {
        ...base,
        w: 400,
        h: 200,
        name: 'Data Table',
        tableData: {
          rows: 3,
          cols: 3,
          headers: ['Metric', 'Q1', 'Q2'],
          data: [
            ['Revenue', '$10k', '$12k'],
            ['Growth', '5%', '8%'],
            ['Users', '100', '150']
          ]
        }
      };

    case 'mindmap':
      return {
        ...base,
        w: 400,
        h: 300,
        name: 'Mind Map',
        mindMapData: {
          root: 'Central Idea',
          children: [
            { label: 'Branch A' },
            { label: 'Branch B' },
            { label: 'Branch C' }
          ]
        }
      };

    case 'geogebra':
      return {
        ...base,
        w: 500,
        h: 400,
        name: 'GeoGebra Animation',
        geogebraData: {
          code: '',
          appType: 'graphing'
        }
      };
    
    case 'figure':
      return {
        ...base,
        w: 300,
        h: 200,
        color: 'bg-slate-50',
        name: 'Figure 1.1',
        content: 'Figure Caption'
      };
      
    case 'container':
      return {
        ...base,
        w: 500,
        h: 500,
        color: 'bg-slate-100/50',
        name: 'Container'
      };

    default:
      return base;
  }
};

export const getElementDefaultSize = (type: ElementType) => {
  const temp = createElementFactory(type, 0, 0, 0);
  return { w: temp.w, h: temp.h };
};