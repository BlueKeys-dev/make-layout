import React from 'react';
import { AIModelId } from '../../types';
import { AI_MODELS } from '../../services/aiProviders';

interface AIModelSelectorProps {
  activeModelId: AIModelId;
  onSelectModel: (modelId: AIModelId) => void;
}

export const AIModelSelector: React.FC<AIModelSelectorProps> = ({
  activeModelId,
  onSelectModel,
}) => {
  return (
    <div className="flex items-center gap-3">
      {AI_MODELS.map((model) => {
        const isActive = model.id === activeModelId;
        return (
          <button
            key={model.id}
            onClick={() => onSelectModel(model.id)}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              isActive
                ? 'bg-orange-600/20 text-orange-500 border border-orange-500/20 shadow-lg'
                : 'text-white/20 hover:text-white/40 border border-transparent'
            }`}
          >
            <span className="text-[16px]">{model.icon}</span>
            <span>{model.name.replace('Gemini ', '')}</span>
          </button>
        );
      })}
    </div>
  );
};
