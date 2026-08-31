// PDF Extraction Service using unpdf library

import { extractText, getDocumentProxy, getMeta } from 'unpdf';
import type { PDFText, PDFPageText, PDFMetadata, PDFLink, PDFDocument, PDFPage, PDFImage } from '../types/pdf';

export type PDFProxy = ReturnType<typeof getDocumentProxy>;

/**
 * Load a PDF document from buffer
 */
export async function loadPDFDocument(buffer: ArrayBuffer): Promise<any> {
  return await getDocumentProxy(new Uint8Array(buffer));
}

/**
 * Extract text from a loaded PDF document
 */
export async function extractTextFromPDF(pdf: any, mergePages: boolean = false): Promise<PDFText> {
  if (mergePages) {
    const { text } = await extractText(pdf, { mergePages: true });
    return {
      totalPages: pdf.numPages,
      pages: [],
      mergedText: text as string
    };
  }
  
  // Extract text page by page
  const { text: pagesText } = await extractText(pdf, { mergePages: false });
  const pages: PDFPageText[] = (pagesText as string[]).map((text, index) => ({
    pageNumber: index + 1,
    text
  }));
  
  return {
    totalPages: pdf.numPages,
    pages,
    mergedText: pages.map(p => p.text).join('\n\n')
  };
}

/**
 * Extract metadata from a loaded PDF document
 */
export async function extractMetadata(pdf: any): Promise<PDFMetadata> {
  const meta = await getMeta(pdf);
  
  return {
    title: meta.info?.Title as string | undefined,
    author: meta.info?.Author as string | undefined,
    subject: meta.info?.Subject as string | undefined,
    keywords: meta.info?.Keywords as string | undefined,
    creator: meta.info?.Creator as string | undefined,
    producer: meta.info?.Producer as string | undefined,
    creationDate: meta.info?.CreationDate as string | undefined,
    modificationDate: meta.info?.ModDate as string | undefined
  };
}

/**
 * Get PDF document info including page count and dimensions
 */
export async function getPDFDocumentInfo(pdf: any): Promise<PDFDocument> {
  const metadata = await extractMetadata(pdf);
  
  const pages: PDFPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    pages.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height
    });
  }
  
  return {
    pageCount: pdf.numPages,
    pages,
    metadata
  };
}

/**
 * Extract links from a loaded PDF document
 */
export async function extractLinks(pdf: any): Promise<PDFLink[]> {
  const links: PDFLink[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const annotations = await page.getAnnotations();
      
      for (const annotation of annotations) {
        if (annotation.subtype === 'Link' && annotation.url) {
          links.push({
            pageNumber: i,
            url: annotation.url,
            rect: annotation.rect ? {
              x: annotation.rect[0],
              y: annotation.rect[1],
              width: annotation.rect[2] - annotation.rect[0],
              height: annotation.rect[3] - annotation.rect[1]
            } : undefined
          });
        }
      }
    } catch (err) {
      console.warn(`Failed to extract links from page ${i}:`, err);
    }
  }
  
  return links;
}

/**
 * Render a PDF page to canvas and return as data URL
 */
export async function renderPageToDataURL(
  pdf: any, 
  pageNumber: number, 
  scale: number = 1.5
): Promise<string> {
  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    throw new Error(`Invalid page number: ${pageNumber}. Document has ${pdf.numPages} pages.`);
  }
  
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  
  // Create canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get canvas context');
  }
  
  // Render page to canvas
  await (page.render({
    canvasContext: context,
    viewport,
    canvas
  } as any)).promise;
  
  return canvas.toDataURL('image/png');
}

/**
 * Render all pages of a PDF to data URLs
 */
export async function renderAllPages(
  pdf: any, 
  scale: number = 1.0,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const pageImages: string[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const dataUrl = await renderPageToDataURL(pdf, i, scale);
      pageImages.push(dataUrl);
    } catch (err) {
      console.warn(`Failed to render page ${i}:`, err);
      pageImages.push('');
    }
    onProgress?.(i, pdf.numPages);
  }
  
  return pageImages;
}

/**
 * Extract images using serverless API (for production)
 * Falls back to page renders if API is unavailable or running locally
 */
export async function extractImages(pdfBuffer: ArrayBuffer): Promise<PDFImage[]> {
  // Check if running on localhost - serverless functions don't work locally
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  // On localhost, skip API call and use page renders directly
  if (isLocalhost) {
    console.log('Running locally - using page renders for images');
    return extractImagesFromPages(pdfBuffer);
  }
  
  try {
    // Try serverless API in production
    const base64Data = arrayBufferToBase64(pdfBuffer);
    
    const response = await fetch('/api/extract-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pdfData: base64Data })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.images && data.images.length > 0) {
        return data.images;
      }
    }
    
    console.warn('Serverless API returned no images, falling back to page renders');
  } catch (err) {
    console.warn('Serverless API unavailable, falling back to page renders:', err);
  }
  
  // Fallback: return page renders as images
  return extractImagesFromPages(pdfBuffer);
}

/**
 * Fallback: Extract page renders as images
 */
async function extractImagesFromPages(buffer: ArrayBuffer): Promise<PDFImage[]> {
  const images: PDFImage[] = [];
  // Make a copy of the buffer to avoid detachment issues
  const bufferCopy = buffer.slice(0);
  const pdf = await loadPDFDocument(bufferCopy);
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    try {
      const dataUrl = await renderPageToDataURL(pdf, pageNum, 1.5);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      
      images.push({
        pageNumber: pageNum,
        index: 0,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
        dataUrl
      });
    } catch (err) {
      console.warn(`Failed to render page ${pageNum} as image:`, err);
    }
  }
  
  return images;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
