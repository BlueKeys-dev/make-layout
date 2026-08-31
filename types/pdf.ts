// PDF extraction types

export interface PDFPageText {
  pageNumber: number;
  text: string;
}

export interface PDFText {
  totalPages: number;
  pages: PDFPageText[];
  mergedText: string;
}

export interface PDFImage {
  pageNumber: number;
  index: number; // Index of image on page
  width: number;
  height: number;
  dataUrl: string; // Base64 data URL for display
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
}

export interface PDFLink {
  pageNumber: number;
  url: string;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PDFPage {
  pageNumber: number;
  width: number;
  height: number;
}

export interface PDFDocument {
  pageCount: number;
  pages: PDFPage[];
  metadata: PDFMetadata;
}

export interface PDFExtractionResult {
  document: PDFDocument;
  text: PDFText;
  images: PDFImage[];
  links: PDFLink[];
}
