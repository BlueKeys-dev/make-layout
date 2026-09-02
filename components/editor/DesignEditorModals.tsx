import React from 'react';
import { AlertTriangle, Info, LockKeyhole, Unlock, X } from 'lucide-react';
import { SECTIONS } from '../../data';
import type { ElementType, P5Data, ShapeType } from '../../types';
import { AnimationHome } from '../animationhome';
import { ElementCreationDialog } from '../ElementCreationDialog';
import { MindMapGenerator } from '../MindMapGenerator';
import { P5Generator } from '../P5Generator';
import { PDFViewer } from '../PDFViewer';

export type ConfirmDeleteState = {
  isOpen: boolean;
  title: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

type PdfPage = { text: string; pageNumber: number };

type DesignEditorModalsProps = {
  isAddMenuOpen: boolean;
  onCloseAddMenu: () => void;
  onSelectElementType: (type: ElementType, shapeType?: ShapeType) => void;
  showDocs: boolean;
  onCloseDocs: () => void;
  confirmDelete: ConfirmDeleteState | null;
  onCloseConfirmDelete: () => void;
  isUiLocked: boolean;
  onUnlockUi: () => void;
  showPDFViewer: boolean;
  onClosePDFViewer: () => void;
  onAddPDFPage: (text: string, pageNumber: number) => void;
  onAddAllPDFPages: (pages: PdfPage[]) => void;
  isMindMapGeneratorOpen: boolean;
  onCloseMindMapGenerator: () => void;
  onInsertMindMap: (mermaidCode: string) => void;
  isAnimationHomeOpen: boolean;
  onCloseAnimationHome: () => void;
  isP5GeneratorOpen: boolean;
  onCloseP5Generator: () => void;
  onInsertP5: (p5Data: P5Data) => void;
};

export const DesignEditorModals = ({
  isAddMenuOpen,
  onCloseAddMenu,
  onSelectElementType,
  showDocs,
  onCloseDocs,
  confirmDelete,
  onCloseConfirmDelete,
  isUiLocked,
  onUnlockUi,
  showPDFViewer,
  onClosePDFViewer,
  onAddPDFPage,
  onAddAllPDFPages,
  isMindMapGeneratorOpen,
  onCloseMindMapGenerator,
  onInsertMindMap,
  isAnimationHomeOpen,
  onCloseAnimationHome,
  isP5GeneratorOpen,
  onCloseP5Generator,
  onInsertP5,
}: DesignEditorModalsProps) => (
  <>
    <ElementCreationDialog
      isOpen={isAddMenuOpen}
      onClose={onCloseAddMenu}
      onSelectType={onSelectElementType}
    />

    {showDocs && (
      <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-xl flex items-center justify-center p-6 md:p-20 animate-in fade-in duration-300" onClick={onCloseDocs}>
        <div
          className="bg-surface-dark/80 w-full max-w-5xl h-full max-h-[80vh] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row backdrop-blur-3xl animate-in zoom-in-95 duration-300"
          onClick={event => event.stopPropagation()}
        >
          <div className="w-full md:w-64 bg-black/20 border-b md:border-b-0 md:border-r border-white/5 p-6 flex flex-col gap-6">
            <div className="flex items-center gap-3 text-primary">
              <Info size={24} />
              <h2 className="text-xl font-bold tracking-tight">Help Center</h2>
            </div>
            <nav className="flex flex-col gap-1">
              {SECTIONS.map(section => (
                <button
                  key={section.id}
                  onClick={() => document.getElementById(`doc-section-${section.id}`)?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all truncate"
                >
                  {section.title}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 p-8 md:p-12 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {SECTIONS.map(section => (
              <section key={section.id} id={`doc-section-${section.id}`} className="mb-16 last:mb-0">
                <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2 group">
                  <span className="w-1 h-6 bg-primary rounded-full group-hover:h-8 transition-all" />
                  {section.title}
                </h3>
                <div className="text-slate-400 leading-relaxed text-lg whitespace-pre-line bg-white/5 p-6 rounded-2xl border border-white/5">
                  {section.content}
                </div>
              </section>
            ))}
          </div>

          <button
            onClick={onCloseDocs}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    )}

    {confirmDelete?.isOpen && (
      <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => { confirmDelete.onCancel?.(); onCloseConfirmDelete(); }}>
        <div
          className="bg-surface-dark w-full max-w-md rounded-3xl border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)] overflow-hidden animate-in zoom-in-95 duration-200"
          onClick={event => event.stopPropagation()}
        >
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Are you sure?</h3>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">{confirmDelete.title}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmDelete.onConfirm}
                className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-red-500/20 active:scale-[0.98]"
              >
                {confirmDelete.confirmLabel || 'Yes, Delete Permanently'}
              </button>
              <button
                onClick={() => { confirmDelete.onCancel?.(); onCloseConfirmDelete(); }}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-lg transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {isUiLocked && (
      <div className="fixed inset-0 z-[150] bg-slate-950/35 backdrop-blur-[2px] flex items-start justify-center pt-5">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-slate-950/95 px-5 py-3 text-amber-100 shadow-2xl">
          <LockKeyhole size={18} className="text-amber-400" />
          <div>
            <div className="text-sm font-bold">Agent UI lock is active</div>
            <div className="text-xs text-slate-400">Human editing is paused. This automatically unlocks after five minutes.</div>
          </div>
          <button
            onClick={onUnlockUi}
            className="ml-2 flex items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300"
          >
            <Unlock size={14} />
            Unlock
          </button>
        </div>
      </div>
    )}

    <div className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 md:p-12 transition-all duration-200 ${showPDFViewer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className={`bg-surface-dark w-full max-w-7xl h-full rounded-2xl border border-border-dark shadow-2xl overflow-hidden flex flex-col relative transition-all duration-200 ${showPDFViewer ? 'scale-100' : 'scale-95'}`}>
        <PDFViewer
          onClose={onClosePDFViewer}
          onAddToCanvas={onAddPDFPage}
          onAddAllToCanvas={onAddAllPDFPages}
        />
      </div>
    </div>

    {isMindMapGeneratorOpen && (
      <MindMapGenerator onClose={onCloseMindMapGenerator} onInsert={onInsertMindMap} />
    )}

    {isAnimationHomeOpen && (
      <div className="fixed inset-0 z-[100] animate-in fade-in duration-300 overflow-y-auto overflow-x-hidden bg-black/90">
        <AnimationHome onClose={onCloseAnimationHome} />
      </div>
    )}

    {isP5GeneratorOpen && (
      <P5Generator onClose={onCloseP5Generator} onInsert={onInsertP5} />
    )}
  </>
);
