import React from 'react';

export type Section = {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
};

export type ElementType = 'text' | 'image' | 'shape' | 'path' | 'table' | 'mindmap' | 'geogebra' | 'figure' | 'container' | 'math' | 'p5';

export type ShapeType = 
  | 'rectangle' | 'square' | 'circle' | 'triangle' | 'star' | 'polygon' 
  // Standard Geometric
  | 'parallelogram' | 'trapezium' | 'rhombus' | 'kite'
  // Polygons
  | 'pentagon' | 'hexagon' | 'heptagon' | 'octagon' | 'nonagon' | 'decagon' 
  // Specialized
  | 'arrow' | 'ring' | 'crescent' | 'heart' | 'semicircle' | 'minus' | 'plus' | 'pic' 
  | 'cloud' | 'lightning' | 'shield' | 'badge' | 'speech_bubble' | 'capsule' | 'cross_sign' | 'chevron' | 'flower' | 'wave'
  | 'right_triangle' | 'custom_polygon';

export type TextStyle = {
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
  lineHeight?: number;
};

export type BoardConfig = {
  backgroundColor?: string;
  borderRadius?: number;
  showGrid?: boolean;
  gridRows?: number;
  gridCols?: number;
  showGuides?: boolean;
  bleed?: number;
};

export type TableData = {
  rows: number;
  cols: number;
  headers: string[];
  data: string[][];
};

export type MindMapNode = {
  label: string;
  children?: MindMapNode[];
};

export type MindMapData = {
  root: string;
  children: MindMapNode[];
};

export type GeoGebraData = {
  code: string;           // GeoGebra commands
  topic?: string;         // User's original topic
  appType?: 'graphing' | 'geometry' | 'classic'; // App variant
  base64State?: string;   // Persisted applet state for faster reload
};

export type P5ModelProvider = 'gemini' | 'openrouter';

export type P5Data = {
  code: string;           // p5.js sketch code
  topic?: string;         // User's original topic/prompt
  modelUsed?: P5ModelProvider; // Which AI model generated the code
};

export type CanvasElement = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  zIndex: number;
  name: string;
  content?: string; // Can contain HTML now
  src?: string;

  // Shape specific properties
  shapeType?: ShapeType;
  
  // Path specific properties
  path?: string;
  points?: number[][] | { x: number, y: number }[]; // For perfect-freehand: [x, y, pressure], or Shape vertices: {x, y}
  strokeColor?: string;
  strokeWidth?: number;
  
  // Text specific properties
  textStyle?: TextStyle;

  // New Complex Data Types
  tableData?: TableData;
  mindMapData?: MindMapData;
  mermaidCode?: string;

  // Board-specific config (for 'container' type elements)
  boardConfig?: BoardConfig;

  // GeoGebra animation data
  geogebraData?: GeoGebraData;

  // P5.js animation data
  p5Data?: P5Data;

  // Transient state
  justCreated?: boolean;
};

export type AspectRatioMode = 'page' | 'slide' | 'custom';

export type CanvasConfig = {
  width: number;
  height: number;
  mode: AspectRatioMode;
  presetName: string; // e.g., 'A4', '16:9'
  isFlipbook: boolean;
  borderRadius: number;
  backgroundColor: string;
  bleed: number; // in points (e.g., 9 for 1/8 inch)
  showGuides: boolean;
  gridRows: number;
  gridCols: number;
  showGrid: boolean;
};

// =====================
// Chat & AI Types
// =====================

export type AIModelId = 'gemini-3.5-flash-preview' | 'gemini-3-pro-preview';

export type AIModel = {
  id: AIModelId;
  name: string;
  description: string;
  icon: string; // emoji or icon name
  specialization: 'layout' | 'analysis' | 'general';
};

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: number;
  modelId?: AIModelId;
  layoutPlan?: LayoutPlan; // Attached if AI proposes a layout
  imageSearchResults?: Array<{ id: string; url: string; thumbnail: string; alt: string; photographer: string }>; // Image search results
};

export type LayoutPlanElement = {
  id: string;
  type: ElementType;
  name: string;
  description: string;
  x: number;
  y: number;
  w: number;
  h: number;
  content?: string;
  src?: string;
  mermaidCode?: string;
  boardConfig?: BoardConfig;
  textStyle?: TextStyle;
  tableData?: TableData; // For table elements
  shapeType?: ShapeType; // For shape elements
  color?: string; // Shape fill color
  points?: { x: number; y: number }[]; // Custom polygon vertices
};

export type LayoutPlan = {
  id: string;
  title: string;
  description: string;
  elements: LayoutPlanElement[];
  reasoning: string;
  status: 'pending' | 'approved' | 'modified' | 'rejected';
};

export type ChatSession = {
  messages: ChatMessage[];
  activeModelId: AIModelId;
  pendingPlan: LayoutPlan | null;
  isGenerating: boolean;
};