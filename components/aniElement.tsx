import React, { useEffect, useRef, useState } from 'react';
import { CanvasElement } from '../types';
import { Play, Pause, RefreshCw } from 'lucide-react';

interface GeoGebraElementProps {
  element: CanvasElement;
  onUpdateElement?: (id: string, updates: Partial<CanvasElement>) => void;
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
      console.error('[GeoGebraElement] Failed to load GeoGebra script');
    };
    document.head.appendChild(script);
  });
};

export const GeoGebraElement: React.FC<GeoGebraElementProps> = ({ element, onUpdateElement }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appletRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const instanceId = useRef(`ggb_${element.id.replace(/-/g, '_')}`);

  // Initialize GeoGebra applet
  useEffect(() => {
    let mounted = true;

    const initApplet = async () => {
      if (!containerRef.current) return;
      
      try {
        await loadGeoGebraScript();
        
        if (!mounted || !containerRef.current) return;

        // Clear previous applet
        containerRef.current.innerHTML = '';
        
        // Create applet container
        const appletDiv = document.createElement('div');
        appletDiv.id = instanceId.current;
        appletDiv.style.width = '100%';
        appletDiv.style.height = '100%';
        containerRef.current.appendChild(appletDiv);

        const appType = element.geogebraData?.appType || 'graphing';
        
        const params: any = {
          appName: appType,
          width: element.w,
          height: element.h,
          showToolBar: false,
          showAlgebraInput: false,
          showMenuBar: false,
          showResetIcon: false,
          enableLabelDrags: false,
          enableShiftDragZoom: true,
          enableRightClick: false,
          enableCAS: false,
          enable3D: false,
          preventFocus: true,
          autoHeight: true,
          allowUpscale: true,
          appletOnLoad: (api: any) => {
            if (!mounted) return;
            appletRef.current = api;
            setIsLoading(false);
            
            // Priority: Load from base64State first (faster), else execute commands
            const base64State = element.geogebraData?.base64State;
            const code = element.geogebraData?.code;
            
            if (base64State) {
              try {
                api.setBase64(base64State);
                console.log('[GeoGebraElement] Loaded from base64State');
              } catch (err) {
                console.warn('[GeoGebraElement] Failed to load base64, falling back to commands:', err);
                if (code && api) {
                  executeCommands(api, code);
                }
              }
            } else if (code && api) {
              executeCommands(api, code);
            }
          }
        };

        const applet = new window.GGBApplet(params, true);
        applet.inject(instanceId.current);

      } catch (err) {
        console.error('[GeoGebraElement] Init error:', err);
        setError('Failed to load GeoGebra');
        setIsLoading(false);
      }
    };

    // Small delay to ensure container is ready
    const timeout = setTimeout(initApplet, 50);
    return () => {
      mounted = false;
      appletRef.current = null;
      clearTimeout(timeout);
    };
  }, [element.id, element.w, element.h]);

  // Update commands when code changes (only if no base64State)
  useEffect(() => {
    if (appletRef.current && element.geogebraData?.code && !element.geogebraData?.base64State) {
      try {
        appletRef.current.reset();
        executeCommands(appletRef.current, element.geogebraData.code);
      } catch (err) {
        console.error('[GeoGebraElement] Command update error:', err);
      }
    }
  }, [element.geogebraData?.code]);

  const executeCommands = (api: any, code: string) => {
    if (!api || !code) return;
    
    const commands = code.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'));
    
    commands.forEach((cmd, index) => {
      try {
        const success = api.evalCommand(cmd);
        if (!success) {
          console.warn(`[GeoGebraElement] Command ${index + 1} may have issues: ${cmd}`);
        }
      } catch (err) {
        console.error(`[GeoGebraElement] Command ${index + 1} failed:`, cmd, err);
      }
    });
  };

  // Save current state as Base64
  const saveState = () => {
    if (!appletRef.current || !onUpdateElement) return;
    
    try {
      appletRef.current.getBase64((base64: string) => {
        onUpdateElement(element.id, {
          geogebraData: {
            ...element.geogebraData,
            code: element.geogebraData?.code || '',
            base64State: base64
          }
        });
        console.log('[GeoGebraElement] State saved as Base64');
      });
    } catch (err) {
      console.error('[GeoGebraElement] Save state error:', err);
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
      console.error('[GeoGebraElement] Animation toggle error:', err);
    }
  };

  const resetApplet = () => {
    if (!appletRef.current) return;
    
    try {
      appletRef.current.reset();
      setIsPlaying(false);
      
      // Re-execute commands after reset
      if (element.geogebraData?.code) {
        executeCommands(appletRef.current, element.geogebraData.code);
      }
    } catch (err) {
      console.error('[GeoGebraElement] Reset error:', err);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#11110e] rounded-2xl overflow-hidden relative shadow-md border border-[#bebdaf]/10 group/ggb">
      {/* Control Buttons */}
      <div className="absolute top-3 right-3 z-10 flex gap-2 opacity-0 group-hover/ggb:opacity-100 transition-all duration-300 transform translate-y-[-10px] group-hover/ggb:translate-y-0">
        <button
          onClick={toggleAnimation}
          className="p-2 bg-[#11110e]/90 backdrop-blur-md rounded-xl shadow-lg border border-[#e9e9e4]/20 hover:bg-[#515f4e] text-[#e9e9e4] transition-all active:scale-90"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        <button
          onClick={resetApplet}
          className="p-2 bg-[#11110e]/90 backdrop-blur-md rounded-xl shadow-lg border border-[#e9e9e4]/20 hover:bg-[#515f4e] text-[#e9e9e4] transition-all active:scale-90"
          title="Reset"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#11110e]/80 backdrop-blur-sm z-20">
          <div className="flex flex-col items-center gap-3">
             <div className="relative">
                <div className="w-12 h-12 border-4 border-[#515f4e]/30 rounded-full" />
                <div className="w-12 h-12 border-4 border-[#879d89] border-t-transparent rounded-full animate-spin absolute inset-0" />
             </div>
             <span className="text-[10px] font-black text-[#bebdaf]/50 uppercase tracking-widest">Loading Engine</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/40 z-20">
          <div className="px-4 py-2 bg-[#11110e] rounded-lg shadow-sm border border-red-500/30 text-[10px] font-bold text-red-300">
            {error}
          </div>
        </div>
      )}

      {/* GeoGebra Container */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full h-full geogebra-container bg-white"
        id={`container_${instanceId.current}`}
      />

      {/* Topic Label */}
      {element.geogebraData?.topic && (
        <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-[#11110e]/50 backdrop-blur-md rounded-xl text-[10px] font-bold text-[#e9e9e4] max-w-[80%] truncate border border-[#e9e9e4]/20 group-hover/ggb:opacity-0 transition-opacity">
          {element.geogebraData.topic}
        </div>
      )}
    </div>
  );
};
