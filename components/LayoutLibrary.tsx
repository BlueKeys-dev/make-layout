import React, { useState } from 'react';
import { LayoutDashboard, Plus, Trash2, X } from 'lucide-react';
import type { LayoutOrientation, LayoutTemplate } from '../types';

interface LayoutLibraryProps {
  templates: LayoutTemplate[];
  currentOrientation: LayoutOrientation;
  error: string | null;
  onClose: () => void;
  onLoad: (template: LayoutTemplate) => boolean;
  onSave: (name: string) => boolean;
  onDelete: (templateId: string) => void;
}

export const LayoutLibrary: React.FC<LayoutLibraryProps> = ({
  templates,
  currentOrientation,
  error,
  onClose,
  onLoad,
  onSave,
  onDelete,
}) => {
  const [saveName, setSaveName] = useState('');

  return (
    <div className="absolute left-0 top-full z-50 mt-2 w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-border-light bg-surface-light p-3 shadow-2xl dark:border-border-dark dark:bg-surface-dark">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            <LayoutDashboard size={16} className="text-primary" />
            Layouts
          </div>
          <p className="mt-0.5 text-[10px] text-text-secondary-light dark:text-text-secondary-dark">
            Loading adds slots to the selected board and preserves existing content.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-text-secondary-dark hover:bg-black/5 dark:hover:bg-white/10" title="Close layouts">
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-300">
          {error}
        </div>
      )}

      <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
        {templates.map(template => {
          const compatible = template.orientation === currentOrientation;
          return (
            <div key={template.id} className="group relative rounded-lg border border-border-light bg-gray-50 p-2 dark:border-border-dark dark:bg-black/20">
              <button
                type="button"
                disabled={!compatible}
                onClick={() => {
                  if (onLoad(template)) onClose();
                }}
                className="w-full text-left disabled:cursor-not-allowed disabled:opacity-45"
                title={compatible ? `Load ${template.name}` : `Switch the canvas to ${template.orientation} first`}
              >
                <div className={`relative mx-auto mb-2 overflow-hidden rounded border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-950 ${template.orientation === 'landscape' ? 'h-16 w-24' : template.orientation === 'square' ? 'h-20 w-20' : 'h-24 w-16'}`}>
                  {template.slots.map(layoutSlot => (
                    <span
                      key={layoutSlot.id}
                      className="absolute rounded-[1px] border border-sky-500/80 bg-sky-500/5"
                      style={{
                        left: `${layoutSlot.x * 100}%`,
                        top: `${layoutSlot.y * 100}%`,
                        width: `${layoutSlot.w * 100}%`,
                        height: `${layoutSlot.h * 100}%`,
                      }}
                    />
                  ))}
                </div>
                <div className="truncate text-[11px] font-semibold text-text-primary-light dark:text-text-primary-dark">{template.name}</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                  {template.slots.length} slots · {template.orientation}
                </div>
              </button>
              {template.source === 'user' && (
                <button
                  type="button"
                  onClick={() => onDelete(template.id)}
                  className="absolute right-1.5 top-1.5 rounded bg-white/90 p-1 text-red-500 opacity-0 shadow transition-opacity hover:bg-red-50 group-hover:opacity-100 dark:bg-gray-900/90 dark:hover:bg-red-950"
                  title={`Delete ${template.name}`}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <form
        className="mt-3 flex gap-2 border-t border-border-light pt-3 dark:border-border-dark"
        onSubmit={(event) => {
          event.preventDefault();
          if (onSave(saveName)) setSaveName('');
        }}
      >
        <input
          value={saveName}
          onChange={event => setSaveName(event.target.value)}
          maxLength={120}
          placeholder="Name this marked-slot layout"
          className="min-w-0 flex-1 rounded-lg border border-border-light bg-white px-3 py-2 text-xs text-text-primary-light outline-none focus:border-primary dark:border-border-dark dark:bg-black/20 dark:text-text-primary-dark"
        />
        <button
          type="submit"
          disabled={!saveName.trim()}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={14} /> Save
        </button>
      </form>
    </div>
  );
};
