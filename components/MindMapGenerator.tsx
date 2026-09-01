import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Play, Plus, Loader2, Sparkles, BrainCircuit, Workflow, ArrowRightLeft, BoxSelect, Database, PieChart, ListChecks } from 'lucide-react';
import mermaid from 'mermaid';
import { generateMindMapCode } from '../services/mindMapService';
import { DiagramType, DIAGRAM_CONFIGS } from '../types/diagramTypes';
import { sanitizeMermaidSource, sanitizeMermaidSvg } from '../utils/contentSecurity';

interface MindMapGeneratorProps {
  onClose: () => void;
  onInsert: (mermaidCode: string) => void;
}

const ICONS: Record<string, any> = {
  BrainCircuit,
  Workflow,
  ArrowRightLeft,
  BoxSelect,
  Database,
  PieChart,
  ListChecks,
  Sparkles
};

// Global initialization flag
let mermaidInitialized = false;

// Apply dark text color
const applyTextColorFix = (svgString: string): string => {
  let fixed = svgString;
  fixed = fixed.replace(/fill\s*=\s*["'](#fff|#ffffff|white|rgb\s*\(\s*255\s*,\s*255\s*,\s*255\s*\))["']/gi, 'fill="#1e293b"');
  fixed = fixed.replace(/style\s*=\s*["']([^"']*)color\s*:\s*(#fff|#ffffff|white)([^"']*)["']/gi, 'style="$1color: #1e293b$3"');
  fixed = fixed.replace(/fill\s*=\s*["'](#f[8-9a-f][8-9a-f][8-9a-f][8-9a-f][8-9a-f])["']/gi, 'fill="#1e293b"');
  const css = `<defs><style>text,tspan{fill:#1e293b!important}foreignObject *{color:#1e293b!important}</style></defs>`;
  return fixed.replace(/<svg([^>]*)>/, `<svg$1>${css}`);
};

export const MindMapGenerator: React.FC<MindMapGeneratorProps> = ({ onClose, onInsert }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedType, setSelectedType] = useState<DiagramType>('auto');
  const [code, setCode] = useState(DIAGRAM_CONFIGS['mindmap'].defaultCode);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const renderIdCounterRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize Mermaid only once
  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'default',
        flowchart: { htmlLabels: false },
      });
      mermaidInitialized = true;
    }
  }, []);

  // Force render function - no skip logic
  const forceRender = useCallback(async (codeToRender: string) => {
    if (!previewRef.current || !codeToRender.trim()) return;

    setIsRendering(true);

    try {
      renderIdCounterRef.current += 1;
      const id = `preview-mermaid-${renderIdCounterRef.current}`;

      const { svg } = await mermaid.render(id, sanitizeMermaidSource(codeToRender));
      const fixedSvg = sanitizeMermaidSvg(applyTextColorFix(svg));

      if (previewRef.current) {
        previewRef.current.innerHTML = fixedSvg;
      }
      setError(null);
    } catch (err: any) {
      console.warn("Mermaid render warning:", err.message);
      // Don't clear preview on syntax error - keep last valid
    } finally {
      setIsRendering(false);
    }
  }, []);

  // Debounced preview rendering for typing
  useEffect(() => {
    // Cancel any pending render
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    // Short debounce for responsive feel
    renderTimeoutRef.current = setTimeout(() => {
      forceRender(code);
    }, 200);

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [code, forceRender]);

  // Handle type change - update code immediately and force render
  const handleTypeSelect = useCallback((type: DiagramType) => {
    setSelectedType(type);

    // Only update code if user hasn't generated anything yet (prompt is empty)
    if (!prompt.trim()) {
      const newCode = type === 'auto'
        ? DIAGRAM_CONFIGS['mindmap'].defaultCode
        : DIAGRAM_CONFIGS[type].defaultCode;
      setCode(newCode);

      // Cancel pending debounce and render immediately
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      // Immediate render for type switch
      setTimeout(() => forceRender(newCode), 50);
    }
  }, [prompt, forceRender]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    // Cancel previous generation if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateMindMapCode(prompt, selectedType);
      setCode(result.code);
      // Immediate render after generation
      setTimeout(() => forceRender(result.code), 50);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError('Failed to generate diagram. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, selectedType, forceRender]);

  const currentConfig = useMemo(() =>
    selectedType === 'auto'
      ? { label: 'Auto Detect', description: 'AI chooses the best diagram type', icon: 'Sparkles' }
      : DIAGRAM_CONFIGS[selectedType],
    [selectedType]
  );

  const handleInsert = useCallback(() => {
    onInsert(sanitizeMermaidSource(code));
  }, [code, onInsert]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-[92vw] h-[88vh] bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/30 dark:border-white/10 flex flex-col overflow-hidden ring-1 ring-black/5 dark:ring-white/5">

        {/* Header */}
        <div className="h-20 px-8 border-b border-white/20 dark:border-white/5 flex items-center justify-between shrink-0 bg-white/10 dark:bg-black/10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center text-black">
              {selectedType === 'auto' ? <Sparkles size={20} /> : React.createElement(ICONS[currentConfig.icon], { size: 20 })}
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                {selectedType === 'auto' ? 'AI Diagram Generator' : `AI ${currentConfig.label} Generator`}
              </h2>
              <span className="text-[10px] font-medium text-slate-500/80 dark:text-slate-400/80 uppercase tracking-widest">
                {currentConfig.description}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 bg-white/20 dark:bg-white/5 hover:bg-white/40 dark:hover:bg-white/10 rounded-full transition-all duration-300 hover:rotate-90"
          >
            <X size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Main Content - Split Pane */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left Panel: Controls & Code */}
          <div className="w-1/3 min-w-[380px] border-r border-white/20 dark:border-white/5 flex flex-col bg-white/10 dark:bg-black/20">

            {/* Type Selection */}
            <div className="px-6 py-4 border-b border-white/20 dark:border-white/5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 block">
                Diagram Type
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleTypeSelect('auto')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${selectedType === 'auto'
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                    : 'bg-white/20 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-white/30'
                    }`}
                >
                  <Sparkles size={14} />
                  Auto
                </button>
                {Object.values(DIAGRAM_CONFIGS).map((config) => {
                  const Icon = ICONS[config.icon];
                  const isSelected = selectedType === config.id;
                  return (
                    <button
                      key={config.id}
                      onClick={() => handleTypeSelect(config.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isSelected
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                        : 'bg-white/20 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-white/30'
                        }`}
                      title={config.description}
                    >
                      {Icon && <Icon size={14} />}
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt Section */}
            <div className="p-6 border-b border-white/20 dark:border-white/5 space-y-4 flex-1 overflow-auto">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Describe your diagram
              </label>
              <div className="relative group">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={selectedType === 'auto' ? "Describe any process, system, or concept..." : `Describe your ${currentConfig.label.toLowerCase()}...`}
                  className="w-full h-32 p-4 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-white/50 dark:border-slate-700/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none resize-none text-sm transition-all duration-300 placeholder:text-slate-400/60 font-medium leading-relaxed"
                />
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="absolute bottom-4 right-4 h-9 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:grayscale text-white rounded-lg shadow-lg shadow-indigo-500/30 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 font-semibold text-xs"
                >
                  {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <>Generate <Play size={12} fill="currentColor" /></>}
                </button>
              </div>

              {/* Code Editor */}
              <div className="flex flex-col gap-2 mt-4 h-full min-h-[200px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500/80 dark:text-slate-400/80 uppercase tracking-widest">Mermaid Source</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${isRendering ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
                    <span className="text-[10px] font-medium text-slate-400">{isRendering ? 'Rendering...' : 'Live Preview'}</span>
                  </div>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="flex-1 w-full p-4 rounded-xl bg-white/20 dark:bg-black/20 border border-white/10 dark:border-white/5 text-slate-800 dark:text-slate-200 font-mono text-[12px] leading-relaxed resize-none outline-none selection:bg-indigo-500/30 focus:border-indigo-500/30 transition-colors"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>

          {/* Right Panel: Preview */}
          <div className="flex-1 bg-white/5 dark:bg-black/5 relative flex flex-col">
            <div className="absolute inset-0 bg-[radial-gradient(rgba(0,0,0,0.05)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

            <div className="flex-1 overflow-auto flex items-center justify-center p-8 custom-scrollbar">
              <div ref={previewRef} className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:drop-shadow-xl" />
            </div>

            {/* Toolbar / Actions */}
            <div className="absolute bottom-8 right-8 flex flex-col items-end gap-4">
              {error && (
                <div className="px-4 py-2 bg-red-500/10 backdrop-blur-md border border-red-500/20 text-red-500 text-xs font-semibold rounded-xl animate-in slide-in-from-bottom-2">
                  {error}
                </div>
              )}
              <button
                onClick={handleInsert}
                className="group h-12 px-6 bg-gradient-to-r from-slate-900 to-black hover:from-slate-800 hover:to-slate-900 text-white font-bold rounded-xl shadow-xl shadow-slate-900/20 hover:shadow-2xl active:scale-[0.98] transition-all duration-300 flex items-center gap-3"
              >
                <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" />
                <span className="tracking-tight text-sm">Insert Diagram</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
