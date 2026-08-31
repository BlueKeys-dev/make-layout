import React from 'react';
import { 
  Square, 
  Circle, 
  Triangle, 
  Star, 
  Hexagon, 
  Octagon, 
  ArrowRight, 
  Diamond,
  Heart,
  Minus,
  Plus,
  Cloud,
  Zap,
  Shield,
  Award,
  MessageSquare,
  X,
  ChevronRight,
  Flower2,
  Edit3
} from 'lucide-react';
import { ShapeType } from '../types';

export interface ShapeDefinition {
  id: ShapeType;
  label: string;
  icon: React.ReactNode;
  createInitialPoints: (w: number, h: number) => {x: number, y: number}[];
  getPath: (points: {x: number, y: number}[], w: number, h: number) => string;
  isClosed?: boolean;
}

// Helper to normalize coordinates (0-1 range based on w/h)
const norm = (points: number[][], w: number, h: number) => 
  points.map(([x, y]) => ({ x: x * w, y: y * h }));

export const fitPointsToBox = (
  points: { x: number; y: number }[],
  w: number,
  h: number
): { x: number; y: number }[] => {
  if (points.length === 0) return points;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  return points.map((p) => ({
    x: ((p.x - minX) / spanX) * w,
    y: ((p.y - minY) / spanY) * h,
  }));
};

