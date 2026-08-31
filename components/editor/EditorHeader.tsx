import React, { useState, useRef } from 'react';
import { Download, ImageIcon, FileText, Presentation, FileJson, Upload } from 'lucide-react';
import { downloadAsPNG, downloadAsPDF, downloadAsPPTX, exportAsJSON } from '../../utils/exportUtils';
import { CanvasConfig, CanvasElement } from '../../types';

interface EditorHeaderProps {
  canvasRef: React.RefObject<HTMLDivElement>;
  canvasConfig: CanvasConfig;
  setCanvasConfig: (config: CanvasConfig) => void;
  pages: CanvasElement[][];
  setPages: (pages: CanvasElement[][]) => void;
  setCurrentPage: (page: number) => void;
  onShowPDFViewer: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  canvasRef,
  canvasConfig,
  setCanvasConfig,
  pages,
  setPages,
  setCurrentPage,
  onShowPDFViewer,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="absolute top-2 right-6 z-40 flex gap-3">
      <div className="relative">
        <button
          type="button"
          className="bg-white dark:bg-surface-dark hover:bg-gray-100 dark:hover:bg-gray-800 text-text-primary-light dark:text-text-primary-dark border border-border-light dark:border-border-dark p-2 rounded-lg shadow-lg transition-all flex items-center justify-center"
          onClick={() => setShowExportMenu(!showExportMenu)}
          title="Export"
          aria-label="Export"
        >
          <Download size={16} />
        </button>

        {showExportMenu && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-surface-dark rounded-xl shadow-xl border border-border-light dark:border-border-dark overflow-hidden flex flex-col p-1 animate-in fade-in slide-in-from-top-2">
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
          className="bg-primary hover:bg-primary-orange/80 text-white p-2 rounded-lg shadow-lg transition-all flex items-center justify-center"
          onClick={() => setShowImportMenu(!showImportMenu)}
          title="Import"
          aria-label="Import"
        >
          <Upload size={16} />
        </button>

        {showImportMenu && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-surface-dark rounded-xl shadow-xl border border-border-light dark:border-border-dark overflow-hidden flex flex-col p-1 animate-in fade-in slide-in-from-top-2">
            <button 
              className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-left text-sm transition-colors"
              onClick={() => { fileInputRef.current?.click(); }}
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
