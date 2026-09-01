import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import pptxgen from 'pptxgenjs';
import { CanvasElement, CanvasConfig } from '../types';

interface CaptureCanvasOptions {
  backgroundColor?: string | null;
}

/**
 * Helper to capture high-quality canvas image
 * Includes optimizations for text rendering, dark mode, and transform normalization.
 */
const captureCanvas = async (element: HTMLElement, options: CaptureCanvasOptions = {}) => {
  // Ensure fonts are fully loaded before capturing
  await document.fonts.ready;

  // Detect if dark mode is active on the root document
  const isDarkMode = document.documentElement.classList.contains('dark');

  return await html2canvas(element, {
    scale: 3, // High resolution (3x)
    useCORS: true,
    allowTaint: true,
    backgroundColor: options.backgroundColor === null ? null : (options.backgroundColor ?? '#ffffff'),
    logging: false,
    onclone: (doc) => {
      // 1. Persist Dark Mode
      if (isDarkMode) {
        doc.documentElement.classList.add('dark');
      }

      // 2. Reset Zoom/Pan Transforms on the canvas board
      const el = doc.querySelector('[style*="transform"]');
      if (el instanceof HTMLElement) {
          el.style.transform = 'none';
      }

      // 3. Prevent Text Clipping (The "Cut Off" Fix)
      // We explicitly set the content wrappers to visible overflow during export
      // so that slightly larger font metrics in the canvas renderer don't get clipped.
      const wrappers = doc.querySelectorAll('.element-content-wrapper');
      wrappers.forEach((wrapper) => {
          if(wrapper instanceof HTMLElement) {
              wrapper.style.overflow = 'visible';
          }
      });

      // Empty layout slots are editor guides, not exported artwork.
      doc.querySelectorAll('[data-layout-slot-empty="true"]').forEach((slot) => slot.remove());

      // 4. Optimize Text Rendering Quality
      const textElements = doc.querySelectorAll('*');
      textElements.forEach((node) => {
          if (node instanceof HTMLElement) {
             const style = window.getComputedStyle(node);
             if (style.fontFamily) {
                 node.style.textRendering = 'geometricPrecision';
                 // These vendor prefixes help in some headless environments
                 node.style.setProperty('-webkit-font-smoothing', 'antialiased');
             }
          }
      });
    }
  });
};

/**
 * Downloads the current canvas view as a PNG image.
 */
export const downloadAsPNG = async (
  canvasRef: React.RefObject<HTMLDivElement | null>,
  filename = 'design-export'
) => {
  if (!canvasRef.current) return;

  try {
    const canvas = await captureCanvas(canvasRef.current, { backgroundColor: null });
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('PNG conversion failed:', error);
    alert('Failed to export as PNG.');
  }
};

/**
 * Downloads the current canvas view as a PDF document.
 */
export const downloadAsPDF = async (
  canvasRef: React.RefObject<HTMLDivElement | null>,
  canvasConfig: CanvasConfig,
  filename = 'design-export'
) => {
  if (!canvasRef.current) return;

  try {
    const { width, height } = canvasConfig;
    const orientation = width > height ? 'landscape' : 'portrait';

    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [width, height],
    });

    const canvas = await captureCanvas(canvasRef.current, { backgroundColor: canvasConfig.backgroundColor });
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, width, height);
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
    alert('Failed to export as PDF.');
  }
};

/**
 * Downloads the current canvas view as a PowerPoint slide.
 */
export const downloadAsPPTX = async (
  canvasRef: React.RefObject<HTMLDivElement | null>,
  canvasConfig: CanvasConfig,
  filename = 'design-presentation'
) => {
  if (!canvasRef.current) return;

  try {
    const pptx = new pptxgen();
    const inchWidth = canvasConfig.width / 96; 
    const inchHeight = canvasConfig.height / 96;

    pptx.defineLayout({ name: 'CUSTOM_LAYOUT', width: inchWidth, height: inchHeight });
    pptx.layout = 'CUSTOM_LAYOUT';

    const slide = pptx.addSlide();
    const canvas = await captureCanvas(canvasRef.current, { backgroundColor: canvasConfig.backgroundColor });
    const imgData = canvas.toDataURL('image/png');

    slide.addImage({
      data: imgData,
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
    });

    await pptx.writeFile({ fileName: `${filename}.pptx` });
  } catch (error) {
    console.error('PPTX export failed:', error);
    alert('Failed to export as PPTX.');
  }
};

/**
 * Exports the full project state (pages + config) as a JSON file.
 */
export const exportAsJSON = (
  pages: CanvasElement[][],
  canvasConfig: CanvasConfig,
  filename = 'project-backup'
) => {
  try {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      canvasConfig,
      pages,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = `${filename}.json`;
    link.href = url;
    link.click();
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('JSON export failed:', error);
    alert('Failed to export JSON.');
  }
};