export const SHAPES: Record<ShapeType, ShapeDefinition> = {
  // Basics
  rectangle: {
    id: 'rectangle',
    label: 'Rectangle',
    icon: <Square size={16} />,
    createInitialPoints: (w, h) => norm([[0, 0], [1, 0], [1, 1], [0, 1]], w, h),
    getPath: (pts) => `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y} L ${pts[2].x} ${pts[2].y} L ${pts[3].x} ${pts[3].y} Z`
  },
  square: { // Alias for rectangle with 1:1 constraint handled at creation if needed, but here just a rect
     id: 'rectangle',
     label: 'Square',
     icon: <Square size={16} />,
     createInitialPoints: (w, h) => norm([[0, 0], [1, 0], [1, 1], [0, 1]], w, h),
     getPath: (pts) => `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y} L ${pts[2].x} ${pts[2].y} L ${pts[3].x} ${pts[3].y} Z`
  },
  circle: {
    id: 'circle',
    label: 'Circle',
    icon: <Circle size={16} />,
    // For circle, points are bounding box corners usually, but for editable "vertices" we might use 4 control points
    createInitialPoints: (w, h) => norm([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], w, h),
    // Customizable logic: simple circle vs bezier path.
    // To allow "dragging vertices" to deform it, we use Q or C commands. 
    // Let's use 4 Quad curves for now to allow funky deformations
    getPath: (p) => {
       // A proper circle with 4 points is hard to approximate perfectly with lines through points.
       // We'll trust the user wants to deform it. 
       // Simplest 'blob' logic:
       return `M ${p[0].x} ${p[0].y} Q ${p[1].x} ${p[0].y} ${p[1].x} ${p[1].y} Q ${p[1].x} ${p[2].y} ${p[2].x} ${p[2].y} Q ${p[3].x} ${p[2].y} ${p[3].x} ${p[3].y} Q ${p[0].x} ${p[3].y} ${p[0].x} ${p[0].y} Z`.replace(/Q/g, 'L'); // Wait, L makes it a diamond.
       // Revert to Ellipse if points align? No, the requirement is "drag interactive".
       // Let's use a Cardinal Spline or smoothed polygon for "Circle" if we want it editable.
       // OR: Just return an ellipse command bounded by min/max of points?
       // The user image shows "CIRCLE" as a perfect circle.
       
       // BETTER APPROACH for "Circle":
       // Just render an ellipse that fits the bounding box of the points? 
       // Start with standard ellipse code, ignoring points for the *shape* itself if it's a rigid circle? 
       // BUT "vertices so user can click, drag".
       // So it implies the circle turns into a blob.
       // Let's use a path that smooths through the 4 points.
       return `M ${p[0].x} ${p[0].y} C ${p[0].x + (p[1].x-p[0].x)*0.55} ${p[0].y} ${p[1].x} ${p[1].y - (p[1].y-p[0].y)*0.55} ${p[1].x} ${p[1].y} C ${p[1].x} ${p[1].y + (p[2].y-p[1].y)*0.55} ${p[2].x + (p[1].x-p[2].x)*0.55} ${p[2].y} ${p[2].x} ${p[2].y} C ${p[2].x - (p[2].x-p[3].x)*0.55} ${p[2].y} ${p[3].x} ${p[3].y + (p[2].y-p[3].y)*0.55} ${p[3].x} ${p[3].y} C ${p[3].x} ${p[3].y - (p[3].y-p[0].y)*0.55} ${p[0].x - (p[3].x-p[0].x)*0.55} ${p[0].y} ${p[0].x} ${p[0].y} Z`;
    }
  },
  triangle: {
    id: 'triangle',
    label: 'Triangle',
    icon: <Triangle size={16} />,
    createInitialPoints: (w, h) => norm([[0.5, 0], [1, 1], [0, 1]], w, h),
    getPath: (p) => `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} L ${p[2].x} ${p[2].y} Z`
  },
  right_triangle: {
    id: 'right_triangle',
    label: 'Right Triangle',
    icon: <Triangle size={16} className="rotate-90"/>, // Approximation icon
    createInitialPoints: (w, h) => norm([[0, 0], [0, 1], [1, 1]], w, h),
    getPath: (p) => `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} L ${p[2].x} ${p[2].y} Z`
  },
  parallelogram: {
    id: 'parallelogram',
    label: 'Parallelogram',
    icon: <Square size={16} className="-skew-x-12"/>,
    createInitialPoints: (w, h) => norm([[0.25, 0], [1, 0], [0.75, 1], [0, 1]], w, h),
    getPath: (p) => `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} L ${p[2].x} ${p[2].y} L ${p[3].x} ${p[3].y} Z`
  },
  trapezium: {
    id: 'trapezium',
    label: 'Trapezium',
    icon: <Square size={16} style={{clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)'}}/>,
    createInitialPoints: (w, h) => norm([[0.25, 0], [0.75, 0], [1, 1], [0, 1]], w, h),
    getPath: (p) => `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} L ${p[2].x} ${p[2].y} L ${p[3].x} ${p[3].y} Z`
  },
  rhombus: {
    id: 'rhombus',
    label: 'Rhombus',
    icon: <Diamond size={16} />,
    createInitialPoints: (w, h) => norm([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], w, h),
    getPath: (p) => `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} L ${p[2].x} ${p[2].y} L ${p[3].x} ${p[3].y} Z`
  },
  kite: {
    id: 'kite',
    label: 'Kite',
    icon: <Diamond size={16} className="scale-y-125"/>,
    createInitialPoints: (w, h) => norm([[0.5, 0], [1, 0.3], [0.5, 1], [0, 0.3]], w, h),
    getPath: (p) => `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} L ${p[2].x} ${p[2].y} L ${p[3].x} ${p[3].y} Z`
  },
  pentagon: {
    id: 'pentagon',
    label: 'Pentagon',
    icon: <Hexagon size={16} />, // Close enough icon
    createInitialPoints: (w, h) => {
        // 5 points
        const pts = [];
        for(let i=0; i<5; i++) {
            const angle = (i * 2 * Math.PI / 5) - Math.PI/2;
            pts.push([0.5 + 0.5*Math.cos(angle), 0.5 + 0.5*Math.sin(angle)]);
        }
        return norm(pts, w, h);
    },
    getPath: (p) => `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} L ${p[2].x} ${p[2].y} L ${p[3].x} ${p[3].y} L ${p[4].x} ${p[4].y} Z`
  },
  hexagon: {
    id: 'hexagon',
    label: 'Hexagon',
    icon: <Hexagon size={16} />, 
    createInitialPoints: (w, h) => {
        const pts = [];
        for(let i=0; i<6; i++) {
            const angle = (i * 2 * Math.PI / 6) - Math.PI/2; // Start top
            pts.push([0.5 + 0.5*Math.cos(angle), 0.5 + 0.5*Math.sin(angle)]);
        }
        return norm(pts, w, h);
    },
    getPath: (p) => `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} L ${p[2].x} ${p[2].y} L ${p[3].x} ${p[3].y} L ${p[4].x} ${p[4].y} L ${p[5].x} ${p[5].y} Z`
  },
  heptagon: {
    id: 'heptagon',
    label: 'Heptagon',
    icon: <Hexagon size={16} />, 
    createInitialPoints: (w, h) => {
        const pts = [];
        for(let i=0; i<7; i++) {
            const angle = (i * 2 * Math.PI / 7) - Math.PI/2; 
            pts.push([0.5 + 0.5*Math.cos(angle), 0.5 + 0.5*Math.sin(angle)]);
        }
        return norm(pts, w, h);
    },
    getPath: (p) => p.map((pt, i) => (i===0 ? 'M' : 'L') + ` ${pt.x} ${pt.y}`).join(' ') + ' Z'
  },
  octagon: {
    id: 'octagon',
    label: 'Octagon',
    icon: <Octagon size={16} />, 
    createInitialPoints: (w, h) => {
        const pts = [];
        for(let i=0; i<8; i++) {
            const angle = (i * 2 * Math.PI / 8) - Math.PI/8; // Rotate to have flat top?
            // User image shows flat top/bottom.
            // 22.5 deg offset
            pts.push([0.5 + 0.5*Math.cos(angle - Math.PI/8), 0.5 + 0.5*Math.sin(angle - Math.PI/8)]);
        }
        return norm(pts, w, h);
    },
    getPath: (p) => p.map((pt, i) => (i===0 ? 'M' : 'L') + ` ${pt.x} ${pt.y}`).join(' ') + ' Z'
  },
  nonagon: {
    id: 'nonagon',
    label: 'Nonagon',
    icon: <Octagon size={16} />, 
    createInitialPoints: (w, h) => {
        const pts = [];
        for(let i=0; i<9; i++) {
            const angle = (i * 2 * Math.PI / 9) - Math.PI/2; 
            pts.push([0.5 + 0.5*Math.cos(angle), 0.5 + 0.5*Math.sin(angle)]);
        }
        return norm(pts, w, h);
    },
    getPath: (p) => p.map((pt, i) => (i===0 ? 'M' : 'L') + ` ${pt.x} ${pt.y}`).join(' ') + ' Z'
  },
  decagon: {
    id: 'decagon',
    label: 'Decagon',
    icon: <Octagon size={16} />, 
    createInitialPoints: (w, h) => {
        const pts = [];
        for(let i=0; i<10; i++) {
            const angle = (i * 2 * Math.PI / 10) - Math.PI/2; 
            pts.push([0.5 + 0.5*Math.cos(angle), 0.5 + 0.5*Math.sin(angle)]);
        }
        return norm(pts, w, h);
    },
    getPath: (p) => p.map((pt, i) => (i===0 ? 'M' : 'L') + ` ${pt.x} ${pt.y}`).join(' ') + ' Z'
  },
  star: {
     id: 'star',
     label: 'Star',
     icon: <Star size={16} />,
     createInitialPoints: (w, h) => {
         // 5 points outer, 5 inner
         const pts = [];
         const outerR = 0.5;
         const innerR = 0.25;
         for(let i=0; i<10; i++) {
             const r = i % 2 === 0 ? outerR : innerR;
             const angle = (i * Math.PI / 5) - Math.PI/2;
             pts.push([0.5 + r*Math.cos(angle), 0.5 + r*Math.sin(angle)]);
         }
         return norm(pts, w, h);
     },
     getPath: (p) => p.map((pt, i) => (i===0 ? 'M' : 'L') + ` ${pt.x} ${pt.y}`).join(' ') + ' Z'
  },
  arrow: {
      id: 'arrow',
      label: 'Arrow',
      icon: <ArrowRight size={16} />,
      createInitialPoints: (w, h) => norm([
          [0, 0.25], [0.6, 0.25], // Tail top
          [0.6, 0], [1, 0.5], // Head top, Tip
          [0.6, 1], [0.6, 0.75], // Head bottom, Tail bottom
          [0, 0.75]
      ], w, h),
      getPath: (p) => p.map((pt, i) => (i===0 ? 'M' : 'L') + ` ${pt.x} ${pt.y}`).join(' ') + ' Z'
  },
  plus: { // "Plus"
      id: 'plus',
      label: 'Plus',
      icon: <Plus size={16} />,
      createInitialPoints: (w, h) => norm([
          [0.35, 0], [0.65, 0], [0.65, 0.35], [1, 0.35],
          [1, 0.65], [0.65, 0.65], [0.65, 1], [0.35, 1],
          [0.35, 0.65], [0, 0.65], [0, 0.35], [0.35, 0.35]
      ], w, h),
      getPath: (p) => p.map((pt, i) => (i===0 ? 'M' : 'L') + ` ${pt.x} ${pt.y}`).join(' ') + ' Z'
  },
  polygon: {
    id: 'polygon',
    label: 'Polygon',
    icon: <Hexagon size={16} />,
    createInitialPoints: (w, h) => {
        // Pentagram default? Or Hexagon? Let's use Hexagon default.
        const pts = [];
        for(let i=0; i<6; i++) {
            const angle = (i * 2 * Math.PI / 6) - Math.PI/2; 
            pts.push([0.5 + 0.5*Math.cos(angle), 0.5 + 0.5*Math.sin(angle)]);
        }
        return norm(pts, w, h);
    },
     getPath: (p) => p.map((pt, i) => (i===0 ? 'M' : 'L') + ` ${pt.x} ${pt.y}`).join(' ') + ' Z'
  },
   minus: {
      id: 'minus',
      label: 'Minus',
      icon: <Minus size={16} />,
      createInitialPoints: (w, h) => norm([
          [0, 0.35], [1, 0.35], [1, 0.65], [0, 0.65]
      ], w, h),
      getPath: (p) => `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} L ${p[2].x} ${p[2].y} L ${p[3].x} ${p[3].y} Z`
  },
  ring: {
      id: 'ring',
      label: 'Ring',
      icon: <Circle size={16} className="border-4"/>,
      // 2 circles essentially.
      // But user drags vertices...
      // Let's implement as a path with a hole using winding rule.
      // Outer 8 pts, inner 8 pts.
      createInitialPoints: (w, h) => {
         const pts = [];
         // Outer
         for(let i=0; i<8; i++) {
             const a = (i * Math.PI / 4);
             pts.push([0.5 + 0.5*Math.cos(a), 0.5 + 0.5*Math.sin(a)]);
         }
         // Inner
         for(let i=0; i<8; i++) {
            const a = (i * Math.PI / 4);
            pts.push([0.5 + 0.3*Math.cos(a), 0.5 + 0.3*Math.sin(a)]);
        }
        return norm(pts, w, h);
      },
      getPath: (p) => { 
        // We only have one array of points. 0-7 outer, 8-15 inner.
        // Needs smooth curves.
        const outer = p.slice(0,8);
        const inner = p.slice(8,16);
        // Simple polygon approximation for now to support "vertices"
        // Or curve through them? The prompt asks for vertices you can drag.
        // A polygonal ring is better for draggable vertices unless we do bezier handles (too complex for this turn).
        const toPath = (arr: any[]) => arr.map((pt, i) => (i===0 ? 'M' : 'L') + ` ${pt.x} ${pt.y}`).join(' ') + ' Z';
        return toPath(outer) + ' ' + toPath(inner.reverse()); // Reverse inner for hole
      }
  },
  crescent: {
      id: 'crescent',
      label: 'Crescent',
      icon: <Circle size={16} style={{maskImage: 'linear-gradient(to right, black 50%, transparent 50%)'}}/>,
      // 2 Curves sharing tips.
      // 2 tips + 1 outer control + 1 inner control?
      // Let's use 6 points to define the shape roughly.
      createInitialPoints: (w, h) => norm([
          [0.1, 0.1], // Top Tip
          [0.5, 0], // Outer Top Control (approx)
          [0.9, 0.5], // Outer Middle
          [0.5, 1], // Outer Bottom Control
          [0.1, 0.9], // Bottom Tip
          [0.4, 0.5], // Inner Middle
      ], w, h),
      getPath: (p) => {
          return `M ${p[0].x} ${p[0].y} Q ${p[1].x} ${p[1].y} ${p[2].x} ${p[2].y} Q ${p[3].x} ${p[3].y} ${p[4].x} ${p[4].y} Q ${p[5].x} ${p[5].y} ${p[0].x} ${p[0].y} Z`;
      }
  },
  heart: {
      id: 'heart',
      label: 'Heart',
      icon: <Heart size={16} />,
      createInitialPoints: (w, h) => norm([
          [0.5, 0.25], // Center dip
          [0.2, 0], // Left lobe top
          [0, 0.3], // Left side
          [0.5, 1], // Bottom tip
          [1, 0.3], // Right side
          [0.8, 0], // Right lobe top
      ], w, h),
      getPath: (p) => {
          return `M ${p[0].x} ${p[0].y} 
                  C ${p[0].x} ${p[1].y} ${p[1].x} ${p[1].y} ${p[2].x} ${p[2].y}
                  C ${p[2].x} ${p[2].y+50} ${p[0].x} ${p[3].y-20} ${p[3].x} ${p[3].y}
                  C ${p[3].x} ${p[3].y-20} ${p[4].x} ${p[4].y+50} ${p[4].x} ${p[4].y}
                  C ${p[4].x} ${p[5].y} ${p[5].x} ${p[5].y} ${p[0].x} ${p[0].y} Z`;
          // The controls for bezier are hardcoded offsets here, but user can drag the MAIN points.
          // This is a simplification. Perfect mutable bezier requires handles.
          // We will just curve through the points.
      }
  },
  semicircle: {
      id: 'semicircle',
      label: 'Semicircle',
      icon: <div className="w-4 h-2 bg-current rounded-t-full"/>,
      createInitialPoints: (w, h) => norm([[0, 1], [1, 1], [1, 0.2], [0.5, 0], [0, 0.2]], w, h),
      getPath: (p) => `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} Q ${p[2].x} ${p[2].y} ${p[3].x} ${p[3].y} Q ${p[4].x} ${p[4].y} ${p[0].x} ${p[0].y} Z`
  },
  pic: {
      id: 'pic',
      label: 'Pacman',
      icon: <Circle size={16} style={{clipPath: 'polygon(100% 0%, 100% 100%, 50% 50%, 0% 100%, 0% 0%)'}}/>,
      createInitialPoints: (w, h) => norm([
          [0.5, 0.5], // Center
          [1, 0.2], // Mouth Top
          [0.5, 0], // Top
          [0, 0.5], // Back
          [0.5, 1], // Bottom
          [1, 0.8]  // Mouth Bottom
      ], w, h),
      getPath: (p) => {
         // Arc from p1 to p5, then L to p0, Z
         // We can approximate arc with curves through 2, 3, 4
         return `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} Q ${p[2].x} ${p[2].y} ${p[3].x} ${p[3].y} Q ${p[4].x} ${p[4].y} ${p[5].x} ${p[5].y} Z`;
      }
  },
  cloud: {
    id: 'cloud',
    label: 'Cloud',
    icon: <Cloud size={16} />,
    createInitialPoints: (w, h) => norm([
      [0.2, 0.8], [0.1, 0.5], [0.25, 0.2], [0.5, 0.1], [0.75, 0.2], [0.9, 0.5], [0.8, 0.8], [0.5, 0.9]
    ], w, h),
    getPath: (p) => `M ${p[0].x} ${p[0].y} C ${p[1].x-20} ${p[1].y-20} ${p[2].x-20} ${p[2].y-20} ${p[2].x} ${p[2].y} C ${p[3].x-10} ${p[3].y-30} ${p[4].x+10} ${p[4].y-30} ${p[4].x} ${p[4].y} C ${p[5].x+30} ${p[5].y-10} ${p[5].x+30} ${p[5].y+30} ${p[6].x} ${p[6].y} C ${p[7].x+10} ${p[7].y+20} ${p[0].x-10} ${p[0].y+20} ${p[0].x} ${p[0].y} Z`
  },
  lightning: {
    id: 'lightning',
    label: 'Lightning',
    icon: <Zap size={16} />,
    createInitialPoints: (w, h) => norm([
      [0.6, 0], [0.2, 0.5], [0.5, 0.5], [0.4, 1], [0.8, 0.5], [0.5, 0.5]
    ], w, h),
    getPath: (p) => `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} L ${p[2].x} ${p[2].y} L ${p[3].x} ${p[3].y} L ${p[4].x} ${p[4].y} L ${p[5].x} ${p[5].y} Z`
  },
  shield: {
    id: 'shield',
    label: 'Shield',
    icon: <Shield size={16} />,
    createInitialPoints: (w, h) => norm([
      [0.5, 0], [1, 0.1], [0.9, 0.7], [0.5, 1], [0.1, 0.7], [0, 0.1]
    ], w, h),
    getPath: (p) => `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} Q ${p[2].x} ${p[2].y} ${p[3].x} ${p[3].y} Q ${p[4].x} ${p[4].y} ${p[5].x} ${p[5].y} Z`
  },
  badge: {
    id: 'badge',
    label: 'Badge',
    icon: <Award size={16} />,
    createInitialPoints: (w, h) => {
      const pts = [];
      const outerR = 0.5;
      const innerR = 0.45;
      for(let i=0; i<24; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i * Math.PI / 12);
        pts.push([0.5 + r*Math.cos(a), 0.5 + r*Math.sin(a)]);
      }
      return norm(pts, w, h);
    },
    getPath: (p) => p.map((pt, i) => (i===0 ? 'M' : 'L') + ` ${pt.x} ${pt.y}`).join(' ') + ' Z'
  },
  speech_bubble: {
    id: 'speech_bubble',
    label: 'Speech Bubble',
    icon: <MessageSquare size={16} />,
    createInitialPoints: (w, h) => norm([
      [0, 0], [1, 0], [1, 0.7], [0.4, 0.7], [0.2, 1], [0.2, 0.7], [0, 0.7]
    ], w, h),
    getPath: (p) => `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} L ${p[2].x} ${p[2].y} L ${p[3].x} ${p[3].y} L ${p[4].x} ${p[4].y} L ${p[5].x} ${p[5].y} L ${p[6].x} ${p[6].y} Z`
  },
  capsule: {
    id: 'capsule',
    label: 'Capsule',
    icon: <div className="w-4 h-2 bg-current rounded-full"/>,
    createInitialPoints: (w, h) => norm([
      [0.2, 0.3], [0.8, 0.3], [1, 0.5], [0.8, 0.7], [0.2, 0.7], [0, 0.5]
    ], w, h),
    getPath: (p, w) => `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} Q ${p[2].x + (w*0.2)} ${p[2].y} ${p[3].x} ${p[3].y} L ${p[4].x} ${p[4].y} Q ${p[5].x - (w*0.2)} ${p[5].y} ${p[0].x} ${p[0].y} Z`
  },
  cross_sign: {
    id: 'cross_sign',
    label: 'Cross X',
    icon: <X size={16} />,
    createInitialPoints: (w, h) => norm([
      [0.1, 0], [0.5, 0.4], [0.9, 0], [1, 0.1], [0.6, 0.5], [1, 0.9], [0.9, 1], [0.5, 0.6], [0.1, 1], [0, 0.9], [0.4, 0.5], [0, 0.1]
    ], w, h),
    getPath: (p) => p.map((pt, i) => (i===0 ? 'M' : 'L') + ` ${pt.x} ${pt.y}`).join(' ') + ' Z'
  },
  chevron: {
    id: 'chevron',
    label: 'Chevron',
    icon: <ChevronRight size={16} />,
    createInitialPoints: (w, h) => norm([
      [0, 0], [0.5, 0.5], [0, 1], [0.3, 1], [0.8, 0.5], [0.3, 0]
    ], w, h),
    getPath: (p) => p.map((pt, i) => (i===0 ? 'M' : 'L') + ` ${pt.x} ${pt.y}`).join(' ') + ' Z'
  },
  flower: {
    id: 'flower',
    label: 'Flower',
    icon: <Flower2 size={16} />,
    createInitialPoints: (w, h) => {
      const pts = [];
      // 8 petals = 16 points (outer tip, inner dip)
      for(let i=0; i<16; i++) {
        const r = i % 2 === 0 ? 0.5 : 0.2;
        const a = (i * Math.PI / 8) - Math.PI/2;
        pts.push([0.5 + r*Math.cos(a), 0.5 + r*Math.sin(a)]);
      }
      return norm(pts, w, h);
    },
    getPath: (p) => {
      // Draw a smooth curve through tips and dips
      let d = `M ${p[0].x} ${p[0].y}`;
      for(let i=1; i<16; i+=2) {
        const next = (i + 1) % 16;
        d += ` Q ${p[i].x} ${p[i].y} ${p[next].x} ${p[next].y}`;
      }
      return d + ' Z';
    }
  },
  wave: {
    id: 'wave',
    label: 'Wave',
    icon: <div className="w-4 h-2 flex flex-col gap-0.5"><div className="w-full h-px bg-current rounded-full" style={{clipPath: 'polygon(0% 50%, 25% 0%, 50% 50%, 75% 100%, 100% 50%)'}}/><div className="w-full h-px bg-current rounded-full" style={{clipPath: 'polygon(0% 50%, 25% 0%, 50% 50%, 75% 100%, 100% 50%)'}}/></div>,
    createInitialPoints: (w, h) => norm([
      [0, 0.5], [0.25, 0.2], [0.5, 0.5], [0.75, 0.8], [1, 0.5], [1, 1], [0, 1]
    ], w, h),
    getPath: (p) => `M ${p[0].x} ${p[0].y} Q ${p[1].x} ${p[1].y} ${p[2].x} ${p[2].y} Q ${p[3].x} ${p[3].y} ${p[4].x} ${p[4].y} L ${p[5].x} ${p[5].y} L ${p[6].x} ${p[6].y} Z`
  },
  custom_polygon: {
    id: 'custom_polygon',
    label: 'Custom Polygon',
    icon: <Edit3 size={16} />,
    createInitialPoints: () => [], // User draws vertices manually
    getPath: (pts) => {
      if (pts.length < 3) return '';
      return `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + ' Z';
    }
  },
};
