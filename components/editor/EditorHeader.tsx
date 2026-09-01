import React, { useEffect, useRef, useState } from 'react';
import { Download, ImageIcon, FileText, Presentation, FileJson, Upload } from 'lucide-react';
import { downloadAsPNG, downloadAsPDF, downloadAsPPTX, exportAsJSON } from '../../utils/exportUtils';
import { CanvasConfig, CanvasElement } from '../../types';

interface EditorHeaderProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  canvasConfig: CanvasConfig;
  setCanvasConfig: (config: CanvasConfig) => void;
  pages: CanvasElement[][];
  setPages: (pages: CanvasElement[][]) => void;
  setCurrentPage: (page: number) => void;
  onShowPDFViewer: () => void;
  stackVertical?: boolean;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  canvasRef,
  canvasConfig,
  setCanvasConfig,
  pages,
  setPages,
  setCurrentPage,
  onShowPDFViewer,
  stackVertical = false,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const menuOpen = showExportMenu || showImportMenu;

  useEffect(() => {
    if (!menuOpen) return;

    const closeMenus = () => {
      setShowExportMenu(false);
      setShowImportMenu(false);
    };

    const closeOnOutside = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Node && headerRef.current?.contains(target)) return;
      closeMenus();
    };

    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenus();
    };

    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    const autoClose = window.setTimeout(closeMenus, 3000);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.clearTimeout(autoClose);
    };
  }, [menuOpen, showExportMenu, showImportMenu]);

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.pages && Array.isArray(data.pages)) {
          setPages(data.pages);
          setCurrentPage(0);
        }
        if (data.canvasConfig) {
          setCanvasConfig(data.canvasConfig);
        }
        alert('Project imported successfully!');
      } catch (err) {
        console.error(err);
        alert('Failed to import project. Invalid JSON.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowImportMenu(false);
  };

  return (
    <div ref={headerRef} className={`absolute top-2 right-6 z-40 flex gap-3 ${stackVertical ? 'flex-col' : 'flex-row'}`}>
      <div className="relative">
        <button
          type="button"
          className="w-10 h-10 rounded-full bg-white dark:bg-surface-dark hover:bg-gray-100 dark:hover:bg-gray-800 text-text-primary-light dark:text-text-primary-dark border border-border-light dark:border-border-dark shadow-lg transition-all flex items-center justify-center"
          onClick={() => {
            setShowExportMenu((open) => !open);
            setShowImportMenu(false);
          }}
          title="Export"
          aria-label="Export"
          aria-expanded={showExportMenu}
        >
          <Download size={18} />
        </button>

        {showExportMenu && (
          <div className={`bg-white dark:bg-surface-dark rounded-xl shadow-xl border border-border-light dark:border-border-dark overflow-hidden flex flex-col p-1 animate-in fade-in ${stackVertical ? 'absolute right-full top-0 mr-2 w-56 slide-in-from-right-2' : 'absolute right-0 top-full mt-2 w-56 slide-in-from-top-2'}`}>
            <button className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-left text-sm transition-colors"
              onClick={() => { downloadAsPNG(canvasRef); setShowExportMenu(false); }}
            >
              <div className="p-1.5 bg-blue-100 text-blue-600 rounded-md"><ImageIcon size={14} /></div>
              <span>Download as PNG</span>
            </button>

            <button className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-left text-sm transition-colors"
              onClick={() => { downloadAsPDF(canvasRef, canvasConfig); setShowExportMenu(false); }}
            >
              <div className="p-1.5 bg-red-100 text-red-600 rounded-md"><FileText size={14} /></div>
              <span>Download as PDF</span>
            </button>

            <button className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-left text-sm transition-colors"
              onClick={() => { downloadAsPPTX(canvasRef, canvasConfig); setShowExportMenu(false); }}
            >
              <div className="p-1.5 bg-orange-100 text-orange-600 rounded-md"><Presentation size={14} /></div>
              <span>Export as Slide (PPTX)</span>
            </button>

            <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />

            <button className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-left text-sm transition-colors"
              onClick={() => { exportAsJSON(pages, canvasConfig); setShowExportMenu(false); }}
            >
              <div className="p-1.5 bg-green-100 text-green-600 rounded-md"><FileJson size={14} /></div>
              <span>Save Project (JSON)</span>
            </button>
          </div>
        )}
      </div>

      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        className="hidden"
        onChange={handleImportJSON}
      />

      <div className="relative">
        <button
          type="button"
          className="w-10 h-10 rounded-full bg-primary hover:bg-primary-orange/80 text-white shadow-lg transition-all flex items-center justify-center"
          onClick={() => {
            setShowImportMenu((open) => !open);
            setShowExportMenu(false);
          }}
          title="Import"
          aria-label="Import"
          aria-expanded={showImportMenu}
        >
          <Upload size={18} />
        </button>

        {showImportMenu && (
          <div className={`bg-white dark:bg-surface-dark rounded-xl shadow-xl border border-border-light dark:border-border-dark overflow-hidden flex flex-col p-1 animate-in fade-in ${stackVertical ? 'absolute right-full top-0 mr-2 w-48 slide-in-from-right-2' : 'absolute right-0 top-full mt-2 w-48 slide-in-from-top-2'}`}>
            <button 
              className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-left text-sm transition-colors"
              onClick={() => { fileInputRef.current?.click(); setShowImportMenu(false); }}
            >
              <div className="p-1.5 bg-green-100 text-green-600 rounded-md"><FileJson size={14} /></div>
              <span>Import JSON</span>
            </button>

            <button 
              className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-left text-sm transition-colors"
              onClick={() => { onShowPDFViewer(); setShowImportMenu(false); }}
            >
              <div className="p-1.5 bg-red-100 text-red-600 rounded-md"><FileText size={14} /></div>
              <span>Import PDF</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
