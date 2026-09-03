import React, { useState, useRef } from 'react';
import { Grid3X3, Maximize, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { CanvasElement, ElementType, CanvasConfig } from '../types';
import { INITIAL_ELEMENTS } from '../data';
import { InspectorPanel } from './InspectorPanel';
import { generateLayout } from '../services/gemini';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasElementRender } from './CanvasElementRender';

export const CanvasPrototype = () => {
  const [elements, setElements] = useState<CanvasElement[]>(INITIAL_ELEMENTS);
  const [showGrid, setShowGrid] = useState(true);
  const [showMargins, setShowMargins] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Canvas Scaling for Display
  const CANVAS_SCALE = 0.9;
  const LOGICAL_WIDTH = 595;
  const LOGICAL_HEIGHT = 842;

  const { 
    selectedIds,
    setSelectedIds,
    handleMouseDown, 
    handleMouseMove, 
    handleMouseUp, 
    mode 
  } = useCanvasInteraction(elements, setElements, CANVAS_SCALE);

  const selectedId = selectedIds[0] ?? null;
  const setSelectedId = (id: string | null) => setSelectedIds(id ? [id] : []);

  const selectedElement = elements.find(e => e.id === selectedId);

  // --- Element Management ---

  const handleAddElement = (type: ElementType) => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newElement: CanvasElement = {
      id: newId,
      type,
      x: LOGICAL_WIDTH / 2 - 75,
      y: LOGICAL_HEIGHT / 2 - 50,
      w: 150,
      h: 100,
      color: type === 'image' ? 'bg-emerald-500/20' : type === 'text' ? 'bg-sky-500/20' : 'bg-slate-500/20',
      zIndex: elements.length + 1,
      name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`
    };
    setElements([...elements, newElement]);
    setSelectedId(newId);
  };

  const handleRemoveElement = () => {
    if (selectedId) {
      setElements(elements.filter(e => e.id !== selectedId));
      setSelectedId(null);
    }
  };

  const handleUpdateElement = (id: string, updates: Partial<CanvasElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  // --- AI Layout ---

  const handleAutoLayout = async () => {
    if (elements.length === 0) return;
    
    setIsGenerating(true);
    setAiReasoning(null);
    try {
      const config: CanvasConfig = {
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
        mode: 'page',
        presetName: 'A4',
        isFlipbook: false,
        borderRadius: 0,
        backgroundColor: '#ffffff',
        bleed: 0,
        showGuides: showMargins,
        gridRows: 12,
        gridCols: 12,
        showGrid,
      };

      const result = await generateLayout(elements, config);
      
      if (result && result.elements) {
        setElements(prevElements => {
          return prevElements.map(el => {
            const update = result.elements.find((u: any) => u.id === el.id);
            if (update) {
              return {
                ...el,
                x: update.x ?? el.x,
                y: update.y ?? el.y,
                w: update.w ?? el.w,
                h: update.h ?? el.h,
                zIndex: update.zIndex ?? el.zIndex
              };
            }
            return el;
          });
        });
        if (result.reasoning) {
            setAiReasoning(result.reasoning);
        }
      }
    } catch (error) {
      console.error("Failed to generate layout", error);
      alert("Failed to generate layout. Please check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-900 text-slate-200" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* Canvas Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Top Bar */}
        <div className="h-12 border-b border-slate-700 bg-slate-800 flex items-center justify-between px-4 z-20">
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="text-slate-400">Canvas: </span>
            <span className="text-white">A4 / Print</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">DPI: </span>
            <span className="text-white">300</span>
          </div>
          <div className="flex items-center gap-2">
             <button 
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded hover:bg-slate-700 ${showGrid ? 'text-sky-400 bg-slate-700' : 'text-slate-400'}`}
              title="Toggle Grid"
            >
              <Grid3X3 size={16} />
            </button>
            <button 
              onClick={() => setShowMargins(!showMargins)}
              className={`p-1.5 rounded hover:bg-slate-700 ${showMargins ? 'text-sky-400 bg-slate-700' : 'text-slate-400'}`}
              title="Toggle Safe Zones"
            >
              <Maximize size={16} />
            </button>
            <button 
              onClick={handleAutoLayout}
              disabled={isGenerating || elements.length === 0}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold ml-4 transition-all
                ${isGenerating || elements.length === 0
                  ? 'bg-indigo-600/50 cursor-not-allowed text-indigo-200' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/20'
                }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  AI Auto-Layout
                </>
              )}
            </button>
          </div>
        </div>

        <div 
          className="flex-1 bg-slate-950 p-8 overflow-auto flex items-center justify-center relative flex-col"
          onMouseDown={() => setSelectedId(null)} // Deselect when clicking background
        >
           {/* Tools */}
           <CanvasToolbar 
              onAddElement={handleAddElement} 
              onRemoveElement={handleRemoveElement}
              hasSelection={!!selectedId}
           />

           {/* AI Reasoning Toast */}
           {aiReasoning && (
             <div className="absolute top-4 z-50 bg-indigo-900/90 border border-indigo-500/50 text-indigo-100 px-4 py-3 rounded-lg shadow-xl max-w-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-500">
               <div className="flex items-start gap-3">
                 <Sparkles className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
                 <div>
                   <p className="text-xs font-bold text-indigo-300 uppercase tracking-wide mb-1">Gemini Design Reasoning</p>
                   <p className="text-sm leading-relaxed">{aiReasoning}</p>
                 </div>
                 <button onClick={() => setAiReasoning(null)} className="text-indigo-400 hover:text-white ml-2">×</button>
               </div>
             </div>
           )}

           {/* Background Grid Pattern */}
           {showGrid && (
             <div 
               className="absolute inset-0 pointer-events-none opacity-20"
               style={{ 
                 backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)',
                 backgroundSize: '20px 20px'
               }}
             />
           )}

           {/* The Page */}
           <div 
             ref={canvasRef}
             className="relative bg-white shadow-2xl transition-all duration-300 ease-out origin-top"
             style={{ 
               width: LOGICAL_WIDTH, 
               height: LOGICAL_HEIGHT,
               transform: `scale(${CANVAS_SCALE})`
             }}
             onMouseDown={(e) => e.stopPropagation()} // Prevent deselection when clicking page
           >
             {/* Margins/Bleed Visual */}
             {showMargins && (
               <div className="absolute inset-0 border-[24px] border-red-500/10 pointer-events-none z-10">
                 <div className="absolute inset-0 border border-blue-500/30 m-8"></div>
               </div>
             )}

             {/* Elements */}
             {elements.map(el => (
               <CanvasElementRender
                 key={el.id}
                 element={el}
                 isSelected={selectedId === el.id}
                 onMouseDown={(e) => handleMouseDown(e, el.id)}
                 onResizeStart={(e, id, handle) => handleMouseDown(e, id, handle)}
               />
             ))}
           </div>
        </div>
      </div>

      <InspectorPanel 
        selectedElement={selectedElement} 
        onUpdateElement={handleUpdateElement}
      />
    </div>
  );
};
