import React from 'react';
import { Type, Image, Box, Trash2 } from 'lucide-react';
import { CanvasElement, ElementType } from '../types';

interface CanvasToolbarProps {
  onAddElement: (type: ElementType) => void;
  onRemoveElement: () => void;
  hasSelection: boolean;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({ 
  onAddElement, 
  onRemoveElement,
  hasSelection 
}) => {
  return (
    <div className="absolute left-4 top-20 flex flex-col gap-2 z-10">
      <div className="bg-slate-800 p-1.5 rounded-lg border border-slate-700 shadow-xl flex flex-col gap-1">
        <ToolButton 
          icon={<Type size={18} />} 
          label="Text" 
          onClick={() => onAddElement('text')} 
        />
        <ToolButton 
          icon={<Image size={18} />} 
          label="Image" 
          onClick={() => onAddElement('image')} 
        />
        <ToolButton 
          icon={<Box size={18} />} 
          label="Shape" 
          onClick={() => onAddElement('shape')} 
        />
      </div>

      {hasSelection && (
        <div className="bg-slate-800 p-1.5 rounded-lg border border-slate-700 shadow-xl mt-2 animate-in fade-in zoom-in-95 duration-200">
          <ToolButton 
            icon={<Trash2 size={18} />} 
            label="Remove" 
            onClick={onRemoveElement} 
            danger
          />
        </div>
      )}
    </div>
  );
};

const ToolButton = ({ 
  icon, 
  label, 
  onClick, 
  danger = false 
}: { 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void; 
  danger?: boolean; 
}) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-md transition-colors flex items-center justify-center group relative ${
      danger 
        ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300' 
        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
    }`}
    title={label}
  >
    {icon}
    <span className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-slate-200 text-xs rounded border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
      {label}
    </span>
  </button>
);
