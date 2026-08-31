import React from 'react';
import { getStroke } from 'perfect-freehand';
import { CanvasElement } from '../types';

interface FreehandElementProps {
  element: CanvasElement;
}

const getSvgPathFromStroke = (stroke: number[][]) => {
  if (!stroke.length) return '';

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );

  d.push('Z');
  return d.join(' ');
};

export const FreehandElement: React.FC<FreehandElementProps> = ({ element }) => {
  const points = element.points || [];
  
  if (points.length === 0 && element.path) {
      // Fallback to legacy path rendering if points are missing but path string exists
      return (
           <div className="w-full h-full overflow-visible pointer-events-none">
              <svg viewBox={`0 0 ${element.w} ${element.h}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <path 
                  d={element.path} 
                  stroke={element.strokeColor || '#ec5b13'} 
                  strokeWidth={element.strokeWidth || 2}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
          </div>
      );
  }

  const stroke = getStroke(points, {
    size: element.strokeWidth || 4,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t) => t,
    start: {
      taper: 0,
      cap: true
    },
    end: {
      taper: 0,
      cap: true
    }
  });

  const pathData = getSvgPathFromStroke(stroke);

  return (
    <div className="w-full h-full overflow-visible pointer-events-none">
       <svg 
            // Absolute positioning of content
            style={{ overflow: 'visible' }}
            className="w-full h-full"
        >
          <path d={pathData} fill={element.strokeColor || '#ec5b13'} />
       </svg>
    </div>
  );
};
