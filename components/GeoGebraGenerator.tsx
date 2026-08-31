import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Plus, Loader2, Code2, RefreshCw, Pause, Triangle } from 'lucide-react';
import { generateGeoGebraCode, validateGeoGebraCode } from '../services/geogebraService';
import { GeoGebraData } from '../types';

interface GeoGebraGeneratorProps {
  onClose: () => void;
  onInsert: (geogebraData: GeoGebraData) => void;
}

// Declare GGBApplet type for TypeScript
declare global {
  interface Window {
    GGBApplet: any;
  }
}

// Script loading state management
let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: (() => void)[] = [];

const loadGeoGebraScript = (): Promise<void> => {
  return new Promise((resolve) => {
    if (scriptLoaded) {
      resolve();
      return;
    }

    loadCallbacks.push(resolve);

    if (scriptLoading) {
      return;
    }

    scriptLoading = true;
    const script = document.createElement('script');
    script.src = 'https://www.geogebra.org/apps/deployggb.js';
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      loadCallbacks.forEach(cb => cb());
      loadCallbacks.length = 0;
    };
    script.onerror = () => {
      scriptLoading = false;
      console.error('[GeoGebraGenerator] Failed to load GeoGebra script');
    };
    document.head.appendChild(script);
  });
};

export const GeoGebraGenerator: React.FC<GeoGebraGeneratorProps> = ({ onClose, onInsert }) => {
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState('');
  const [appType, setAppType] = useState<'graphing' | 'geometry' | 'classic'>('graphing');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const appletRef = useRef<any>(null);

  // Debounce protection for API calls
  const lastCallTimeRef = useRef<number>(0);
  const DEBOUNCE_MS = 1000;

  // Track latest code for resize re-initialization
  const codeRef = useRef(code);
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // Initialize GeoGebra preview
  useEffect(() => {
    let mounted = true;
    let resizeTimer: NodeJS.Timeout;

    const loadGraphics = async () => {
       if (!previewRef.current) return;
       
       try {
         // If script not loaded, wait for it
         await loadGeoGebraScript();
         if (!mounted || !previewRef.current) return;

         // Cleanup existing
         previewRef.current.innerHTML = '';
         
         const appletDiv = document.createElement('div');
         appletDiv.id = 'ggb_generator_preview';
         appletDiv.style.width = '100%';
         appletDiv.style.height = '100%';
         previewRef.current.appendChild(appletDiv);

         // Calculate dimensions
         const width = previewRef.current.clientWidth || 800;
         const height = previewRef.current.clientHeight || 600;

         const params: any = {
            appName: appType,
            width: width,
            height: height,
            showToolBar: false,
            showAlgebraInput: false,
            showMenuBar: false,
            showResetIcon: false,
            enableLabelDrags: false,
            enableShiftDragZoom: true,
            enableRightClick: false,
            preventFocus: true,
            autoHeight: true,
            scaleContainerClass: 'geogebra-preview-container',
            allowUpscale: true,
            appletOnLoad: (api: any) => {
              if (!mounted) return;
              appletRef.current = api;
              setIsPreviewLoading(false);
              
              const currentCode = codeRef.current;
              if (currentCode) {
                executeCommands(api, currentCode);
              }
            }
         };

         const applet = new window.GGBApplet(params, true);
         applet.inject('ggb_generator_preview');

       } catch (err) {
         console.error('[GeoGebraGenerator] Init error:', err);
         setError('Failed to load GeoGebra preview');
         setIsPreviewLoading(false);
       }
    };

    const initPreview = () => {
        setIsPreviewLoading(true);
        loadGraphics();
    };

    // Initial load
    const timeout = setTimeout(initPreview, 100);

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
           if (!mounted) return;
           if (previewRef.current && previewRef.current.innerHTML !== '') {
               loadGraphics();
           }
        }, 500);
    });

    if (previewRef.current) {
        resizeObserver.observe(previewRef.current);
    }

    return () => {
      mounted = false;
      appletRef.current = null;
      clearTimeout(timeout);
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
    };
  }, [appType]);

  // Update preview when code changes
  useEffect(() => {
    if (appletRef.current && code) {
      const timeout = setTimeout(() => {
        try {
          appletRef.current.reset();
          executeCommands(appletRef.current, code);
        } catch (err) {
          console.error('[GeoGebraGenerator] Preview update error:', err);
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [code]);

  const executeCommands = (api: any, codeStr: string) => {
    if (!api || !codeStr) return;
    
    const commands = codeStr.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'));
    
    commands.forEach((cmd, index) => {
      try {
        api.evalCommand(cmd);
      } catch (err) {
        console.error(`[GeoGebraGenerator] Command ${index + 1} failed:`, cmd, err);
      }
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    // Prevent rapid calls (debounce)
    const now = Date.now();
    if (now - lastCallTimeRef.current < DEBOUNCE_MS) {
      console.log('[GeoGebraGenerator] Debounced - too soon since last call');
      return;
    }
    lastCallTimeRef.current = now;
    
    setIsGenerating(true);
    setError(null);
    try {
      const generatedCode = await generateGeoGebraCode(prompt, appType);
      setCode(generatedCode);
      
      // Validate the generated code
      const validation = validateGeoGebraCode(generatedCode);
      if (!validation.valid) {
        console.warn('[GeoGebraGenerator] Validation warnings:', validation.errors);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to generate GeoGebra code. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleAnimation = () => {
    if (!appletRef.current) return;
    
    try {
      if (isPlaying) {
        appletRef.current.stopAnimation();
      } else {
        appletRef.current.startAnimation();
      }
      setIsPlaying(!isPlaying);
    } catch (err) {
      console.error('[GeoGebraGenerator] Animation toggle error:', err);
    }
  };

  const resetPreview = () => {
    if (!appletRef.current) return;
    
    try {
      appletRef.current.reset();
      setIsPlaying(false);
      if (code) {
        executeCommands(appletRef.current, code);
      }
    } catch (err) {
      console.error('[GeoGebraGenerator] Reset error:', err);
    }
  };

  const handleInsert = () => {
    if (!code.trim()) {
      setError('Please generate some code first');
      return;
    }
    
    onInsert({
      code: code.trim(),
      topic: prompt.trim() || undefined,
      appType
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#11110e]/60 backdrop-blur-md animate-in fade-in duration-500 p-2 sm:p-4">
      <div className="w-full h-full max-w-[1600px] max-h-[900px] bg-[#11110e]/95 backdrop-blur-3xl rounded-[1.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] border border-[#bebdaf]/10 flex flex-col overflow-hidden ring-1 ring-[#e9e9e4]/5">
        
        {/* Header */}
        <div className="h-16 sm:h-20 px-5 sm:px-8 border-b border-[#e9e9e4]/5 flex items-center justify-between shrink-0 bg-[#e9e9e4]/5">
          <div className="flex items-center gap-4 sm:gap-5">
             <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#515f4e] flex items-center justify-center text-[#e9e9e4] shadow-xl shadow-[#515f4e]/20 group">
                <Triangle size={20} fill="currentColor" className="group-hover:rotate-12 transition-transform duration-500" />
             </div>
             <div className="flex flex-col">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#e9e9e4]">
                    GeoGebra <span className="text-[#879d89]">AI</span> Animator
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-[#879d89] animate-pulse" />
                   <span className="text-[10px] font-bold text-[#bebdaf]/60 uppercase tracking-[0.2em] mb-[-1px]">Powered by Gemini 3 Flash</span>
                </div>
             </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-3 bg-[#e9e9e4]/5 hover:bg-[#e9e9e4]/10 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 group"
          >
            <X size={20} className="text-[#bebdaf] group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Main Content - Responsive Stack/Split */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            
            {/* Left Panel: Controls & Code */}
            <div className="w-full lg:w-1/3 min-w-0 lg:min-w-[400px] border-b lg:border-b-0 lg:border-r border-[#e9e9e4]/5 flex flex-col bg-[#e9e9e4]/5">
                
                {/* Prompt Section */}
                <div className="p-2 sm:p-3 border-b border-[#e9e9e4]/5 space-y-4 sm:space-y-6">
                    <label className="text-[11px] font-extrabold text-[#879d89] uppercase tracking-[0.25em] flex items-center gap-2">
                       <div className="w-1 h-3 bg-[#879d89] rounded-full"/>
                       Animation Concept
                    </label>
                    
                    <div className="relative group">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe your mathematical animation... (e.g. Unit circle rotation with sine wave)"
                            className="w-full h-24 sm:h-28 p-3 sm:p-4 rounded-xl bg-[#11110e]/50 border border-[#e9e9e4]/10 focus:border-[#879d89]/50 focus:ring-1 focus:ring-[#879d89]/50 outline-none resize-none text-sm transition-all duration-500 placeholder:text-[#bebdaf]/30 font-medium leading-relaxed text-[#e9e9e4] shadow-inner"
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 h-9 sm:h-10 px-4 sm:px-5 bg-[#515f4e] hover:bg-[#879d89] disabled:opacity-30 disabled:grayscale text-[#e9e9e4] rounded-xl shadow-lg shadow-[#515f4e]/20 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 font-bold text-xs"
                        >
                            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <>Generate <Play size={10} fill="currentColor" /></>}
                        </button>
                    </div>

                    {/* App Type Selector */}
                    <div className="flex gap-0 p-1 bg-[#11110e]/30 rounded-xl border border-[#e9e9e4]/5">
                      {(['graphing', 'geometry', 'classic'] as const).map(type => (
                        <button
                          key={type}
                          onClick={() => setAppType(type)}
                          className={`flex-1 py-2 rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all duration-300 ${
                            appType === type 
                              ? 'bg-[#515f4e] text-[#e9e9e4] shadow-md' 
                              : 'text-[#bebdaf]/50 hover:text-[#bebdaf] hover:bg-[#e9e9e4]/5'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                </div>

                {/* Editor Section - Hidden on very small screens if needed, or collapsed */}
                <div className="flex-1 flex flex-col min-h-[150px] sm:min-h-[200px] overflow-hidden relative">
                     <div className="px-3 sm:px-4 py-2 sm:py-3 bg-[#11110e]/20 border-b border-[#e9e9e4]/5 flex items-center justify-between">
                        <span className="text-[10px] font-black text-[#bebdaf]/40 uppercase tracking-[0.2em]">Source Commands</span>
                        {code && (
                           <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#879d89]/10 text-[#879d89]">
                                <Code2 size={12} />
                                <span className="text-[9px] font-bold uppercase tracking-wider">Validated</span>
                           </div>
                        )}
                     </div>
                     <textarea
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="GeoGebra commands will be generated here..."
                        className="flex-1 w-full p-2 sm:p-3 bg-transparent text-[#bebdaf] font-mono text-[11px] sm:text-[13px] leading-[1.8] resize-none outline-none selection:bg-[#515f4e]/30 custom-scrollbar"
                        spellCheck={false}
                     />
                     <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#11110e]/20 to-transparent pointer-events-none" />
                </div>
            </div>

            {/* Right Panel: Preview */}
            <div className="flex-1 bg-[#11110e]/30 relative flex flex-col min-h-[400px] lg:min-h-0">
                <div className="absolute inset-0 bg-[radial-gradient(rgba(233,233,228,0.03)_1.5px,transparent_1.5px)] [background-size:24px_24px] pointer-events-none" />
                
                {/* Preview Loading State */}
                {isPreviewLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#11110e]/80 z-[20] backdrop-blur-sm animate-in fade-in duration-500">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                         <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-[#515f4e]/30 rounded-full" />
                         <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-[#879d89] border-t-transparent rounded-full animate-spin absolute inset-0" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                         <span className="text-sm font-bold text-[#e9e9e4]">Initializing Engine</span>
                         <span className="text-[10px] font-medium text-[#bebdaf]/50 uppercase tracking-[0.2em]">GeoGebra 6.0</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative flex-1 p-0 sm:p-3 lg:p-3 flex flex-col items-center justify-center overflow-hidden">
                    <div id="geogebra-preview-container" className="relative w-full h-full min-h-[200px] flex items-center justify-center gap-4">
                      <div 
                        ref={previewRef} 
                        className="w-full h-full flex items-center justify-center bg-[#e9e9e4] rounded-[0.5rem] sm:rounded-[1rem] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] overflow-hidden border border-[#e9e9e4]/10 transition-all duration-700"
                        style={{ maxWidth: '100%', maxHeight: '100%' }}
                      />
                    </div>
                </div>

                {/* Overlaid Controls */}
                <div className="absolute top-5 right-5 sm:top-5 sm:right-5 z-[30] flex gap-2">
                  <button
                    onClick={toggleAnimation}
                    disabled={isPreviewLoading || !code}
                    className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center bg-[#11110e]/80 backdrop-blur-md rounded-xl shadow-lg hover:bg-[#515f4e] text-[#e9e9e4] transition-all duration-300 disabled:opacity-20 active:scale-90 border border-[#e9e9e4]/5"
                    title={isPlaying ? 'Pause' : 'Play Animation'}
                  >
                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                  </button>
                  <button
                    onClick={resetPreview}
                    disabled={isPreviewLoading || !code}
                    className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center bg-[#11110e]/80 backdrop-blur-md rounded-xl shadow-lg hover:bg-[#515f4e] text-[#e9e9e4] transition-all duration-300 disabled:opacity-20 active:scale-90 border border-[#e9e9e4]/5"
                    title="Reset"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>

                {/* Toolbar / Actions */}
                <div className="absolute bottom-2 right-2 sm:bottom-2 sm:right-2 flex flex-col items-end gap-4 sm:gap-6 z-[30] max-w-[90%]">
                    {error && (
                        <div className="px-2 py-2 sm:px-6 sm:py-4 bg-red-900/40 backdrop-blur-xl border border-red-500/30 text-red-200 text-xs font-bold rounded-2xl shadow-xl animate-in slide-in-from-bottom-4 duration-500 flex items-center gap-3">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                            <span className="truncate max-w-[200px] sm:max-w-none">{error}</span>
                        </div>
                    )}
                    <button
                        onClick={handleInsert}
                        disabled={!code.trim()}
                        className="group h-12 px-5 sm:h-12 sm:px-5 bg-[#e9e9e4] hover:bg-[#bebdaf] disabled:bg-[#11110e] text-[#11110e] disabled:text-[#e9e9e4]/20 font-black rounded-2xl sm:rounded-[1.5rem] shadow-2xl hover:shadow-[#e9e9e4]/20 active:scale-[0.98] transition-all duration-500 flex items-center gap-3 sm:gap-4 disabled:border disabled:border-[#e9e9e4]/10 disabled:cursor-not-allowed"
                    >
                        <Plus size={30} className="sm:w-6 sm:h-6 group-hover:rotate-180 transition-transform duration-700" />
                    </button>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

