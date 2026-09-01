import React from 'react';
import { 
  ChevronRight, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  AlignJustify,
  Grid3X3,
  MoreHorizontal,
  ChevronDown,
  RotateCw,
  Eye,
  Plus,
  Minus,
  Bold,
  Italic,
  Check,
  EyeOff,
  Palette,
  Table,
  Square,
  Magnet,
  Lock,
  Unlock,
  PanelsTopLeft
} from 'lucide-react';

const AVAILABLE_FONTS = [
  'Inter',
  'Roboto',
  'Montserrat',
  'Poppins',
  'Lato',
  'Oswald',
  'Playfair Display',
  'Merriweather',
  'Nunito',
  'Public Sans',
  'JetBrains Mono'
];
import { NodeEditor } from './NodeEditor';
import { CanvasElement, LayoutRole } from '../types';
import { fitPointsToBox } from './ShapeLibrary';
import { isElementLocked } from '../utils/elementRegistry';
import { assignLayoutSlotRole, markElementAsLayoutSlot, unmarkLayoutSlot } from '../services/layoutTemplates';

interface PropertiesPanelProps {
  selectedElement: CanvasElement | undefined;
  selectedIds: string[];
  onUpdateElements: (ids: string[], updates: Partial<CanvasElement> | ((el: CanvasElement) => CanvasElement)) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ 
  selectedElement,
  selectedIds,
  onUpdateElements,
  collapsed,
  setCollapsed
}) => {
  const [showFontDropdown, setShowFontDropdown] = React.useState(false);
  const [showColorPicker, setShowColorPicker] = React.useState(false);

  const handleChange = (field: keyof CanvasElement, value: string | number) => {
    if (selectedIds.length > 0) {
      onUpdateElements(selectedIds, { [field]: value });
    }
  };

  const handleStyleChange = (styleField: string, value: any) => {
    if (selectedIds.length > 0) {
      onUpdateElements(selectedIds, (el) => {
        if (el.type !== 'text') return el;
        return {
          ...el,
          textStyle: { ...(el.textStyle || {}), [styleField]: value }
        };
      });
    }
  };

  const handleSlotRoleChange = (role: LayoutRole | null) => {
    if (!selectedElement.layoutSlot) return;
    const replacing = selectedElement.layoutSlot.role !== null && selectedElement.layoutSlot.role !== role;
    if (replacing && !window.confirm('Changing this slot role will remove its current content. Continue?')) return;
    onUpdateElements([selectedElement.id], (element) => (
      element.layoutSlot ? assignLayoutSlotRole(element, role, replacing) : element
    ));
  };

  const canMarkAsSlot = Boolean(selectedElement
    && selectedElement.type === 'shape'
    && (selectedElement.shapeType || 'rectangle') === 'rectangle'
    && !selectedElement.layoutSlot);

  return (
    <aside 
      className={`bg-surface-light dark:bg-surface-dark border-l border-border-light dark:border-border-dark flex flex-col h-full overflow-hidden z-30 shadow-lg relative transition-all duration-300 ease-in-out dark:shadow-none ${collapsed ? 'w-0 border-l-0' : 'w-72'}`}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-surface-dark">
        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark ml-2">Properties</span>
        <button 
          onClick={() => setCollapsed(true)}
          className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {!selectedElement ? (
        <div className="flex-1 flex items-center justify-center text-xs text-text-secondary-dark p-8 text-center">
          Select an element to edit properties
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {selectedIds.length > 1 && (
            <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{selectedIds.length} Elements Selected</span>
              <span className="text-[10px] text-text-secondary-dark italic">Editing First</span>
            </div>
          )}
          
          {/* Position Section */}
          <div className="p-4 border-b border-border-light dark:border-border-dark">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">Dimensions</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title={isElementLocked(selectedElement) ? 'Unlock to move or resize' : 'Lock position and size'}
                  onClick={() => {
                    const nextLocked = !isElementLocked(selectedElement);
                    onUpdateElements(selectedIds, { locked: nextLocked });
                  }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide transition-all ${
                    isElementLocked(selectedElement)
                      ? 'bg-sky-500/15 text-sky-500'
                      : 'bg-gray-100 dark:bg-black/20 text-text-secondary-light dark:text-text-secondary-dark'
                  }`}
                >
                  {isElementLocked(selectedElement) ? <Lock size={12} /> : <Unlock size={12} />}
                  Lock
                </button>
                {selectedElement.type === 'shape' && (
                  <button
                    type="button"
                    title={selectedElement.snapToBox !== false ? 'Snap on — shape fills W×H' : 'Snap off'}
                    onClick={() => {
                      onUpdateElements(selectedIds, (el) => {
                        if (el.type !== 'shape') return el;
                        const nextOn = el.snapToBox === false;
                        const pts = Array.isArray(el.points) && el.points[0] && typeof el.points[0] === 'object' && 'x' in el.points[0]
                          ? (el.points as { x: number; y: number }[])
                          : null;
                        return {
                          ...el,
                          snapToBox: nextOn,
                          points: nextOn && pts ? fitPointsToBox(pts, el.w, el.h) : el.points,
                        };
                      });
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide transition-all ${
                      selectedElement.snapToBox !== false
                        ? 'bg-sky-500/15 text-sky-500'
                        : 'bg-gray-100 dark:bg-black/20 text-text-secondary-light dark:text-text-secondary-dark'
                    }`}
                  >
                    <Magnet size={12} />
                    Snap
                  </button>
                )}
              </div>
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <NumInput label="X" value={Math.round(selectedElement.x)} onChange={(v) => handleChange('x', v)} disabled={isElementLocked(selectedElement)} />
              <NumInput label="Y" value={Math.round(selectedElement.y)} onChange={(v) => handleChange('y', v)} disabled={isElementLocked(selectedElement)} />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <NumInput label="W" value={Math.round(selectedElement.w)} onChange={(v) => handleChange('w', v)} disabled={isElementLocked(selectedElement)} />
              <NumInput label="H" value={Math.round(selectedElement.h)} onChange={(v) => handleChange('h', v)} disabled={isElementLocked(selectedElement)} />
            </div>
            <div className={`flex items-center rounded-lg px-2 py-1 group focus-within:ring-1 focus-within:ring-primary bg-gray-50 dark:bg-black/20 border border-transparent dark:border-white/5 ${isElementLocked(selectedElement) ? 'opacity-50 pointer-events-none' : ''}`}>
              <RotateCw size={12} className="text-text-secondary-dark mr-2 shrink-0" />
              <input
                type="number"
                value={Math.round(selectedElement.rotation ?? 0)}
                disabled={isElementLocked(selectedElement)}
                onChange={(e) => handleChange('rotation', Number(e.target.value) || 0)}
                className="w-full bg-transparent border-none p-0 text-xs text-right focus:outline-none text-text-primary-light dark:text-text-primary-dark font-mono"
              />
              <span className="ml-0.5 text-xs font-mono text-text-secondary-dark">°</span>
            </div>
          </div>

          {(canMarkAsSlot || selectedElement.layoutSlot) && (
            <div className="border-b border-border-light p-4 dark:border-border-dark">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
                  <PanelsTopLeft size={14} className="text-sky-500" />
                  Layout Slot
                </span>
                {selectedElement.layoutSlot && (
                  <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-500">Marked</span>
                )}
              </div>

              {canMarkAsSlot ? (
                <button
                  type="button"
                  onClick={() => onUpdateElements([selectedElement.id], element => markElementAsLayoutSlot(element))}
                  className="w-full rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-600 hover:bg-sky-500/15 dark:text-sky-400"
                >
                  Mark rectangle as slot
                </button>
              ) : selectedElement.layoutSlot ? (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-[10px] text-text-secondary-dark">Slot name</span>
                    <input
                      value={selectedElement.name}
                      maxLength={120}
                      onChange={event => onUpdateElements([selectedElement.id], { name: event.target.value })}
                      className="w-full rounded-lg border border-transparent bg-gray-50 px-2 py-2 text-xs text-text-primary-light outline-none focus:border-primary dark:bg-black/20 dark:text-text-primary-dark"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] text-text-secondary-dark">Content role</span>
                    <select
                      value={selectedElement.layoutSlot.role || ''}
                      onChange={event => handleSlotRoleChange((event.target.value || null) as LayoutRole | null)}
                      className="w-full rounded-lg border border-transparent bg-gray-50 px-2 py-2 text-xs text-text-primary-light outline-none focus:border-primary dark:bg-black/20 dark:text-text-primary-dark"
                    >
                      <option value="">Empty slot</option>
                      <option value="text">Text</option>
                      <option value="image">Image</option>
                      <option value="table">Table</option>
                      <option value="math">Math</option>
                      <option value="diagram">Mind map / diagram</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      const filled = selectedElement.layoutSlot?.role !== null;
                      if (filled && !window.confirm('Removing this slot marker will remove its current content. Continue?')) return;
                      onUpdateElements([selectedElement.id], element => unmarkLayoutSlot(element, filled));
                    }}
                    className="text-[10px] font-semibold text-red-500 hover:text-red-600"
                  >
                    Remove slot marker
                  </button>
                </div>
              ) : null}
            </div>
          )}


          {/* Table Settings */}
          {selectedElement.type === 'table' && (
            <div className="p-4 border-b border-border-light dark:border-border-dark">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">Table Structure</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-text-secondary-dark">Rows</span>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => {
                                    const newData = { ...selectedElement.tableData, rows: (selectedElement.tableData?.rows || 3) + 1, data: [...(selectedElement.tableData?.data || []), Array(selectedElement.tableData?.cols || 3).fill('Cell')] };
                                    onUpdateElements(selectedIds, { tableData: newData as any });
                                }}
                                className="p-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                                <Plus size={14}/>
                            </button>
                            <span className="flex-1 text-center text-xs font-mono">{selectedElement.tableData?.rows || 3}</span>
                            <button 
                                onClick={() => {
                                    if ((selectedElement.tableData?.rows || 3) <= 2) return;
                                    const newData = { ...selectedElement.tableData, rows: (selectedElement.tableData?.rows || 3) - 1, data: (selectedElement.tableData?.data || []).slice(0, -1) };
                                    onUpdateElements(selectedIds, { tableData: newData as any });
                                }}
                                className="p-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                                <Minus size={14}/>
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-text-secondary-dark">Columns</span>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => {
                                    const cols = (selectedElement.tableData?.cols || 3);
                                    const newData = { 
                                        ...selectedElement.tableData, 
                                        cols: cols + 1, 
                                        headers: [...(selectedElement.tableData?.headers || []), 'Header'],
                                        data: (selectedElement.tableData?.data || []).map((row: any[]) => [...row, 'Cell'])
                                    };
                                    onUpdateElements(selectedIds, { tableData: newData as any });
                                }}
                                className="p-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                                <Plus size={14}/>
                            </button>
                            <span className="flex-1 text-center text-xs font-mono">{selectedElement.tableData?.cols || 3}</span>
                            <button 
                                onClick={() => {
                                    const cols = (selectedElement.tableData?.cols || 3);
                                    if (cols <= 1) return;
                                    const newData = { 
                                        ...selectedElement.tableData, 
                                        cols: cols - 1,
                                        headers: (selectedElement.tableData?.headers || []).slice(0, -1),
                                        data: (selectedElement.tableData?.data || []).map((row: any[]) => row.slice(0, -1))
                                    };
                                    onUpdateElements(selectedIds, { tableData: newData as any });
                                }}
                                className="p-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                                <Minus size={14}/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
          )}


          {/* Mind Map Settings */}
          {selectedElement.type === 'mindmap' && (
             <div className="p-4 border-b border-border-light dark:border-border-dark">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">Mind Map Nodes</span>
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                   {selectedElement.mindMapData && (
                       <NodeEditor 
                          node={{ label: selectedElement.mindMapData.root, children: selectedElement.mindMapData.children }}
                          onChange={(rootNode) => {
                              onUpdateElements(selectedIds, { mindMapData: { root: rootNode.label, children: rootNode.children || [] } });
                          }}
                       />
                   )}
                </div>
             </div>
          )}

          {/* Border / Stroke Settings - For Shapes and Paths */}
          {(selectedElement.type === 'path' || selectedElement.type === 'shape' || (selectedElement.points && selectedElement.points.length > 0)) && (
              <div className="p-4 border-b border-border-light dark:border-border-dark">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">Border & Stroke</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                       <NumInput label="Width" value={selectedElement.strokeWidth || 0} onChange={(v) => handleChange('strokeWidth', v)} />
                  </div>
                  {/* Stroke Color */}
                  <div className="relative">
                       <span className="text-[10px] text-text-secondary-dark mb-1 block">Stroke Color</span>
                        <div 
                           onClick={() => {
                               // Toggle or open a specific picker. For now reuse generic or render a new one?
                               // Let's rely on the same pattern but maybe simpler or duplicate logic?
                               // Since we have one state `showColorPicker`, it might conflict if we have multiple pickers.
                               // Let's implement a local state or just a simple input for now.
                           }}
                           className="flex items-center gap-2 p-1.5 rounded bg-gray-50 dark:bg-black/20 border border-transparent hover:border-border-light cursor-pointer group"
                        >
                            <input 
                                type="color" 
                                value={selectedElement.strokeColor || '#000000'}
                                onChange={(e) => handleChange('strokeColor', e.target.value)}
                                className="w-5 h-5 rounded cursor-pointer border-0 p-0" 
                            />
                            <input 
                                  type="text" 
                                  value={selectedElement.strokeColor || ''}
                                  placeholder="None"
                                  onChange={(e) => handleChange('strokeColor', e.target.value)}
                                  className="w-full text-xs bg-transparent border-none p-0 text-text-primary-light dark:text-text-primary-dark font-mono focus:outline-none"
                            />
                        </div>
                  </div>
              </div>
          )}

          {/* Typography */}
          {selectedElement.type === 'text' && (
            <div className="p-4 border-b border-border-light dark:border-border-dark">
               <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">Typography</span>
                  <button className="text-text-secondary-light dark:text-text-secondary-dark hover:text-primary"><MoreHorizontal size={14} /></button>
              </div>
              
              <div className="flex justify-between mb-3 rounded-lg p-1 bg-gray-100 dark:bg-black/20 border border-transparent dark:border-white/5">
                  <AlignBtn icon={<AlignLeft size={14} />} onClick={() => handleStyleChange('textAlign', 'left')} active={(selectedElement.textStyle?.textAlign || 'center') === 'left'} />
                  <AlignBtn icon={<AlignCenter size={14} />} onClick={() => handleStyleChange('textAlign', 'center')} active={(selectedElement.textStyle?.textAlign || 'center') === 'center'} />
                  <AlignBtn icon={<AlignRight size={14} />} onClick={() => handleStyleChange('textAlign', 'right')} active={(selectedElement.textStyle?.textAlign || 'center') === 'right'} />
                  <AlignBtn icon={<AlignJustify size={14} />} onClick={() => handleStyleChange('textAlign', 'justify')} active={selectedElement.textStyle?.textAlign === 'justify'} />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                 <button 
                    onClick={() => handleStyleChange('fontWeight', selectedElement.textStyle?.fontWeight === 'bold' ? 'normal' : 'bold')}
                    className={`flex items-center justify-center py-1.5 rounded text-xs border ${selectedElement.textStyle?.fontWeight === 'bold' || selectedElement.textStyle?.fontWeight === '700' ? 'bg-primary text-white border-primary' : 'bg-gray-50 dark:bg-black/20 border-transparent dark:border-white/5 text-text-secondary-dark'}`}
                 >
                     <Bold size={14} className="mr-1"/> Bold
                 </button>
                 <button 
                    onClick={() => handleStyleChange('fontStyle', selectedElement.textStyle?.fontStyle === 'italic' ? 'normal' : 'italic')}
                    className={`flex items-center justify-center py-1.5 rounded text-xs border ${selectedElement.textStyle?.fontStyle === 'italic' ? 'bg-primary text-white border-primary' : 'bg-gray-50 dark:bg-black/20 border-transparent dark:border-white/5 text-text-secondary-dark'}`}
                 >
                     <Italic size={14} className="mr-1"/> Italic
                 </button>
              </div>

              <div className="relative mb-2">
                  <div 
                    onClick={() => setShowFontDropdown(!showFontDropdown)}
                    className="bg-gray-50 dark:bg-black/20 rounded-lg p-2 flex justify-between items-center border border-transparent hover:border-border-light dark:hover:border-border-dark cursor-pointer transition-colors"
                  >
                      <span className="text-xs font-medium dark:text-text-primary-dark truncate pr-2">
                        {selectedElement.textStyle?.fontFamily?.split(',')[0] || 'Inter'}
                      </span>
                      <ChevronDown size={14} className={`text-text-secondary-dark transition-transform ${showFontDropdown ? 'rotate-180' : ''}`} />
                  </div>
                  
                  {showFontDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                      {AVAILABLE_FONTS.map((font) => (
                        <div 
                          key={font}
                          onClick={() => {
                            handleStyleChange('fontFamily', `${font}, sans-serif`);
                            setShowFontDropdown(false);
                          }}
                          className="px-3 py-2 text-xs text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex justify-between items-center"
                          style={{ fontFamily: font }}
                        >
                          {font}
                          {(selectedElement.textStyle?.fontFamily || 'Inter').includes(font) && <Check size={12} className="text-primary" />}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-2">
                 <div className="bg-gray-50 dark:bg-black/20 rounded-lg p-2 flex justify-between items-center">
                    <span className="text-[10px] text-text-secondary-dark">Size</span>
                    <input 
                        type="number"
                        value={selectedElement.textStyle?.fontSize || 16}
                        onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))}
                        className="w-12 bg-transparent border-none p-0 text-xs text-right focus:outline-none text-text-primary-light dark:text-text-primary-dark font-mono"
                    />
                </div>
                 <div className="bg-gray-50 dark:bg-black/20 rounded-lg p-2 flex justify-between items-center">
                    <span className="text-[10px] text-text-secondary-dark">Height</span>
                    <input 
                        type="number"
                        step="0.1"
                        value={selectedElement.textStyle?.lineHeight || 1.5}
                        onChange={(e) => handleStyleChange('lineHeight', parseFloat(e.target.value))}
                        className="w-12 bg-transparent border-none p-0 text-xs text-right focus:outline-none text-text-primary-light dark:text-text-primary-dark font-mono"
                    />
                </div>
              </div>
            </div>
          )}

          {/* Fill */}
          <div className="p-4 border-b border-border-light dark:border-border-dark">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">Fill</span>
              <div className="flex items-center gap-1">
                 <button 
                    onClick={() => {
                       const current = selectedElement.type === 'text' ? selectedElement.textStyle?.color : selectedElement.color;
                       if (current === 'transparent') {
                          onUpdateElements(selectedIds, (el) => {
                             if (el.type === 'text') return { ...el, textStyle: { ...(el.textStyle || {}), color: undefined } };
                             const val = '#ec5b13';
                             if (el.type === 'container') return { ...el, color: val, boardConfig: { ...(el.boardConfig || {}), backgroundColor: val } };
                             return { ...el, color: val };
                          });
                       } else {
                          onUpdateElements(selectedIds, (el) => {
                             if (el.type === 'text') return { ...el, textStyle: { ...(el.textStyle || {}), color: 'transparent' } };
                             const val = 'transparent';
                             if (el.type === 'container') return { ...el, color: val, boardConfig: { ...(el.boardConfig || {}), backgroundColor: val } };
                             return { ...el, color: val };
                          });
                       }
                    }}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:text-primary"
                    title="Toggle Visibility"
                 >
                     {((selectedElement.type === 'text' ? selectedElement.textStyle?.color : selectedElement.color) === 'transparent') ? <EyeOff size={14}/> : <Eye size={14}/>}
                 </button>
                 <button 
                    onClick={() => {
                        onUpdateElements(selectedIds, (el) => {
                           if (el.type === 'text') return { ...el, textStyle: { ...(el.textStyle || {}), color: undefined } };
                           const val = 'transparent';
                           if (el.type === 'container') return { ...el, color: val, boardConfig: { ...(el.boardConfig || {}), backgroundColor: val } };
                           return { ...el, color: val };
                        });
                    }}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:text-red-500"
                    title="Remove Color (Auto)"
                 >
                     <Minus size={14}/>
                 </button>
              </div>
            </div>

            <div className="relative">
                <div 
                   onClick={() => setShowColorPicker(!showColorPicker)}
                   className="flex items-center gap-2 p-1.5 rounded bg-gray-50 dark:bg-black/20 border border-transparent hover:border-border-light cursor-pointer group"
                >
                    <div className="w-5 h-5 rounded border border-gray-200 dark:border-white/10 shadow-sm relative overflow-hidden">
                       <div className="absolute inset-0 bg-[url('https://checkerboard.cool/checks.png')] opacity-20 bg-repeat bg-[length:4px_4px]"></div>
                       <div className="absolute inset-0" style={{ backgroundColor: (selectedElement.type === 'text' ? selectedElement.textStyle?.color : selectedElement.color) || 'var(--canvas-text-auto, #000)' }}></div>
                    </div>
                    <span className="text-xs font-mono flex-1 text-text-secondary-light dark:text-text-secondary-dark group-hover:text-primary truncate">
                        {(selectedElement.type === 'text' ? selectedElement.textStyle?.color : selectedElement.color) || 'Auto'}
                    </span>
                    <Palette size={12} className="text-text-secondary-dark opacity-50"/>
                </div>

                {showColorPicker && (
                   <div className="absolute top-full left-0 z-50 mt-2 w-64 bg-white dark:bg-surface-dark border border-gray-200 dark:border-border-dark p-3 rounded-lg shadow-xl">
                      <div className="flex gap-2 mb-3">
                           <input 
                              type="color" 
                              value={(() => {
                                const c = selectedElement.type === 'text' ? selectedElement.textStyle?.color : selectedElement.color;
                                // Only return hex colors, fallback to black for 'transparent' or invalid values
                                if (c && c.startsWith('#') && c.length >= 7) return c.substring(0, 7);
                                return '#000000';
                              })()}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  onUpdateElements(selectedIds, (el) => {
                                      if (el.type === 'text') return { ...el, textStyle: { ...(el.textStyle || {}), color: val } };
                                      if (el.type === 'container') return { ...el, color: val, boardConfig: { ...(el.boardConfig || {}), backgroundColor: val } };
                                      return { ...el, color: val };
                                  });
                              }}
                              className="w-8 h-8 rounded cursor-pointer border-0 p-0" 
                           />
                           <div className="flex-1">
                               <label className="text-[10px] uppercase text-text-secondary-dark mb-1 block">Hex</label>
                               <input 
                                  type="text" 
                                  value={(selectedElement.type === 'text' ? selectedElement.textStyle?.color : selectedElement.color) || ''}
                                  placeholder="#RRGGBB"
                                  onChange={(e) => {
                                     const val = e.target.value;
                                     onUpdateElements(selectedIds, (el) => {
                                          if (el.type === 'text') return { ...el, textStyle: { ...(el.textStyle || {}), color: val } };
                                          if (el.type === 'container') return { ...el, color: val, boardConfig: { ...(el.boardConfig || {}), backgroundColor: val } };
                                          return { ...el, color: val };
                                     });
                                  }}
                                  className="w-full text-xs bg-gray-50 dark:bg-black/20 border-none rounded px-2 py-1 text-text-primary-light dark:text-text-primary-dark font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                               />
                           </div>
                      </div>
                      
                      <div className="grid grid-cols-7 gap-1 mt-2">
                          {[
                              '#000000', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
                              '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#a855f7', '#d946ef'
                          ].map(c => (
                              <button
                                key={c}
                                className="w-6 h-6 rounded-full border border-gray-200 dark:border-white/10 hover:scale-110 transition-transform"
                                style={{ backgroundColor: c }}
                                onClick={() => {
                                   onUpdateElements(selectedIds, (el) => {
                                      if (el.type === 'text') return { ...el, textStyle: { ...(el.textStyle || {}), color: c } };
                                      if (el.type === 'container') return { ...el, color: c, boardConfig: { ...(el.boardConfig || {}), backgroundColor: c } };
                                      return { ...el, color: c };
                                   });
                                }}
                              />
                          ))}
                      </div>
                   </div>
                )}
            </div>
          </div>
        </div>
      )}
      
      {/* Collapsed Toggle if hidden */}
      {collapsed && (
          <div className="absolute top-2 left-2 z-50">
             <button 
              onClick={() => setCollapsed(false)}
              className="p-1.5 rounded-md bg-surface-dark border border-border-dark text-text-secondary-dark hover:text-primary shadow-lg"
            >
              <ChevronRight size={16} className="rotate-180" />
            </button>
          </div>
      )}
    </aside>
  );
};

// Helper Components
const AlignBtn = ({ icon, onClick, active }: { icon: React.ReactNode, onClick: () => void, active?: boolean }) => (
  <button 
    onClick={onClick}
    className={`p-1 rounded transition-all ${active ? 'bg-primary text-white shadow-sm' : 'hover:bg-white dark:hover:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark'}`}
  >
    {icon}
  </button>
);

const NumInput = ({ label, value, onChange, disabled }: { label: string, value: number, onChange: (val: number) => void, disabled?: boolean }) => (
  <div className={`flex items-center bg-gray-50 dark:bg-black/20 rounded px-2 py-1.5 group focus-within:ring-1 focus-within:ring-primary border border-transparent dark:border-white/5 transition-colors ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <span className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark w-3 group-hover:text-primary cursor-ew-resize font-mono font-medium">{label}</span>
    <input 
      type="number"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full bg-transparent border-none p-0 text-xs text-right focus:outline-none focus:ring-0 text-text-primary-light dark:text-text-primary-dark font-mono" 
    />
  </div>
);
