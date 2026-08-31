import React from 'react';
import { 
  Type, 
  Image, 
  Table, 
  Network, 
  Box, 
  Frame, 
  PieChart, 
  PenTool,
  X
} from 'lucide-react';
import { ElementType } from '../types';

interface ElementCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: ElementType) => void;
  position?: { x: number, y: number };
}

export const ElementCreationDialog: React.FC<ElementCreationDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSelectType,
  position 
}) => {
  if (!isOpen) return null;

  const tools = [
    { type: 'text', label: 'Text Block', icon: <Type size={20} />, desc: 'Rich text area with typography controls.' },
    { type: 'image', label: 'Image', icon: <Image size={20} />, desc: 'Upload or paste images.' },
    { type: 'table', label: 'Table', icon: <Table size={20} />, desc: 'Structured data grid with rows/cols.' },
    { type: 'mindmap', label: 'Mind Map', icon: <Network size={20} />, desc: 'Node-based visualization.' },
    { type: 'shape', label: 'Shape', icon: <Box size={20} />, desc: 'Geometric primitives.' },
    { type: 'figure', label: 'Figure', icon: <PieChart size={20} />, desc: 'Chart or diagram placeholder.' },
    { type: 'container', label: 'Container', icon: <Frame size={20} />, desc: 'Group items together.' },
    { type: 'path', label: 'Drawing', icon: <PenTool size={20} />, desc: 'Freehand vector path.' },
  ];

  const style = position 
    ? { top: position.y, left: position.x, transform: 'translate(-50%, 0)' } 
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="absolute bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={position ? style : undefined}
      >
        <div className="flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-black/20">
          <h3 className="font-bold text-text-primary-light dark:text-text-primary-dark">Add Element</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X size={16} />
          </button>
        </div>
        
        <div className="p-2 grid grid-cols-1 gap-1 max-h-[60vh] overflow-y-auto">
          {tools.map((t) => (
            <button
              key={t.type}
              onClick={() => onSelectType(t.type as ElementType)}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 group transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                {t.icon}
              </div>
              <div>
                <div className="font-semibold text-sm text-text-primary-light dark:text-text-primary-dark group-hover:text-primary transition-colors">
                  {t.label}
                </div>
                <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  {t.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};