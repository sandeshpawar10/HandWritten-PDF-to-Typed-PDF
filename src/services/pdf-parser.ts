// import * as pdfjsLib from 'pdfjs-dist';

// // Use the unpkg CDN for the worker to avoid Vite bundler complexities
// pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// /**
//  * Converts a PDF File into an array of base64-encoded JPEG images (one per page).
//  */
// export async function convertPdfToImages(file: File, onProgress?: (status: string) => void): Promise<string[]> {
//   onProgress?.('Initializing PDF parser...');
  
//   const arrayBuffer = await file.arrayBuffer();
  
//   onProgress?.('Loading PDF document...');
//   const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
//   const pdfDocument = await loadingTask.promise;
  
//   const numPages = pdfDocument.numPages;
//   const images: string[] = [];
  
//   // A standard scale for a good balance of quality and file size
//   const scale = 2.0;

//   for (let pageNum = 1; pageNum <= numPages; pageNum++) {
//     onProgress?.(`Extracting page ${pageNum} of ${numPages}...`);
    
//     const page = await pdfDocument.getPage(pageNum);
//     const viewport = page.getViewport({ scale });
    
//     // Create an off-screen canvas
//     const canvas = document.createElement('canvas');
//     const context = canvas.getContext('2d');
    
//     if (!context) {
//       throw new Error("Could not create canvas context for PDF rendering.");
//     }
    
//     canvas.width = viewport.width;
//     canvas.height = viewport.height;
    
//     const renderContext: any = {
//       canvasContext: context,
//       viewport: viewport,
//     };
    
//     await page.render(renderContext).promise;
    
//     // Extract base64 image (remove the data:image/jpeg;base64, prefix for Gemini)
//     const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
//     const base64Data = dataUrl.split(',')[1];
    
//     images.push(base64Data);
//   }
  
//   return images;
// }




import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Converts a PDF File into an array of base64-encoded JPEG images (one per page).
 *
 * Scale 1.5 + JPEG quality 0.75 gives Gemini plenty of detail to read
 * handwriting while keeping each image ~100–250 KB — well within the
 * free-tier token budget per request.
 *
 * Scale 2.0 @ 0.85 quality (the old default) produced images 3–5× larger,
 * which consumed token quota ~4× faster and caused consistent 429 errors
 * on multi-page PDFs.
 */
export async function convertPdfToImages(
  file: File,
  onProgress?: (status: string) => void
): Promise<string[]> {
  onProgress?.('Initializing PDF parser...');

  const arrayBuffer = await file.arrayBuffer();

  onProgress?.('Loading PDF document...');
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDocument = await loadingTask.promise;

  const numPages = pdfDocument.numPages;
  const images: string[] = [];

  // 1.5 is sharp enough for handwriting OCR; keeps images small to save quota
  const scale = 1.5;
  // 0.75 quality is virtually indistinguishable for OCR but ~40% smaller than 0.85
  const jpegQuality = 0.75;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(`Extracting page ${pageNum} of ${numPages}...`);

    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not create canvas context for PDF rendering.');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // await page.render({ canvasContext: context, viewport }).promise;

    const renderContext: any = {
      canvasContext: context,
      viewport: viewport,
    };
    
    await page.render(renderContext).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
    images.push(dataUrl.split(',')[1]);

    // Release canvas memory immediately after use
    canvas.width = 0;
    canvas.height = 0;
  }

  return images;
}