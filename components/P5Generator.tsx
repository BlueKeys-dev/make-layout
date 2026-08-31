import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Play, Plus, Loader2, Code2, RefreshCw, Pause, Sparkles, Zap, AlertCircle, Download } from 'lucide-react';
import { generateP5Code, validateP5Code } from '../services/p5Service';
import { P5Data, P5ModelProvider } from '../types';

interface P5GeneratorProps {
    onClose: () => void;
    onInsert?: (p5Data: P5Data) => void;
    ondownload?: (p5Data: P5Data) => void;
    initialPrompt?: string;
}

// Theme constants - Fresh green/blue palette
const THEME = {
    text: '#010d08',
    background: '#f9fffc',
    primary: '#14f385',
    secondary: '#73d9f8',
    accent: '#2f99ea',
};

// HTML template for p5.js iframe
const createP5Html = (code: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; 
      height: 100%; 
      overflow: hidden; 
      background: #1a1a1a;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    canvas { 
      display: block; 
      max-width: 100%;
      max-height: 100%;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
</head>
<body>
  <script>
    try {
      ${code}
    } catch (e) {
      console.error('P5.js Error:', e);
      document.body.innerHTML = '<div style="color: #ff6b6b; padding: 20px; font-family: monospace;">' + e.message + '</div>';
    }
  </script>
</body>
</html>
`;

export const P5Generator: React.FC<P5GeneratorProps> = ({ onClose, onInsert, ondownload, initialPrompt = '' }) => {
    const [prompt, setPrompt] = useState(initialPrompt);
    const [code, setCode] = useState('');
    const [modelProvider, setModelProvider] = useState<P5ModelProvider>('gemini');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const lastCallTimeRef = useRef<number>(0);
    const DEBOUNCE_MS = 1000;

    // Auto-generate if initialPrompt is provided
    useEffect(() => {
        if (initialPrompt && initialPrompt.trim()) {
            // Small delay to let the modal render first
            const timer = setTimeout(() => {
                handleGenerate();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, []); // Only run on mount

    // Update iframe when code changes
    const updatePreview = useCallback(() => {
        if (!iframeRef.current || !code) return;

        const blob = new Blob([createP5Html(code)], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        iframeRef.current.src = url;

        // Cleanup old blob URL after load
        iframeRef.current.onload = () => {
            URL.revokeObjectURL(url);
        };
    }, [code]);

    // Update preview when code changes
    useEffect(() => {
        if (code && isPlaying) {
            const timeout = setTimeout(updatePreview, 300);
            return () => clearTimeout(timeout);
        }
    }, [code, isPlaying, updatePreview]);

    // Validate code when it changes
    useEffect(() => {
        if (code) {
            const validation = validateP5Code(code);
            setValidationWarnings(validation.errors);
        }
    }, [code]);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter an animation concept first');
            return;
        }

        // Debounce protection
        const now = Date.now();
        if (now - lastCallTimeRef.current < DEBOUNCE_MS) {
            console.log('[P5Generator] Debounced - too soon since last call');
            return;
        }
        lastCallTimeRef.current = now;

        setIsGenerating(true);
        setError(null);

        try {
            console.log(`[P5Generator] Generating with ${modelProvider} for prompt: "${prompt}"`);
            const generatedCode = await generateP5Code(prompt, modelProvider);

            if (!generatedCode || generatedCode.trim().length === 0) {
                throw new Error('AI returned empty code. Please try a different prompt.');
            }

            setCode(generatedCode);
            setIsPlaying(true);
            console.log('[P5Generator] Generation successful');
        } catch (e: any) {
            console.error('[P5Generator] Generation error:', e);

            // Provide more user-friendly error messages
            let errorMessage = 'Failed to generate animation. ';
            if (e.message?.includes('API_KEY')) {
                errorMessage += 'API key not configured. Please check your .env.local file.';
            } else if (e.message?.includes('429') || e.message?.includes('quota')) {
                errorMessage += 'Rate limit exceeded. Please wait a moment and try again.';
            } else if (e.message?.includes('network') || e.message?.includes('fetch')) {
                errorMessage += 'Network error. Please check your internet connection.';
            } else {
                errorMessage += e.message || 'Unknown error occurred.';
            }
            setError(errorMessage);
        } finally {
            setIsGenerating(false);
        }
    };

    const togglePlayPause = () => {
        if (isPlaying) {
            // Pause by removing src
            if (iframeRef.current) {
                iframeRef.current.src = 'about:blank';
            }
        } else {
            // Resume by reloading
            updatePreview();
        }
        setIsPlaying(!isPlaying);
    };

    const handleReset = () => {
        if (!iframeRef.current || !code) return;

        // Clear the iframe first to ensure a complete reset
        iframeRef.current.src = 'about:blank';

        // Set playing state and reload after a brief delay to ensure clean restart
        setIsPlaying(true);
        setTimeout(() => {
            updatePreview();
        }, 50);
    };

    const handleInsert = () => {
        if (!code.trim()) {
            setError('Please generate some code first');
            return;
        }

        onInsert?.({
            code: code.trim(),
            topic: prompt.trim() || undefined,
            modelUsed: modelProvider
        });

        onClose();
    };

    const handledownload = () => {
        if (!code.trim()) {
            setError('Please generate some code first');
            return;
        }

        ondownload?.({
            code: code.trim(),
            topic: prompt.trim() || undefined,
            modelUsed: modelProvider
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-lg animate-in fade-in duration-500 p-2 sm:p-4">
            <div className="w-full h-full max-w-[1600px] max-h-[900px] bg-[#f9fffc] backdrop-blur-3xl rounded-[1.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)] border border-[#14f385]/20 flex flex-col overflow-hidden">

                {/* Header */}
                <div className="h-16 sm:h-20 px-5 sm:px-8 border-b border-[#14f385]/10 flex items-center justify-between shrink-0 bg-gradient-to-r from-[#14f385]/10 to-transparent">
                    <div className="flex items-center gap-4 sm:gap-5">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#14f385] to-[#2f99ea] flex items-center justify-center text-white shadow-xl shadow-[#14f385]/30 group">
                            <Sparkles size={20} className="group-hover:rotate-12 transition-transform duration-500" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#010d08]">
                                p5.js <span className="text-[#2f99ea]">AI</span> Generator
                            </h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#14f385] animate-pulse" />
                                <span className="text-[10px] font-bold text-[#010d08]/50 uppercase tracking-[0.2em]">
                                    {modelProvider === 'gemini' ? 'Gemini 3 Flash' : 'OpenAI GPT-4o-mini'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-3 bg-[#010d08]/5 hover:bg-[#010d08]/10 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 group"
                    >
                        <X size={20} className="text-[#010d08]/60 group-hover:text-[#010d08] group-hover:rotate-90 transition-all duration-300" />
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

                    {/* Left Panel: Controls & Code */}
                    <div className="w-full lg:w-1/3 min-w-0 lg:min-w-[400px] border-b lg:border-b-0 lg:border-r border-[#14f385]/10 flex flex-col bg-[#010d08]/[0.02]">

                        {/* Prompt Section */}
                        <div className="p-4 sm:p-5 border-b border-[#14f385]/10 space-y-4">
                            <label className="text-[11px] font-extrabold text-[#2f99ea] uppercase tracking-[0.25em] flex items-center gap-2">
                                <div className="w-1 h-3 bg-[#2f99ea] rounded-full" />
                                Animation Concept
                            </label>

                            <div className="relative group">
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Describe your animation... (e.g., bouncing balls with gravity, fractal tree, particle system)"
                                    className="w-full h-24 sm:h-28 p-3 sm:p-4 rounded-xl bg-white border border-[#010d08]/10 focus:border-[#14f385]/50 focus:ring-1 focus:ring-[#14f385]/30 outline-none resize-none text-sm transition-all duration-500 placeholder:text-[#010d08]/30 font-medium leading-relaxed text-[#010d08] shadow-sm"
                                />
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !prompt.trim()}
                                    className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 h-9 sm:h-10 px-4 sm:px-5 bg-gradient-to-r from-[#14f385] to-[#73d9f8] hover:from-[#73d9f8] hover:to-[#14f385] disabled:opacity-30 disabled:grayscale text-[#010d08] rounded-xl shadow-lg shadow-[#14f385]/30 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 font-bold text-xs"
                                >
                                    {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <>Generate <Zap size={12} /></>}
                                </button>
                            </div>

                            {/* Model Selector */}
                            <div className="flex gap-0 p-1 bg-[#010d08]/5 rounded-xl border border-[#010d08]/5">
                                <button
                                    onClick={() => setModelProvider('gemini')}
                                    className={`flex-1 py-2.5 rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 ${modelProvider === 'gemini'
                                        ? 'bg-gradient-to-r from-[#14f385] to-[#73d9f8] text-[#010d08] shadow-md'
                                        : 'text-[#010d08]/40 hover:text-[#010d08]/70 hover:bg-[#010d08]/5'
                                        }`}
                                >
                                    <Sparkles size={12} />
                                    Gemini Flash
                                </button>
                                <button
                                    onClick={() => setModelProvider('openrouter')}
                                    className={`flex-1 py-2.5 rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 ${modelProvider === 'openrouter'
                                        ? 'bg-gradient-to-r from-[#2f99ea] to-[#73d9f8] text-white shadow-md'
                                        : 'text-[#010d08]/40 hover:text-[#010d08]/70 hover:bg-[#010d08]/5'
                                        }`}
                                >
                                    <Zap size={12} />
                                    OpenAI
                                </button>
                            </div>
                        </div>

                        {/* Code Editor Section */}
                        <div className="flex-1 flex flex-col min-h-[150px] sm:min-h-[200px] overflow-hidden relative">
                            <div className="px-3 sm:px-4 py-2 sm:py-3 bg-[#010d08]/5 border-b border-[#010d08]/5 flex items-center justify-between">
                                <span className="text-[10px] font-black text-[#010d08]/40 uppercase tracking-[0.2em]">p5.js Source Code</span>
                                {code && validationWarnings.length === 0 && (
                                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#14f385]/10 text-[#14f385]">
                                        <Code2 size={12} />
                                        <span className="text-[9px] font-bold uppercase tracking-wider">Valid</span>
                                    </div>
                                )}
                                {validationWarnings.length > 0 && (
                                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-600">
                                        <AlertCircle size={12} />
                                        <span className="text-[9px] font-bold uppercase tracking-wider">Warnings</span>
                                    </div>
                                )}
                            </div>
                            <textarea
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="// p5.js code will appear here after generation..."
                                className="flex-1 w-full p-3 sm:p-4 bg-white text-[#010d08] font-mono text-[11px] sm:text-[13px] leading-[1.8] resize-none outline-none selection:bg-[#14f385]/30 custom-scrollbar"
                                spellCheck={false}
                            />
                            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#f9fffc]/80 to-transparent pointer-events-none" />
                        </div>
                    </div>

                    {/* Right Panel: Preview */}
                    <div className="flex-1 bg-[#010d08]/5 relative flex flex-col min-h-[400px] lg:min-h-0">
                        {/* Grid Pattern Background */}
                        <div className="absolute inset-0 bg-[radial-gradient(rgba(1,13,8,0.05)_1.5px,transparent_1.5px)] [background-size:24px_24px] pointer-events-none" />

                        {/* Empty State */}
                        {!code && !isGenerating && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex flex-col items-center gap-4 text-center px-8">
                                    <div className="w-20 h-20 rounded-3xl bg-[#14f385]/10 flex items-center justify-center">
                                        <Sparkles size={32} className="text-[#14f385]/40" />
                                    </div>
                                    <div>
                                        <p className="text-[#010d08]/60 font-medium">Enter a prompt and click Generate</p>
                                        <p className="text-[#010d08]/40 text-sm mt-1">Your p5.js animation will appear here</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Loading State */}
                        {isGenerating && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20 backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="relative">
                                        <div className="w-16 h-16 border-4 border-[#14f385]/30 rounded-full" />
                                        <div className="w-16 h-16 border-4 border-[#2f99ea] border-t-transparent rounded-full animate-spin absolute inset-0" />
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-sm font-bold text-[#010d08]">Generating Animation</span>
                                        <span className="text-[10px] font-medium text-[#010d08]/50 uppercase tracking-[0.2em]">
                                            {modelProvider === 'gemini' ? 'Gemini 3 Flash' : 'OpenAI GPT-4o-mini'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Preview Iframe */}
                        <div className="relative flex-1 p-3 flex items-center justify-center overflow-hidden">
                            <div className="relative w-full h-full flex items-center justify-center">
                                <iframe
                                    ref={iframeRef}
                                    className="w-full h-full bg-[#1a1a1a] rounded-xl border border-[#010d08]/10 shadow-2xl"
                                    sandbox="allow-scripts"
                                    allow="accelerometer; gyroscope; magnetometer"
                                    title="p5.js Preview"
                                />
                            </div>
                        </div>

                        {/* Overlay Controls */}
                        <div className="absolute top-5 right-5 z-30 flex gap-2">
                            <button
                                onClick={togglePlayPause}
                                disabled={!code}
                                className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center bg-white/90 backdrop-blur-md rounded-xl shadow-lg hover:bg-[#14f385] text-[#010d08] transition-all duration-300 disabled:opacity-20 active:scale-90 border border-[#010d08]/10"
                                title={isPlaying ? 'Pause' : 'Play'}
                            >
                                {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                            </button>
                            <button
                                onClick={handleReset}
                                disabled={!code}
                                className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center bg-white/90 backdrop-blur-md rounded-xl shadow-lg hover:bg-[#14f385] text-[#010d08] transition-all duration-300 disabled:opacity-20 active:scale-90 border border-[#010d08]/10"
                                title="Reset"
                            >
                                <RefreshCw size={18} />
                            </button>
                        </div>

                        {/* Bottom Actions */}
                        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-4 z-30 max-w-[90%]">
                            {error && (
                                <div className="px-4 py-3 bg-red-50 backdrop-blur-xl border border-red-200 text-red-700 text-xs font-bold rounded-2xl shadow-xl animate-in slide-in-from-bottom-4 duration-500 flex items-center gap-3">
                                    <AlertCircle size={14} className="text-red-500 shrink-0" />
                                    <span className="max-w-[300px]">{error}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                {ondownload && (
                                    <button
                                        onClick={handledownload}
                                        disabled={!code.trim()}
                                        className="group h-12 px-6 bg-white/90 backdrop-blur-md border border-[#010d08]/10 hover:bg-[#010d08]/5 disabled:bg-gray-100 text-[#010d08] disabled:text-gray-400 font-bold rounded-2xl shadow-lg active:scale-[0.98] transition-all duration-300 flex items-center gap-3 disabled:cursor-not-allowed"
                                    >
                                        <Download size={18} />
                                    </button>
                                )}
                                {onInsert && (
                                    <button
                                        onClick={handleInsert}
                                        disabled={!code.trim()}
                                        className="group h-12 px-6 bg-gradient-to-r from-[#14f385] to-[#2f99ea] hover:from-[#2f99ea] hover:to-[#14f385] disabled:bg-gray-200 text-[#010d08] disabled:text-gray-400 font-black rounded-2xl shadow-2xl shadow-[#14f385]/30 active:scale-[0.98] transition-all duration-500 flex items-center gap-3 disabled:cursor-not-allowed"
                                    >
                                        <Plus size={20} className="group-hover:rotate-180 transition-transform duration-700" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default P5Generator;
