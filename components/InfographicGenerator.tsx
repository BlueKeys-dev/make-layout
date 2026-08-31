import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Loader2, Code2, RefreshCw, Send, MoreVertical, MessageSquare, LayoutTemplate, Gamepad2, Settings, Copy, Check, Image, FileText, Link2, Paperclip, Globe } from 'lucide-react';
import { generateInfographicStream, Attachment } from '../services/infographicService';

interface InfographicGeneratorProps {
    onClose: () => void;
    initialPrompt?: string;
}

type Tab = 'preview' | 'editor';
type Topic = 'infographics' | 'simulation' | 'play';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export const InfographicGenerator: React.FC<InfographicGeneratorProps> = ({ onClose, initialPrompt = '' }) => {
    const [prompt, setPrompt] = useState(initialPrompt);
    const [htmlCode, setHtmlCode] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('preview');
    const [activeTopic, setActiveTopic] = useState<Topic>('infographics');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [lastPrompt, setLastPrompt] = useState(initialPrompt);
    const [systemPrompt, setSystemPrompt] = useState<string>("You are an expert Frontend Developer and Infographic Designer...");
    const [showSettings, setShowSettings] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [generationPhase, setGenerationPhase] = useState<'thinking' | 'coding'>('thinking');
    const [enableGoogleSearch, setEnableGoogleSearch] = useState(false);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const textInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialPrompt && initialPrompt.trim()) {
            handleGenerate();
        }
    }, []);

    useEffect(() => {
        if (iframeRef.current && htmlCode) {
            const blob = new Blob([htmlCode], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            iframeRef.current.src = url;
            iframeRef.current.onload = () => URL.revokeObjectURL(url);
        }
    }, [htmlCode, activeTab]);

    const handleGenerate = async (retryPrompt?: string) => {
        const activePrompt = retryPrompt || prompt;
        if (!activePrompt.trim()) return;

        setLastPrompt(activePrompt);
        setIsGenerating(true);
        setGenerationPhase('thinking');
        setHtmlCode(''); // Clear previous code for fresh stream
        setActiveTab('editor'); // Switch to editor to see live code

        // Add user message to chat immediately
        const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', text: activePrompt }];
        setChatHistory(newHistory);

        let accumulatedCode = '';
        try {
            const stream = generateInfographicStream(activePrompt, activeTopic, systemPrompt, attachments, enableGoogleSearch);
            setAttachments([]); // Clear attachments after sending
            for await (const chunk of stream) {
                if (accumulatedCode === '') {
                    setGenerationPhase('coding');
                }
                accumulatedCode += chunk;
                // Clean markdown code blocks on the fly
                let cleaned = accumulatedCode;
                if (cleaned.startsWith('```html')) {
                    cleaned = cleaned.replace(/^```html\n?/, '');
                } else if (cleaned.startsWith('```')) {
                    cleaned = cleaned.replace(/^```\n?/, '');
                }
                cleaned = cleaned.replace(/\n?```$/, '');
                setHtmlCode(cleaned);
            }
            setActiveTab('preview'); // Auto-switch to preview when done
            setChatHistory(prev => [...prev, { role: 'model', text: "Generated successfully! Let me know if you want to make any changes." }]);
        } catch (error: any) {
            let errorMessage = error.message || "An unexpected error occurred.";
            if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota')) {
                errorMessage = "Quota limit reached. Try disabling Google Search 🌍 or wait 60s.";
                // Optional: Auto-disable search to help user
                // setEnableGoogleSearch(false); 
            }
            setChatHistory(prev => [...prev, { role: 'model', text: `Error: ${errorMessage}` }]);
        } finally {
            setIsGenerating(false);
            setPrompt(''); // Clear input after send
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleGenerate();
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(htmlCode);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    // File upload handlers
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            setAttachments(prev => [...prev, {
                type: 'image',
                data: base64,
                mimeType: file.type,
                name: file.name
            }]);
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset input
    };

    const handleTextUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setAttachments(prev => [...prev, {
                type: 'text',
                data: reader.result as string,
                name: file.name
            }]);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleAddLink = () => {
        if (linkUrl.trim()) {
            setAttachments(prev => [...prev, {
                type: 'link',
                data: linkUrl.trim(),
                name: linkUrl.trim().slice(0, 30) + '...'
            }]);
            setLinkUrl('');
            setShowLinkInput(false);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500 p-4">
            <div className="w-full h-full max-w-[1800px] bg-[#0a0a0a] rounded-2xl border border-white/10 flex overflow-hidden shadow-2xl relative animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 ease-out">

                {/* Left Sidebar - Chat & Controls */}
                <div className="w-[400px] flex flex-col border-r border-white/10 bg-[#0f0f0f]">
                    {/* Header */}
                    <div className="p-2 border-b border-white/10 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                                <LayoutTemplate size={18} className="text-white" />
                            </div>
                            <span className="font-bold text-white tracking-tight">Infographics AI</span>
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-colors"
                            >
                                <MoreVertical size={20} />
                            </button>

                            {/* 3-Dot Settings Menu */}
                            {showSettings && (
                                <div
                                    className="absolute right-0 top-10 w-80 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200"
                                >
                                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Settings size={12} /> System Prompt
                                    </h3>
                                    <textarea
                                        value={systemPrompt}
                                        onChange={(e) => setSystemPrompt(e.target.value)}
                                        className="w-full h-40 bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-white/80 focus:border-green-500/50 outline-none resize-none"
                                        placeholder="Define the AI persona..."
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Topic Selection */}
                    <div className="p-4 grid grid-cols-3 gap-2">
                        {[
                            { id: 'infographics', label: 'Info', icon: LayoutTemplate },
                            { id: 'simulation', label: 'Simulate', icon: Play },
                            { id: 'play', label: 'Play', icon: Gamepad2 },
                        ].map((topic) => (
                            <button
                                key={topic.id}
                                onClick={() => setActiveTopic(topic.id as Topic)}
                                className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all duration-300 ${activeTopic === topic.id
                                    ? 'bg-green-500/10 border-green-500/50 text-green-400'
                                    : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                <topic.icon size={20} className="mb-1" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">{topic.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Chat History */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {chatHistory.length === 0 && (
                            <div className="text-center mt-10 opacity-30">
                                <MessageSquare size={48} className="mx-auto mb-4" />
                                <p className="text-sm">Start by describing your infographic concept.</p>
                            </div>
                        )}
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                <div className={`max-w-[85%] p-3 px-4 rounded-2xl text-sm leading-relaxed shadow-sm block ${msg.role === 'user'
                                    ? 'bg-green-600/90 text-white rounded-tr-sm border border-green-500/20'
                                    : 'bg-white/5 text-white/90 rounded-tl-sm border border-white/5'
                                    }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isGenerating && (
                            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full flex items-center gap-2.5">
                                    <div className="relative flex items-center justify-center">
                                        <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                                        <Loader2 size={12} className="animate-spin text-green-400 relative z-10" />
                                    </div>
                                    <span className="text-[10px] font-bold text-green-400/80 uppercase tracking-widest">
                                        {generationPhase} in progress
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chat Input */}
                    <div className="p-6 bg-[#0a0a0a] border-t border-white/5 relative space-y-4">
                        {/* Attachment Chips */}
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 animate-in fade-in duration-200">
                                {attachments.map((att, idx) => (
                                    <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-white/60 hover:bg-white/10 transition-colors group">
                                        {att.type === 'image' && <Image size={10} className="text-green-400" />}
                                        {att.type === 'text' && <FileText size={10} className="text-blue-400" />}
                                        {att.type === 'link' && <Link2 size={10} className="text-yellow-400" />}
                                        <span className="max-w-[120px] truncate uppercase tracking-wider">{att.name || att.type}</span>
                                        <button onClick={() => removeAttachment(idx)} className="text-white/20 group-hover:text-red-400 transition-colors">
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Link URL Input */}
                        {showLinkInput && (
                            <div className="flex gap-2 animate-in slide-in-from-bottom-2 duration-300">
                                <input
                                    type="url"
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    placeholder="Enter documentation or resource URL..."
                                    className="flex-1 bg-[#141414] border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-green-500/30 transition-all placeholder:text-white/10"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                                />
                                <button onClick={handleAddLink} className="px-4 py-2 bg-green-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-400 transition-all shadow-lg shadow-green-500/10">
                                    Attach
                                </button>
                                <button onClick={() => setShowLinkInput(false)} className="px-3 py-2 bg-white/5 text-white/40 rounded-xl hover:text-white transition-colors">
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {/* Main Input Box */}
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-[24px] blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
                            <div className="relative bg-[#141414] border border-white/5 rounded-[22px] overflow-hidden focus-within:border-white/10 transition-all active:scale-[0.995]">
                                {/* Hidden file inputs */}
                                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                <input ref={textInputRef} type="file" accept=".txt,.md" onChange={handleTextUpload} className="hidden" />

                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Describe your infographic, simulation or art..."
                                    disabled={isGenerating}
                                    className="w-full bg-transparent px-5 pt-5 pb-12 text-sm text-white focus:outline-none transition-all resize-none h-[100px] custom-scrollbar placeholder:text-white/10"
                                />

                                {/* Action Bar */}
                                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                                    <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/5">
                                        <button
                                            onClick={() => imageInputRef.current?.click()}
                                            className="p-2 hover:bg-white/5 rounded-lg text-white/30 hover:text-green-400 transition-all"
                                            title="Add Image"
                                        >
                                            <Image size={16} />
                                        </button>
                                        <button
                                            onClick={() => textInputRef.current?.click()}
                                            className="p-2 hover:bg-white/5 rounded-lg text-white/30 hover:text-blue-400 transition-all"
                                            title="Add Data/Text"
                                        >
                                            <FileText size={16} />
                                        </button>
                                        <button
                                            onClick={() => setShowLinkInput(!showLinkInput)}
                                            className={`p-2 hover:bg-white/5 rounded-lg transition-all ${showLinkInput ? 'text-yellow-400 bg-white/5' : 'text-white/30 hover:text-yellow-400'}`}
                                            title="Attach Resource Link"
                                        >
                                            <Link2 size={16} />
                                        </button>
                                        <div className="w-px h-4 bg-white/10 mx-1" />
                                        <button
                                            onClick={() => setEnableGoogleSearch(!enableGoogleSearch)}
                                            className={`p-2 hover:bg-white/5 rounded-lg transition-all ${enableGoogleSearch ? 'text-blue-400 bg-white/5 shadow-[0_0_10px_rgba(96,165,250,0.3)]' : 'text-white/30 hover:text-blue-400'}`}
                                            title="Toggle Google Search"
                                        >
                                            <Globe size={16} />
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => handleGenerate()}
                                        disabled={isGenerating || (!prompt.trim() && attachments.length === 0)}
                                        className={`group/btn relative px-6 py-2 rounded-xl flex items-center gap-2 overflow-hidden transition-all ${isGenerating || (!prompt.trim() && attachments.length === 0)
                                            ? 'bg-white/5 text-white/10'
                                            : 'bg-green-500 text-black hover:bg-green-400 hover:scale-[1.02] active:scale-95'
                                            }`}
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-[0.15em] relative z-10">
                                            {isGenerating ? 'Generating' : 'Generate'}
                                        </span>
                                        {isGenerating ? (
                                            <Loader2 size={14} className="animate-spin relative z-10" />
                                        ) : (
                                            <Send size={14} className="relative z-10 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Preview & Editor */}
                <div className="flex-1 flex flex-col bg-[#050505] relative">

                    {/* Top Navigation Bar */}
                    <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#0a0a0a]">
                        <div className="flex bg-white/5 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab('preview')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'preview' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white'
                                    }`}
                            >
                                <Play size={12} /> Preview
                            </button>
                            <button
                                onClick={() => setActiveTab('editor')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'editor' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white'
                                    }`}
                            >
                                <Code2 size={12} /> Code
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleGenerate(lastPrompt)}
                                disabled={isGenerating || !lastPrompt}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300 ${isGenerating
                                    ? 'bg-white/5 border-transparent text-white/20 cursor-wait'
                                    : 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20 hover:border-green-500/40 shadow-lg shadow-green-500/5'
                                    }`}
                                title="Regenerate with last prompt"
                            >
                                <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Regenerate</span>
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-red-500/10 rounded-lg text-white/40 hover:text-red-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 relative overflow-hidden">
                        {activeTab === 'preview' ? (
                            <div className="w-full h-full bg-white relative animate-in fade-in duration-500">
                                {!htmlCode && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
                                        <div className="text-center space-y-4">
                                            <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10">
                                                <LayoutTemplate size={32} className="text-white/20" />
                                            </div>
                                            <p className="text-white/30 text-sm font-medium">Preview will appear here</p>
                                        </div>
                                    </div>
                                )}
                                <iframe
                                    ref={iframeRef}
                                    className="w-full h-full border-none"
                                    title="Infographic Preview"
                                    sandbox="allow-scripts"
                                />
                            </div>
                        ) : (
                            <div className="w-full h-full bg-[#0d0d0d] overflow-hidden flex flex-col animate-in fade-in duration-500">
                                <div className="flex items-center justify-between px-6 py-2 bg-white/5 border-b border-white/5">
                                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-yellow-500/50" /> READ-ONLY SOURCE
                                    </span>
                                    <button
                                        onClick={copyToClipboard}
                                        className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white/60 transition-all"
                                    >
                                        {copySuccess ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                        {copySuccess ? 'COPIED' : 'COPY CODE'}
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                                    <pre className="font-mono text-xs text-green-400/80 leading-relaxed whitespace-pre-wrap">
                                        {htmlCode || '// No code generated yet...'}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};
