import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, FileText, Image, Link2, Info, ChevronLeft, ChevronRight, Grid3X3, X, Loader2, Plus } from 'lucide-react';
import {
  extractTextFromPDF,
  extractMetadata,
  extractLinks,
  renderAllPages,
  getPDFDocumentInfo,
  loadPDFDocument,
  extractImages
} from '../services/pdfService';
import type { PDFText, PDFMetadata, PDFLink, PDFDocument, PDFImage } from '../types/pdf';

type TabType = 'pages' | 'text' | 'images' | 'links' | 'metadata';
type DeferredTabData = PDFText | PDFLink[] | PDFImage[];

interface PDFViewerProps {
  onClose?: () => void;
  onAddToCanvas?: (text: string, pageNumber: number) => void;
  onAddAllToCanvas?: (pages: { text: string, pageNumber: number }[]) => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ onClose, onAddToCanvas, onAddAllToCanvas }) => {
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [activeTab, setActiveTab] = useState<TabType>('pages');
  
  // PDF Data
  const [document, setDocument] = useState<PDFDocument | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [text, setText] = useState<PDFText | null>(null);
  const [metadata, setMetadata] = useState<PDFMetadata | null>(null);
  const [links, setLinks] = useState<PDFLink[]>([]);
  const [images, setImages] = useState<PDFImage[]>([]);
  const [pdfProxy, setPdfProxy] = useState<any | null>(null);
  
  // Selected page for detailed view
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedTabsRef = useRef<Set<TabType>>(new Set());
  const tabLoadsRef = useRef<Map<TabType, Promise<DeferredTabData>>>(new Map());
  const fileLoadIdRef = useRef(0);

  const handleFileSelect = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert('PDF is too large. The maximum supported size is 3 MiB.');
      return;
    }

    const loadId = fileLoadIdRef.current + 1;
    fileLoadIdRef.current = loadId;
    loadedTabsRef.current = new Set();
    tabLoadsRef.current = new Map();
    setPdfBuffer(null);
    setPdfProxy(null);
    setDocument(null);
    setPageImages([]);
    setText(null);
    setMetadata(null);
    setLinks([]);
    setImages([]);
    setSelectedPage(null);
    setActiveTab('pages');
    setIsLoading(true);
    setFileName(file.name);
    
    try {
      const buffer = await file.arrayBuffer();
      // Create a copy of the buffer for later use (original gets detached)
      const bufferCopy = buffer.slice(0);

      // Load PDF proxy once
      const pdfProxy = await loadPDFDocument(buffer);
      if (fileLoadIdRef.current !== loadId) return;
      if (pdfProxy.numPages > 50) {
        setFileName('');
        alert('PDF has too many pages. The maximum supported is 50 pages.');
        return;
      }
      setPdfBuffer(bufferCopy);
      setPdfProxy(pdfProxy);

      // Extract document info
      const doc = await getPDFDocumentInfo(pdfProxy);
      if (fileLoadIdRef.current !== loadId) return;
      setDocument(doc);
      setMetadata(doc.metadata);
      loadedTabsRef.current.add('metadata');
      
      // Render all pages using the proxy
      const images = await renderAllPages(pdfProxy, 1.0, (current, total) => {
        if (fileLoadIdRef.current === loadId) setLoadingProgress({ current, total });
      });
      if (fileLoadIdRef.current !== loadId) return;
      setPageImages(images);
      loadedTabsRef.current.add('pages');
      setActiveTab('pages');
    } catch (error) {
      console.error('Error loading PDF:', error);
      alert('Error loading PDF file. Please try again.');
    } finally {
      if (fileLoadIdRef.current === loadId) {
        setIsLoading(false);
        setLoadingProgress({ current: 0, total: 0 });
      }
    }
  }, []);

  useEffect(() => {
    if (!pdfBuffer || !pdfProxy || loadedTabsRef.current.has(activeTab)) return;
    if (activeTab !== 'text' && activeTab !== 'links' && activeTab !== 'images') return;

    let cancelled = false;
    let loadPromise = tabLoadsRef.current.get(activeTab);
    if (!loadPromise) {
      if (activeTab === 'text') loadPromise = extractTextFromPDF(pdfProxy, false);
      else if (activeTab === 'links') loadPromise = extractLinks(pdfProxy);
      else loadPromise = extractImages(pdfBuffer);
      tabLoadsRef.current.set(activeTab, loadPromise);
    }

    void loadPromise.then((data) => {
      if (cancelled) return;
      if (activeTab === 'text') setText(data as PDFText);
      else if (activeTab === 'links') setLinks(data as PDFLink[]);
      else setImages(data as PDFImage[]);
      loadedTabsRef.current.add(activeTab);
    }).catch((error) => {
      if (tabLoadsRef.current.get(activeTab) === loadPromise) {
        tabLoadsRef.current.delete(activeTab);
      }
      if (!cancelled) console.error(`Failed to load PDF ${activeTab}:`, error);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, pdfBuffer, pdfProxy]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const resetViewer = useCallback(() => {
    fileLoadIdRef.current += 1;
    loadedTabsRef.current = new Set();
    tabLoadsRef.current = new Map();
    setPdfBuffer(null);
    setPdfProxy(null);
    setFileName('');
    setDocument(null);
    setPageImages([]);
    setText(null);
    setMetadata(null);
    setLinks([]);
    setImages([]);
    setSelectedPage(null);
    setActiveTab('pages');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'pages', label: 'Pages', icon: <Grid3X3 size={16} /> },
    { id: 'text', label: 'Text', icon: <FileText size={16} /> },
    { id: 'images', label: 'Images', icon: <Image size={16} /> },
    { id: 'links', label: 'Links', icon: <Link2 size={16} /> },
    { id: 'metadata', label: 'Info', icon: <Info size={16} /> },
  ];

  // Render page detail view
  if (selectedPage !== null) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button onClick={() => setSelectedPage(null)} style={styles.backButton}>
            <ChevronLeft size={20} />
            Back to Pages
          </button>
          <span style={styles.pageIndicator}>Page {selectedPage} of {document?.pageCount}</span>
          <div style={styles.pageNavigation}>
            <button
              onClick={() => setSelectedPage(Math.max(1, selectedPage - 1))}
              disabled={selectedPage <= 1}
              style={styles.navButton}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setSelectedPage(Math.min(document?.pageCount || 1, selectedPage + 1))}
              disabled={selectedPage >= (document?.pageCount || 1)}
              style={styles.navButton}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <div style={styles.pageDetailContent}>
          <div style={styles.pageImageContainer}>
            <img
              src={pageImages[selectedPage - 1]}
              alt={`Page ${selectedPage}`}
              style={styles.pageImageLarge}
            />
          </div>
          <div style={styles.pageTextContainer}>
            <h3 style={styles.sectionTitle}>Page Text</h3>
            <pre style={styles.pageText}>
              {text?.pages.find(p => p.pageNumber === selectedPage)?.text || 'No text found on this page'}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // Render upload view
  if (!pdfBuffer) {
    return (
      <div style={styles.container}>
        {onClose && (
          <button onClick={onClose} style={styles.closeButton}>
            <X size={20} />
          </button>
        )}
        <div
          style={styles.dropzone}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={48} style={{ color: '#6366f1', marginBottom: 16 }} />
          <h2 style={styles.dropzoneTitle}>Upload PDF</h2>
          <p style={styles.dropzoneText}>
            Drag and drop a PDF file here, or click to select
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>
    );
  }

  // Render loading view
  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <Loader2 size={48} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
          <h2 style={styles.loadingTitle}>Loading PDF...</h2>
          {loadingProgress.total > 0 && (
            <p style={styles.loadingText}>
              Rendering page {loadingProgress.current} of {loadingProgress.total}
            </p>
          )}
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: loadingProgress.total > 0
                  ? `${(loadingProgress.current / loadingProgress.total) * 100}%`
                  : '0%'
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {onClose && (
        <button onClick={onClose} style={styles.closeButton}>
          <X size={20} />
        </button>
      )}
      
      {/* Header */}
      <div style={styles.mainHeader}>
        <div style={styles.fileInfo}>
          <FileText size={24} style={{ color: '#6366f1' }} />
          <div>
            <h2 style={styles.fileName}>{fileName}</h2>
            <p style={styles.pageCount}>{document?.pageCount} pages</p>
          </div>
        </div>
        <button onClick={resetViewer} style={styles.newFileButton}>
          <Upload size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.activeTab : {})
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'pages' && (
          <div style={styles.pagesGrid}>
            {pageImages.map((image, index) => (
              <div
                key={index}
                style={styles.pageCard}
                onClick={() => setSelectedPage(index + 1)}
              >
                <img src={image} alt={`Page ${index + 1}`} style={styles.pageThumb} />
                <span style={styles.pageNumber}>Page {index + 1}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'text' && (
          <div style={styles.textContent}>
            {onAddAllToCanvas && text && text.pages.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                <button
                  onClick={() => onAddAllToCanvas(text.pages.map(p => ({ text: p.text, pageNumber: p.pageNumber })))}
                  style={{ ...styles.addButton, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(79, 70, 229, 0.2) 100%)', border: '1px solid rgba(99, 102, 241, 0.5)', color: '#a5b4fc', padding: '10px 20px', fontSize: 13 }}
                  title="Add all pages as new boards to the workspace"
                >
                  <Plus size={16} /> Add All Text to Canvas
                </button>
              </div>
            )}
            {text?.pages.map((page) => (
              <div key={page.pageNumber} style={styles.textPage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={styles.textPageTitle}>Page {page.pageNumber}</h3>
                  {onAddToCanvas && (
                    <button
                      onClick={() => onAddToCanvas(page.text, page.pageNumber)}
                      style={styles.addButton}
                      title="Add text to workspace as a new board"
                    >
                      <Plus size={14} /> Add to Canvas
                    </button>
                  )}
                </div>
                <pre style={styles.textBody}>{page.text || 'No text on this page'}</pre>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'images' && (
          <div style={styles.imagesContent}>
            <p style={{ ...styles.infoText, marginBottom: 16, maxWidth: 'none', padding: '12px 16px' }}>
              📄 Page renders shown below. Individual embedded image extraction requires server-side processing.
            </p>
            {images.length === 0 ? (
              <p style={styles.infoText}>Loading page images...</p>
            ) : (
              <div style={styles.imagesGrid}>
                {images.map((img, index) => (
                  <div key={index} style={styles.imageCard}>
                    <img src={img.dataUrl} alt={`Page ${img.pageNumber}`} style={styles.imageThumb} />
                    <div style={styles.imageInfo}>
                      <span style={styles.imagePage}>Page {img.pageNumber}</span>
                      <span style={styles.imageDimensions}>{img.width} × {img.height}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'links' && (
          <div style={styles.linksContent}>
            {links.length === 0 ? (
              <p style={styles.infoText}>No links found in this PDF.</p>
            ) : (
              <div style={styles.linksList}>
                {links.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.linkItem}
                  >
                    <Link2 size={16} />
                    <span style={styles.linkPage}>Page {link.pageNumber}</span>
                    <span style={styles.linkUrl}>{link.url}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'metadata' && (
          <div style={styles.metadataContent}>
            <table style={styles.metadataTable}>
              <tbody>
                {Object.entries(metadata || {}).map(([key, value]) => (
                  value && (
                    <tr key={key}>
                      <td style={styles.metadataKey}>{key}</td>
                      <td style={styles.metadataValue}>{String(value)}</td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.95) 0%, rgba(20, 20, 50, 0.9) 50%, rgba(15, 15, 35, 0.95) 100%)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    color: '#e2e8f0',
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 10,
    padding: 10,
    color: '#e2e8f0',
    cursor: 'pointer',
    zIndex: 10,
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
  },
  dropzone: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 32,
    border: '2px dashed rgba(139, 92, 246, 0.5)',
    borderRadius: 24,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
    backdropFilter: 'blur(10px)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  dropzoneTitle: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 12,
    background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  dropzoneText: {
    fontSize: 15,
    color: '#94a3b8',
  },
  loadingContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: '#e2e8f0',
  },
  loadingText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  progressBar: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    transition: 'width 0.2s',
  },
  mainHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 28px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset',
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  fileName: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  pageCount: {
    fontSize: 13,
    color: '#64748b',
    margin: 0,
    fontWeight: 500,
  },
  newFileButton: {
    display: 'flex',
    margin: '0 60px',
    alignItems: 'center',
    gap: 8,
    padding: '15px 20px',
    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(59, 130, 246, 0.2) 100%)',
    border: '1px solid rgba(139, 92, 246, 0.4)',
    borderRadius: 12,
    color: '#c4b5fd',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.2)',
  },
  tabBar: {
    display: 'flex',
    gap: 8,
    padding: '12px 28px',
    background: 'rgba(0,0,0,0.2)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    overflowX: 'auto',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(5px)',
  },
  activeTab: {
    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(59, 130, 246, 0.15) 100%)',
    border: '1px solid rgba(139, 92, 246, 0.4)',
    color: '#c4b5fd',
    boxShadow: '0 4px 20px rgba(139, 92, 246, 0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: 28,
    background: 'rgba(0,0,0,0.1)',
  },
  pagesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 20,
  },
  pageCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 12,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
    backdropFilter: 'blur(10px)',
    borderRadius: 16,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
    position: 'relative',
    overflow: 'hidden',
  },
  pageThumb: {
    width: '100%',
    height: 'auto',
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    transition: 'transform 0.3s ease',
  },
  pageNumber: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: 600,
    color: '#94a3b8',
    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%)',
    padding: '4px 12px',
    borderRadius: 8,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 16px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: 8,
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: 14,
  },
  pageIndicator: {
    fontSize: 16,
    fontWeight: 500,
    color: '#e2e8f0',
  },
  pageNavigation: {
    display: 'flex',
    gap: 8,
  },
  navButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: 8,
    color: '#e2e8f0',
    cursor: 'pointer',
  },
  pageDetailContent: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
    padding: 24,
    overflow: 'hidden',
  },
  pageImageContainer: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'auto',
  },
  pageImageLarge: {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: 8,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  pageTextContainer: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
    color: '#e2e8f0',
  },
  pageText: {
    flex: 1,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.6,
    color: '#cbd5e1',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas',
  },
  textContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  textPage: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    border: '1px solid rgba(255,255,255,0.1)',
  },
  textPageTitle: {
    fontSize: 14,
    fontWeight: 600,
    margin: 0,
    color: '#a5b4fc',
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    color: '#34d399',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    transition: 'all 0.2s ease',
  },
  textBody: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: '#cbd5e1',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas',
  },
  imagesContent: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  imagesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 16,
  },
  imageCard: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    transition: 'all 0.2s',
  },
  imageThumb: {
    width: '100%',
    height: 'auto',
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    backgroundColor: '#fff',
  },
  imageInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 8,
    fontSize: 11,
  },
  imagePage: {
    color: '#6366f1',
    backgroundColor: 'rgba(241, 241, 248, 0.2)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  imageDimensions: {
    color: '#94a3b8',
  },
  infoText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    padding: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    maxWidth: 400,
  },
  linksContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  linksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  linkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    textDecoration: 'none',
    color: '#e2e8f0',
    transition: 'background-color 0.2s',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  linkPage: {
    fontSize: 12,
    color: '#dfdfecff',
    backgroundColor: 'rgba(220, 220, 231, 0.2)',
    padding: '2px 8px',
    borderRadius: 4,
  },
  linkUrl: {
    flex: 1,
    fontSize: 13,
    color: '#a5b4fc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  metadataContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  metadataTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  metadataKey: {
    padding: '12px 16px',
    textTransform: 'capitalize',
    fontWeight: 500,
    color: '#94a3b8',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    width: '30%',
  },
  metadataValue: {
    padding: '12px 16px',
    color: '#e2e8f0',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
};

// Add CSS animation for spinner
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default PDFViewer;
