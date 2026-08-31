import { AIModel, AIModelId } from '../types';

// =====================
// AI Model Definitions
// =====================

// Extended configurations for Gemini 3
export const AI_MODELS: AIModel[] = [
  {
    id: 'gemini-3.5-flash-preview',
    name: 'fast',
    description: 'Fast layout generation & text processing',
    icon: '⚡',
    specialization: 'layout',
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Pro',
    description: 'Deep reasoning & image analysis',
    icon: '✨',
    specialization: 'analysis',
  },
];

export const getModelById = (id: AIModelId): AIModel | undefined => {
  return AI_MODELS.find(model => model.id === id);
};

export const getDefaultModel = (): AIModel => {
  return AI_MODELS[0];
};

// =====================
// Canvas Screenshot Utility
// =====================

export const captureCanvasScreenshot = async (
  canvasRef: React.RefObject<HTMLDivElement>
): Promise<string | null> => {
  if (!canvasRef.current) return null;

  try {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(canvasRef.current, {
      backgroundColor: null,
      scale: 1,
      useCORS: true,
      logging: false,
      allowTaint: true,
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Failed to capture canvas screenshot:', error);
    return null;
  }
};

// =====================
// Model Config Helpers
// =====================

export const getModelConfig = (modelId: AIModelId, hasImages: boolean) => {
    // If we have images, we prefer Pro or at least Flash with Image capabilities
    // But Gemini 3 models both support images, differing in quality/token cost.
    
    // Default to 'high' reasoning for Pro, 'low' for Flash for speed unless complex
    let thinkingLevel = 'medium';
    if (modelId === 'gemini-3-pro-preview') {
        thinkingLevel = 'high';
    }

    let mediaResolution = 'media_resolution_medium';
    if (modelId === 'gemini-3-pro-preview' && hasImages) {
        mediaResolution = 'media_resolution_high';
    }

    return {
        thinkingLevel,
        mediaResolution,
    };
};
