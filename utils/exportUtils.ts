import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import pptxgen from 'pptxgenjs';
import { CanvasElement, CanvasConfig } from '../types';
import { getEffectiveDimensions } from '../config/canvasDefaults';

interface CaptureCanvasOptions {
  backgroundColor?: string | null;
}

const CANVAS_EXPORT_ROOT_SELECTOR = '[data-canvas-export-root]';

const resolveCaptureTarget = (root: HTMLElement): HTMLElement => {
  const exportRoot = root.querySelector(CANVAS_EXPORT_ROOT_SELECTOR);
  if (exportRoot instanceof HTMLElement) return exportRoot;
  return root;
};

const getCaptureDimensions = (target: HTMLElement) => {
  const width =
    Number(target.dataset.exportWidth) ||
    target.offsetWidth ||
    target.scrollWidth;
  const height =
    Number(target.dataset.exportHeight) ||
    target.offsetHeight ||
    target.scrollHeight;
  return { width, height };
};

const resetCloneTransforms = (doc: Document, width: number, height: number) => {
  const clonedRoot = doc.querySelector(CANVAS_EXPORT_ROOT_SELECTOR);
  if (!(clonedRoot instanceof HTMLElement)) return;

  let node: HTMLElement | null = clonedRoot;
  while (node) {
    node.style.transform = 'none';
    node = node.parentElement;
  }

  clonedRoot.style.width = `${width}px`;
  clonedRoot.style.height = `${height}px`;
};

const canvasToPngDataUrl = (canvas: HTMLCanvasElement) => {
  const dataUrl = canvas.toDataURL('image/png');
  if (!dataUrl.startsWith('data:image/png;base64,')) {
    throw new Error(`Invalid PNG data URL (canvas ${canvas.width}x${canvas.height})`);
  }
  return dataUrl;
};

/**
 * Helper to capture high-quality canvas image
 * Includes optimizations for text rendering, dark mode, and transform normalization.
 */
const captureCanvas = async (element: HTMLElement, options: CaptureCanvasOptions = {}) => {
  await document.fonts.ready;

  const target = resolveCaptureTarget(element);
  const { width, height } = getCaptureDimensions(target);

  if (width <= 0 || height <= 0) {
    throw new Error(`Cannot capture canvas with zero dimensions (${width}x${height})`);
  }

  const isDarkMode = document.documentElement.classList.contains('dark');

  const canvas = await html2canvas(target, {
    width,
    height,
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: options.backgroundColor === null ? null : (options.backgroundColor ?? '#ffffff'),
    logging: false,
    onclone: (doc) => {
      if (isDarkMode) {
        doc.documentElement.classList.add('dark');
      }

      resetCloneTransforms(doc, width, height);

      const wrappers = doc.querySelectorAll('.element-content-wrapper');
      wrappers.forEach((wrapper) => {
        if (wrapper instanceof HTMLElement) {
          wrapper.style.overflow = 'visible';
        }
      });

      doc.querySelectorAll('[data-layout-slot-empty="true"]').forEach((slot) => slot.remove());
      doc.querySelectorAll('[data-export-hide="true"]').forEach((node) => node.remove());

      const textElements = doc.querySelectorAll('*');
      textElements.forEach((node) => {
        if (node instanceof HTMLElement) {
          const style = window.getComputedStyle(node);
          if (style.fontFamily) {
            node.style.textRendering = 'geometricPrecision';
            node.style.setProperty('-webkit-font-smoothing', 'antialiased');
          }
        }
      });
    },
  });

  return canvas;
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
    const canvas = await captureCanvas(canvasRef.current, { backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvasToPngDataUrl(canvas);
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
    const { width, height } = getEffectiveDimensions(canvasConfig);
    const orientation = width > height ? 'landscape' : 'portrait';

    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [width, height],
    });

    const canvas = await captureCanvas(canvasRef.current, {
      backgroundColor: canvasConfig.backgroundColor ?? '#ffffff',
    });
    const imgData = canvasToPngDataUrl(canvas);
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
    const { width, height } = getEffectiveDimensions(canvasConfig);
    const pptx = new pptxgen();
    const inchWidth = width / 96;
    const inchHeight = height / 96;

    pptx.defineLayout({ name: 'CUSTOM_LAYOUT', width: inchWidth, height: inchHeight });
    pptx.layout = 'CUSTOM_LAYOUT';

    const slide = pptx.addSlide();
    const canvas = await captureCanvas(canvasRef.current, {
      backgroundColor: canvasConfig.backgroundColor ?? '#ffffff',
    });
    const imgData = canvasToPngDataUrl(canvas);

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
