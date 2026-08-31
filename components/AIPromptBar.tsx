import React, { useState, useRef } from 'react';
import { Sparkles, Image as ImageIcon, ArrowUp, Loader2, AlertCircle } from 'lucide-react';

interface AIPromptBarProps {
  onGenerate: (prompt: string) => void;
  onUploadImage: (file: File) => void;
  isGenerating: boolean;
  errorMessage?: string | null;
}

export const AIPromptBar: React.FC<AIPromptBarProps> = ({ onGenerate, onUploadImage, isGenerating, errorMessage }) => {
  const [prompt, setPrompt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating) {
      onGenerate(prompt);
      setPrompt(""); // Clear after send
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadImage(e.target.files[0]);
    }
  };

  return (
    <div className="absolute bottom-24 md:bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-[92%] sm:w-[80%] md:w-full md:max-w-md px-2 flex flex-col items-center gap-2 transition-all duration-300">
      {errorMessage && (
        <div className="bg-red-500/95 border border-red-400/40 backdrop-blur-md text-white px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 max-w-full">
            <AlertCircle size={14} className="shrink-0" />
            <span className="text-[10px] sm:text-xs font-mono font-medium truncate">{errorMessage}</span>
        </div>
      )}
      
      <form 
        onSubmit={handleSubmit}
        className="w-full bg-surface-light dark:bg-[#09090b]/95 backdrop-blur-md shadow-2xl rounded-xl p-1 border border-border-light dark:border-border-dark dark:border-2 flex items-center gap-1.5 dark:shadow-floating-dark ring-1 ring-white/5 transition-all focus-within:ring-2 focus-within:ring-primary/40"
      >
        <div className="flex-shrink-0 pl-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-orange to-primary flex items-center justify-center shadow-lg animate-pulse shrink-0">
            <Sparkles size={18} className="text-white" />
          </div>
        </div>
        
        <input 
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask AI..." 
          className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-[11px] sm:text-xs placeholder-gray-400 dark:placeholder-gray-600 text-text-primary-light dark:text-text-primary-dark h-7 font-medium min-w-0"
        />
        
        <div className="flex items-center gap-1 pr-0.5">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
          />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark transition-colors shrink-0"
            title="Upload Image"
          >
            <ImageIcon size={14} />
          </button>
          
          <button 
            type="submit"
            disabled={isGenerating || !prompt.trim()}
            className={`p-1 rounded-lg bg-primary text-white transition-all shadow-md hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center w-7 h-7 shrink-0`}
            title="Generate"
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={16} />}
          </button>
        </div>
      </form>
    </div>
  );
};