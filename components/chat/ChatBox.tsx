import React, { useRef, useEffect } from 'react';
import { ChatMessage as ChatMessageType, LayoutPlan } from '../../types';
import { ChatMessage } from './ChatMessage';
import { LayoutPlanCard } from './LayoutPlanCard';
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

interface ImageResult {
  id: string;
  url: string;
  thumbnail: string;
  alt: string;
  photographer: string;
}

interface ChatBoxProps {
  messages: ChatMessageType[];
  pendingPlan: LayoutPlan | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onProceedPlan: () => void;
  onModifyPlan: () => void;
  isGenerating: boolean;
  onSelectImage?: (image: ImageResult) => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({
  messages,
  pendingPlan,
  isExpanded,
  onToggleExpand,
  onProceedPlan,
  onModifyPlan,
  isGenerating,
  onSelectImage,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingPlan]);

  return (
    <div className="w-full flex flex-col">
      {/* Chat Header */}
      <div className="relative">
        <button
          onClick={onToggleExpand}
          className="w-full flex items-center gap-2 p-2 text-sm font-medium text-white/50 hover:text-white transition-colors"
        >
          <MessageSquare size={18} />
          <span className="tracking-tight">Chat History</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-orange-600/80 text-white text-[10px] flex items-center justify-center font-bold">
              {messages.length || 0}
            </div>
            <ChevronDown size={18} className={`transition-transform duration-300 ${isExpanded ? '' : 'rotate-180'}`} />
          </div>
        </button>
        {/* Accent Bar */}
        <div className="absolute bottom-0 right-[15%] left-[35%] h-[3px] bg-gradient-to-r from-orange-500/0 via-orange-500 to-orange-500/0 rounded-full" />
      </div>

      {/* Messages Container */}
      {isExpanded && (
        <div
          ref={scrollRef}
          className="max-h-[500px] overflow-y-auto px-5 pb-5 space-y-4 pt-2"
        >
          {messages.length === 0 ? (
            <div className="text-center py-12 text-white/20">
              <MessageSquare size={48} className="mx-auto mb-3 opacity-10" />
              <p className="text-sm font-medium">No messages yet</p>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onSelectImage={onSelectImage} />
            ))
          )}

          {pendingPlan && (
            <LayoutPlanCard
              plan={pendingPlan}
              onProceed={onProceedPlan}
              onModify={onModifyPlan}
              isGenerating={isGenerating}
            />
          )}

          {isGenerating && !pendingPlan && (
            <div className="flex items-center gap-3 text-white/30 text-xs pl-12">
               <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>Gemini is thinking...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

