import React, { useState, useRef } from 'react';
import { ChatMessage as ChatMessageType, LayoutPlan, AIModelId } from '../../types';
import { ChatBox } from './ChatBox';
import { AIModelSelector } from './AIModelSelector';
import { Sparkles, Image as ImageIcon, ArrowUp, AlertCircle, Wand2, RefreshCw, ChevronsDown } from 'lucide-react';


interface ImageResult {
  id: string;
  url: string;
  thumbnail: string;
  alt: string;
  photographer: string;
}

interface MultiAIChatPanelProps {
  messages: ChatMessageType[];
  pendingPlan: LayoutPlan | null;
  activeModelId: AIModelId;
  isGenerating: boolean;
  errorMessage?: string | null;
  onSendMessage: (prompt: string) => void;
  onSelectModel: (modelId: AIModelId) => void;
  onUploadImage: (file: File) => void;
  onRequestLayout: (prompt?: string) => void;
  onProceedPlan: () => void;
  onModifyPlan: () => void;
  onResetChat?: () => void;
  onStopGeneration?: () => void;
  onSelectImage?: (image: ImageResult) => void;
}


export const MultiAIChatPanel: React.FC<MultiAIChatPanelProps> = ({
  messages,
  pendingPlan,
  activeModelId,
  isGenerating,
  errorMessage,
  onSendMessage,
  onSelectModel,
  onUploadImage,
  onRequestLayout,
  onProceedPlan,
  onModifyPlan,
  onResetChat,
  onStopGeneration,
  onSelectImage,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isChatExpanded, setIsChatExpanded] = useState(true);
  const [isPanelHidden, setIsPanelHidden] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating) {
      onSendMessage(prompt);
      setPrompt('');
      setIsChatExpanded(true); // Auto-expand chat history when sending a message
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadImage(e.target.files[0]);
      e.target.value = ''; // Reset
    }
  };

  const handleLayoutRequest = () => {
    // Only trigger layout AI with the current prompt, don't send to chat AI
    onRequestLayout(prompt.trim() || undefined);
    setPrompt(''); // Clear after requesting layout
    setIsChatExpanded(true);
  };

  if (isPanelHidden) {
    return (
      <div className="absolute bottom-2 right-4 sm:bottom-3 sm:right-4 z-50">
        {/* The chat launcher is intentionally hidden while keeping its code available. */}
        {/*
        <button
          type="button"
          onClick={() => setIsPanelHidden(false)}
          className="w-12 h-12 rounded-2xl bg-orange-600 text-white shadow-2xl flex items-center justify-center hover:bg-orange-500 hover:scale-[1.05] active:scale-[0.95] transition-all ring-1 ring-white/10"
          title="Show chat"
          aria-label="Show chat"
        >
          <Sparkles size={20} fill="currentColor" />
        </button>
        */}
      </div>
    );
  }

  return (
    <div className="absolute bottom-2 right-4 sm:bottom-3 sm:right-4 z-50 w-[95vw] sm:w-[400px] flex flex-col items-center gap-2 transition-all duration-300">

      
      {/* Chat History Header Integrated into ChatBox now */}
      <div className="w-full bg-[#1c1c1e]/90 dark:bg-[#1c1c1e]/90 backdrop-blur-3xl rounded-[20px] border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 ring-1 ring-white/5">

        <ChatBox
          messages={messages}
          pendingPlan={pendingPlan}
          isExpanded={isChatExpanded}
          onToggleExpand={() => setIsChatExpanded(!isChatExpanded)}
          onProceedPlan={onProceedPlan}
          onModifyPlan={onModifyPlan}
          isGenerating={isGenerating}
          onSelectImage={onSelectImage}
        />
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-500/95 border border-red-400/40 backdrop-blur-md text-white px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 max-w-full">
          <AlertCircle size={14} className="shrink-0" />
          <span className="text-[10px] sm:text-xs font-mono font-medium truncate">{errorMessage}</span>
        </div>
      )}

      {/* Input Bar Section */}
      <div className="w-full bg-[#1c1c1e]/90 dark:bg-[#1c1c1e]/90 backdrop-blur-3xl rounded-[20px] border border-white/10 p-3 shadow-2xl flex flex-col gap-3 ring-1 ring-white/5">

        {/* Top Row: AI Selector & Create Layout */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AIModelSelector activeModelId={activeModelId} onSelectModel={onSelectModel} />
          </div>
          
          <div className="flex items-center gap-2">
            {/* Refresh Chat Button */}
            <button
              type="button"
              onClick={onResetChat}
              className="p-1.5 text-white/30 hover:text-white/60 transition-colors"
              title="Clear Chat History"
            >
              <RefreshCw size={14} />
            </button>

            <button
              type="button"
              onClick={handleLayoutRequest}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-600 rounded-xl text-white text-xs font-bold transition-all hover:bg-orange-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <Wand2 size={14} fill="currentColor" />
              <span>Create</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPanelHidden(true)}
              className="p-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/15 transition-colors"
              title="Hide chat"
              aria-label="Hide chat"
            >
              <ChevronsDown size={16} />
            </button>
          </div>
        </div>

        {/* Bottom Row: Text Input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white shadow-lg">
              <Sparkles size={16} fill="currentColor" />
            </div>
          </div>

          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your layout..."
              className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-[13px] placeholder-white/20 text-white/90 h-8 font-medium"
            />
          </div>



          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-white/20 hover:text-white/40 transition-colors"
            >
              <ImageIcon size={18} />
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

            <button
              type={isGenerating ? "button" : "submit"}
              onClick={(e) => {
                if (isGenerating && onStopGeneration) {
                  e.preventDefault();
                  onStopGeneration();
                }
              }}
              disabled={!isGenerating && !prompt.trim()}
              className={`w-9 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-[1.05] active:scale-[0.95] disabled:opacity-30 ${
                isGenerating 
                  ? "bg-red-500/90 hover:bg-red-600 text-white" 
                  : "bg-orange-600/90 hover:bg-orange-500 text-white"
              }`}
              title={isGenerating ? "Stop Generation" : "Send Message"}
            >
               {isGenerating ? <div className="w-3 h-3 bg-white rounded-[2px]" /> : <ArrowUp size={18} strokeWidth={2.5} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

