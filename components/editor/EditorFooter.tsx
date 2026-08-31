import React from 'react';
import { ChevronLeft, ChevronRight, CopyPlus, Minus, Plus, Crosshair } from 'lucide-react';

interface EditorFooterProps {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number | ((p: number) => number)) => void;
  onAddPage: () => void;
  scale: number;
  setScale: (scale: number | ((s: number) => number)) => void;
  onRecenter?: () => void;
}

export const EditorFooter: React.FC<EditorFooterProps> = ({
  currentPage,
  totalPages,
  setCurrentPage,
  onAddPage,
  scale,
  setScale,
  onRecenter,
}) => {
  return (
    <div className="absolute bottom-1 sm:bottom-3 lg:bottom-4 left-2 sm:left-4 lg:left-6 z-40 flex items-center gap-1 sm:gap-1.5 lg:gap-1 bg-surface-light dark:bg-surface-dark p-0.5 sm:p-1 lg:p-2 rounded-lg lg:rounded-xl border border-border-light dark:border-border-dark shadow-floating-dark">
      <button
        onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
        className="p-0.5 sm:p-1 lg:p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        disabled={currentPage === 0}
        aria-label="Previous Page"
      >
        <ChevronLeft size={14} className="sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
      </button>
      <span className="text-[9px] sm:text-[10px] lg:text-[12px] font-mono whitespace-nowrap px-0.5 sm:px-1">
        <span className="hidden sm:inline">Pg </span>{currentPage + 1}/{totalPages}
      </span>
      <button
        onClick={onAddPage}
        className="p-0.5 sm:p-1 lg:p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        title="New Page"
        aria-label="Add New Page"
      >
        <CopyPlus size={14} className="sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
      </button>
      <button
        onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
        className="p-0.5 sm:p-1 lg:p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        disabled={currentPage === totalPages - 1}
        aria-label="Next Page"
      >
        <ChevronRight size={14} className="sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
      </button>
      <div className="w-px h-2.5 sm:h-3 lg:h-4 bg-gray-300 dark:bg-gray-600 mx-0.5 sm:mx-1 lg:mx-2" />
      <button
        onClick={() => setScale(s => Math.max(0.2, s - 0.1))}
        className="p-0.5 sm:p-1 lg:p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        <Minus size={12} className="sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4" />
      </button>
      <button
        onClick={onRecenter}
        className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 lg:px-2 py-0.5 sm:py-1 hover:bg-primary/10 dark:hover:bg-primary/20 rounded transition-colors group"
        title="Recenter View"
        aria-label="Recenter View"
      >
        <Crosshair size={10} className="sm:w-3 sm:h-3 lg:w-3.5 lg:h-3.5 text-text-secondary-light dark:text-text-secondary-dark group-hover:text-primary transition-colors" />
        <span className="text-[9px] sm:text-[10px] lg:text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark group-hover:text-primary transition-colors">
          {Math.round(scale * 100)}%
        </span>
      </button>
      <button
        onClick={() => setScale(s => Math.min(3, s + 0.1))}
        className="p-0.5 sm:p-1 lg:p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        title="Zoom In"
        aria-label="Zoom In"
      >
        <Plus size={12} className="sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4" />
      </button>
    </div>
  );
};
