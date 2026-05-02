import * as pdfjsLib from 'pdfjs-dist';

// Use the unpkg CDN for the worker to avoid Vite bundler complexities
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Converts a PDF File into an array of base64-encoded JPEG images (one per page).
 */
export async function convertPdfToImages(file: File, onProgress?: (status: string) => void): Promise<string[]> {
  onProgress?.('Initializing PDF parser...');
  
  const arrayBuffer = await file.arrayBuffer();
  
  onProgress?.('Loading PDF document...');
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDocument = await loadingTask.promise;
  
  const numPages = pdfDocument.numPages;
  const images: string[] = [];
  
  // A standard scale for a good balance of quality and file size
  const scale = 2.0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(`Extracting page ${pageNum} of ${numPages}...`);
    
    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    
    // Create an off-screen canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error("Could not create canvas context for PDF rendering.");
    }
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const renderContext: any = {
      canvasContext: context,
      viewport: viewport,
    };
    
    await page.render(renderContext).promise;
    
    // Extract base64 image (remove the data:image/jpeg;base64, prefix for Gemini)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64Data = dataUrl.split(',')[1];
    
    images.push(base64Data);
  }
  
  return images;
}
