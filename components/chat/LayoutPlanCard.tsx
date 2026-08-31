import React from 'react';
import { LayoutPlan } from '../../types';
import { Check, Edit3, Layout, Loader2 } from 'lucide-react';

interface LayoutPlanCardProps {
  plan: LayoutPlan;
  onProceed: () => void;
  onModify: () => void;
  isGenerating: boolean;
}

export const LayoutPlanCard: React.FC<LayoutPlanCardProps> = ({
  plan,
  onProceed,
  onModify,
  isGenerating,
}) => {
  return (
    <div className="bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300 shadow-xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Layout size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-text-primary-light dark:text-text-primary-dark text-sm">
            {plan.title || 'Layout Proposal'}
          </h4>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5 line-clamp-2">
            {plan.description}
          </p>
        </div>
      </div>

      {/* Elements Preview */}
      <div className="flex flex-wrap gap-1.5">
        {plan.elements.slice(0, 5).map((el) => (
          <span
            key={el.id}
            className="text-[10px] px-2 py-1 bg-white/20 dark:bg-black/20 rounded-md text-text-secondary-light dark:text-text-secondary-dark border border-white/10 dark:border-white/5"
          >
            {el.name || el.type}
          </span>
        ))}
        {plan.elements.length > 5 && (
          <span className="text-[10px] px-2 py-1 text-primary font-medium">
            +{plan.elements.length - 5} more
          </span>
        )}
      </div>

      {/* Reasoning */}
      {plan.reasoning && (
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark bg-white/30 dark:bg-black/10 rounded-lg p-2 italic">
          💡 {plan.reasoning}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onProceed}
          disabled={isGenerating}
          className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Check size={16} />
          )}
          <span>Proceed</span>
        </button>
        <button
          onClick={onModify}
          disabled={isGenerating}
          className="flex items-center justify-center gap-2 bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800 text-text-primary-light dark:text-text-primary-dark px-4 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Edit3 size={16} />
          <span>Modify</span>
        </button>
      </div>
    </div>
  );
};
