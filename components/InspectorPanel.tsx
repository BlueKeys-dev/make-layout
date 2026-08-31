import React from 'react';
import { Settings, AlignLeft, Layers } from 'lucide-react';
import { CanvasElement } from '../types';

interface InspectorPanelProps {
  selectedElement: CanvasElement | undefined;
  onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({ 
  selectedElement,
  onUpdateElement
}) => {
  if (!selectedElement) {
    return (
      <div className="w-80 border-l border-slate-700 bg-slate-900 flex flex-col">
        <div className="p-4 border-b border-slate-700 font-medium text-sm flex items-center gap-2">
          <Settings size={16} className="text-sky-400" />
          Inspector
        </div>
        <div className="p-8 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
            <Layers size={20} />
          </div>
          Select an element on the canvas to inspect its properties.
        </div>
      </div>
    );
  }

  const handleChange = (field: keyof CanvasElement, value: string | number) => {
    onUpdateElement(selectedElement.id, { [field]: value });
  };

  return (
    <div className="w-80 border-l border-slate-700 bg-slate-900 flex flex-col">
      <div className="p-4 border-b border-slate-700 font-medium text-sm flex items-center gap-2">
        <Settings size={16} className="text-sky-400" />
        Inspector
      </div>
      
      <div className="p-4 space-y-6 overflow-y-auto">
        {/* Identity Section */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Identity</label>
          <div className="space-y-3">
             <div>
                <label className="text-xs text-slate-400 block mb-1">Name</label>
                <input 
                  type="text" 
                  value={selectedElement.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                />
             </div>
             <div className="grid grid-cols-2 gap-2">
                <div>
                   <label className="text-xs text-slate-400 block mb-1">ID</label>
                   <div className="bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1.5 text-xs font-mono text-slate-500 truncate">
                     {selectedElement.id}
                   </div>
                </div>
                <div>
                   <label className="text-xs text-slate-400 block mb-1">Type</label>
                   <div className="bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1.5 text-xs font-mono text-orange-400/80 uppercase">
                     {selectedElement.type}
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Geometry Section */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Geometry</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">X Position</label>
              <input 
                type="number" 
                value={Math.round(selectedElement.x)}
                onChange={(e) => handleChange('x', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Y Position</label>
              <input 
                type="number" 
                value={Math.round(selectedElement.y)}
                onChange={(e) => handleChange('y', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Width</label>
              <input 
                type="number" 
                value={Math.round(selectedElement.w)}
                onChange={(e) => handleChange('w', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Height</label>
              <input 
                type="number" 
                value={Math.round(selectedElement.h)}
                onChange={(e) => handleChange('h', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>
        
        {/* Layer Section */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Layering</label>
          <div className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700">
             <span className="text-xs text-slate-400">Z-Index</span>
             <input 
                type="number" 
                value={selectedElement.zIndex}
                onChange={(e) => handleChange('zIndex', Number(e.target.value))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm font-mono text-right focus:outline-none focus:border-sky-500"
              />
          </div>
        </div>

        {/* AI Metadata Preview */}
        <div>
           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">AI Context</label>
           <div className="p-3 bg-slate-950 rounded border border-slate-800 font-mono text-[10px] text-slate-400 leading-relaxed overflow-x-auto">
             {`{
  "id": "${selectedElement.id}",
  "aspect": ${(selectedElement.w / selectedElement.h).toFixed(2)},
  "area": ${Math.round(selectedElement.w * selectedElement.h)}
}`}
           </div>
        </div>

      </div>
    </div>
  );
};
