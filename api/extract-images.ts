import type { VercelRequest, VercelResponse } from '@vercel/node';

const MAX_PDF_BYTES = 3 * 1024 * 1024;
const MAX_PDF_PAGES = 50;
const MAX_IMAGE_PIXELS = 16_000_000;
const MAX_IMAGES = 100;
const LIMIT_ERROR = 'PDF exceeds processing limits (maximum 3 MiB and 50 pages).';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the PDF data from request body (base64 encoded)
    const { pdfData } = req.body;
    
    if (!pdfData) {
      return res.status(400).json({ error: 'No PDF data provided' });
    }

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfData, 'base64');
    if (pdfBuffer.byteLength > MAX_PDF_BYTES) {
      return res.status(413).json({ error: LIMIT_ERROR });
    }

    // Load PDF document
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
    });
    
    const pdf = await loadingTask.promise;
    if (pdf.numPages > MAX_PDF_PAGES) {
      return res.status(413).json({ error: LIMIT_ERROR });
    }

    const { createCanvas } = await import('@napi-rs/canvas');
    const images: Array<{
      pageNumber: number;
      index: number;
      width: number;
      height: number;
      dataUrl: string;
    }> = [];

    // Process each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const operators = await page.getOperatorList();
        
        let imageIndex = 0;

        for (let i = 0; i < operators.fnArray.length; i++) {
          if (images.length >= MAX_IMAGES) break;

          // OPS.paintImageXObject = 85
          if (operators.fnArray[i] === 85) {
            try {
              const imageName = operators.argsArray[i][0];
              
              // Get the image object
              let imageObj = null;
              try {
                imageObj = page.objs.get(imageName);
              } catch {
                // Try commonObjs if page.objs fails
                try {
                  imageObj = page.commonObjs.get(imageName);
                } catch {
                  continue;
                }
              }
              
              if (!imageObj || !imageObj.width || !imageObj.height || !imageObj.data) {
                continue;
              }

              const pixelCount = imageObj.width * imageObj.height;
              if (!Number.isFinite(pixelCount) || pixelCount > MAX_IMAGE_PIXELS) {
                continue;
              }

              // Convert raw image data to base64 PNG using canvas
              const canvas = createCanvas(imageObj.width, imageObj.height);
              const ctx = canvas.getContext('2d');
              
              // Create image data
              const imgData = ctx.createImageData(imageObj.width, imageObj.height);
              
              // Determine format based on data length
              const expectedRGBA = imageObj.width * imageObj.height * 4;
              const expectedRGB = imageObj.width * imageObj.height * 3;
              const expectedGray = imageObj.width * imageObj.height;
              
              if (imageObj.data.length === expectedRGBA) {
                // RGBA format
                for (let j = 0; j < imageObj.data.length; j++) {
                  imgData.data[j] = imageObj.data[j];
                }
              } else if (imageObj.data.length === expectedRGB) {
                // RGB format - add alpha channel
                for (let j = 0, k = 0; j < imageObj.data.length; j += 3, k += 4) {
                  imgData.data[k] = imageObj.data[j];
                  imgData.data[k + 1] = imageObj.data[j + 1];
                  imgData.data[k + 2] = imageObj.data[j + 2];
                  imgData.data[k + 3] = 255;
                }
              } else if (imageObj.data.length === expectedGray) {
                // Grayscale - expand to RGBA
                for (let j = 0; j < imageObj.data.length; j++) {
                  const idx = j * 4;
                  imgData.data[idx] = imageObj.data[j];
                  imgData.data[idx + 1] = imageObj.data[j];
                  imgData.data[idx + 2] = imageObj.data[j];
                  imgData.data[idx + 3] = 255;
                }
              } else {
                // Unknown format, skip
                continue;
              }
              
              ctx.putImageData(imgData, 0, 0);
              
              // Convert to data URL
              const dataUrl = canvas.toDataURL('image/png');
              
              images.push({
                pageNumber: pageNum,
                index: imageIndex++,
                width: imageObj.width,
                height: imageObj.height,
                dataUrl
              });
            } catch (imgErr) {
              console.warn(`Failed to extract image from page ${pageNum}:`, imgErr);
            }
          }
        }

        if (images.length >= MAX_IMAGES) break;
      } catch (pageErr) {
        console.warn(`Failed to process page ${pageNum}:`, pageErr);
      }
    }

    return res.status(200).json({ images, totalPages: pdf.numPages });
  } catch (error) {
    console.error('PDF processing error:', error);
    return res.status(500).json({ error: 'Failed to process PDF' });
  }
}
