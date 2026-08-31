import React, { useState } from 'react';
import { ChatMessage as ChatMessageType } from '../../types';
import { getModelById } from '../../services/aiProviders';
import { User, Sparkles, Maximize2, Plus, X, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ImageResult {
  id: string;
  url: string;
  thumbnail: string;
  alt: string;
  photographer: string;
}

interface ChatMessageProps {
  message: ChatMessageType;
  onSelectImage?: (image: ImageResult) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSelectImage }) => {
  const isUser = message.role === 'user';
  const model = message.modelId ? getModelById(message.modelId) : null;
  const [previewImage, setPreviewImage] = useState<ImageResult | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const handleSelectImage = (img: ImageResult) => {
    if (onSelectImage) {
      onSelectImage(img);
      setSelectedImages(prev => new Set(prev).add(img.id));
    }
  };

  const images = message.imageSearchResults || [];
  const visibleImages = showAll ? images : images.slice(0, 4);
  const hasMore = images.length > 4;

  return (
    <>
      <div
        className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 pt-0.5">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg ${
              isUser
                ? 'bg-blue-600/80 text-white'
                : 'bg-orange-600/90 text-white text-[18px]'
            }`}
          >
            {isUser ? (
              <User size={20} />
            ) : (
              <Sparkles size={18} fill="currentColor" />
            )}
          </div>
        </div>

        {/* Message Bubble */}
        <div
          className={`max-w-[85%] rounded-[24px] px-5 py-4 ${
            isUser
              ? 'bg-blue-600/20 text-white rounded-br-md border border-white/5'
              : 'bg-[#1c1c1e]/90 text-white rounded-bl-md border border-white/5'
          } shadow-xl backdrop-blur-md`}
        >
          {!isUser && (
            <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-white/40 tracking-wider">
              <Sparkles size={12} className="opacity-50" />
              <span>{model?.name ? model.name.toUpperCase() : 'GEMINI 3 FLASH'}</span>
            </div>
          )}
          <div className={`text-[14px] leading-[1.6] prose prose-sm dark:prose-invert max-w-none ${isUser ? 'text-white/90' : 'text-white/90'}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
          
          {/* Image Search Results */}
          {images.length > 0 && (
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-3">
                {visibleImages.map((img, index) => {
                  const isSelected = selectedImages.has(img.id);
                  return (
                    <div 
                      key={img.id} 
                      className={`group relative overflow-hidden rounded-xl border bg-black/20 transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-green-500/70 ring-2 ring-green-500/30' 
                          : 'border-white/10 hover:border-orange-500/50'
                      }`}
                    >
                      <img 
                        src={img.thumbnail} 
                        alt={img.alt}
                        className="w-full h-32 object-cover"
                        loading="lazy"
                      />
                      
                      {/* Hover Overlay with Actions */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {/* Action Buttons - Top Right */}
                        <div className="absolute top-2 right-2 flex gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage(img);
                            }}
                            className="p-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg transition-all hover:scale-105"
                            title="Preview Image"
                          >
                            <Maximize2 size={14} className="text-white" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectImage(img);
                            }}
                            disabled={isSelected}
                            className={`p-1.5 backdrop-blur-sm rounded-lg transition-all hover:scale-105 ${
                              isSelected 
                                ? 'bg-green-500/80 cursor-default' 
                                : 'bg-orange-500/80 hover:bg-orange-500'
                            }`}
                            title={isSelected ? "Added to Canvas" : "Add to Canvas"}
                          >
                            {isSelected ? (
                              <Check size={14} className="text-white" />
                            ) : (
                              <Plus size={14} className="text-white" />
                            )}
                          </button>
                        </div>
                        
                        {/* Image Info - Bottom */}
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <div className="text-[10px] font-bold text-white line-clamp-1">{index + 1}. {img.alt}</div>
                          <div className="text-[9px] text-white/60">by {img.photographer}</div>
                        </div>
                      </div>

                      {/* Selected Badge */}
                      {isSelected && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-green-500/90 rounded-full text-[9px] font-bold text-white flex items-center gap-1">
                          <Check size={10} />
                          Added
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {hasMore && (
                <button 
                  onClick={() => setShowAll(!showAll)}
                  className="mt-3 w-full py-2 text-xs font-medium text-white/70 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5 flex items-center justify-center gap-2"
                >
                  {showAll ? 'Show Less' : `Show ${images.length - 4} More Images`}
                </button>
              )}
            </div>
          )}
          <div className={`text-[10px] mt-4 opacity-30 font-mono tracking-tighter ${isUser ? 'text-right' : 'text-left'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-[90vw] max-h-[90vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all z-10 border border-white/20"
            >
              <X size={18} className="text-white" />
            </button>

            {/* Image */}
            <img 
              src={previewImage.url} 
              alt={previewImage.alt}
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />

            {/* Image Info & Actions */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent rounded-b-2xl">
              <div className="flex items-end justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white line-clamp-2">{previewImage.alt}</div>
                  <div className="text-xs text-white/60 mt-1">by {previewImage.photographer}</div>
                </div>
                <button
                  onClick={() => {
                    handleSelectImage(previewImage);
                    setPreviewImage(null);
                  }}
                  disabled={selectedImages.has(previewImage.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    selectedImages.has(previewImage.id)
                      ? 'bg-green-500/80 text-white cursor-default'
                      : 'bg-orange-500 hover:bg-orange-400 text-white'
                  }`}
                >
                  {selectedImages.has(previewImage.id) ? (
                    <>
                      <Check size={16} />
                      Added
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Add to Canvas
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
