
export interface ImageSearchResult {
  id: string;
  url: string; // Regular URL for canvas
  thumbnail: string; // Small URL for preview
  alt: string;
  photographer: string;
  photographerUrl: string;
}

// Image Registry - stores user images with sequential IDs for AI reference
export interface RegisteredImage {
  registryId: string; // e.g., "IMAGE_1", "IMAGE_2"
  url: string;
  thumbnail?: string;
  keywords: string[];
  description?: string;
  width?: number;
  height?: number;
  addedAt: number;
}

// Generate next registry ID
export const generateRegistryId = (existingImages: RegisteredImage[]): string => {
  const maxNum = existingImages.reduce((max, img) => {
    const match = img.registryId.match(/IMAGE_(\d+)/);
    return match ? Math.max(max, parseInt(match[1])) : max;
  }, 0);
  return `IMAGE_${maxNum + 1}`;
};

// Create a new registered image entry
export const createRegisteredImage = (
  existingImages: RegisteredImage[],
  url: string,
  options?: {
    thumbnail?: string;
    keywords?: string[];
    description?: string;
    width?: number;
    height?: number;
  }
): RegisteredImage => {
  return {
    registryId: generateRegistryId(existingImages),
    url,
    thumbnail: options?.thumbnail || url,
    keywords: options?.keywords || [],
    description: options?.description,
    width: options?.width,
    height: options?.height,
    addedAt: Date.now(),
  };
};

// Format registry for AI context
export const formatImageRegistryForAI = (images: RegisteredImage[]): string => {
  if (images.length === 0) return '';

  const imageList = images.map(img =>
    `  - ${img.registryId}: "${img.description || img.keywords.join(', ') || 'User image'}" (${img.width || '?'}x${img.height || '?'})`
  ).join('\n');

  return `\n\nAvailable User Images (use these IDs in "src" field for image elements):\n${imageList}`;
};

// Replace registry IDs with actual URLs in layout elements
export const resolveImageReferences = (
  elements: any[],
  registry: RegisteredImage[]
): any[] => {
  return elements.map(el => {
    if (el.type === 'image' && el.src) {
      // Check if src is a registry ID (IMAGE_1, IMAGE_2, etc.)
      const match = el.src.match(/^IMAGE_(\d+)$/i);
      if (match) {
        const found = registry.find(img => img.registryId.toUpperCase() === el.src.toUpperCase());
        if (found) {
          console.log(`[ImageRegistry] Resolved ${el.src} -> ${found.url}`);
          return { ...el, src: found.url };
        }
      }
    }
    return el;
  });
};

export const searchImages = async (query: string, signal?: AbortSignal): Promise<ImageSearchResult[]> => {
  // Search always goes through the /api/search-images serverless route, which
  // owns UNSPLASH_ACCESS_KEY. Static or unconfigured deployments return [].
  try {
    const response = await fetch('/api/search-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal,
    });

    if (!response.ok) return [];

    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return results.map((result: any) => ({
      id: result.id,
      url: result.url,
      thumbnail: result.thumbnail,
      alt: result.alt,
      photographer: result.photographer,
      photographerUrl: result.photographerUrl,
    }));
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    console.error("Error searching images:", error);
    return [];
  }
};
