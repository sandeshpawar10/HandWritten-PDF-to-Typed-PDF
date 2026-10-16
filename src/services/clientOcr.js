/**
 * Client-Side OCR Fallback Service
 * Uses Tesseract.js (WASM) + PDF.js to run OCR entirely in the browser.
 * This is used as a fallback when the server (Render) is unavailable,
 * crashes due to OOM, or times out.
 */

let pdfjsLib = null;
let Tesseract = null;

/**
 * Lazy-load PDF.js and Tesseract.js from CDN
 * Avoids bundling ~5MB of WASM in the main bundle
 */
async function loadDependencies(onProgress) {
  if (pdfjsLib && Tesseract) return;

  onProgress?.({
    current: 0,
    total: 0,
    percent: 0,
    message: "Loading client-side OCR engine..."
  });

  // Dynamically import from CDN via script tags
  if (!pdfjsLib) {
    pdfjsLib = await import(
      /* @vite-ignore */
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.min.mjs'
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs';
  }

  if (!Tesseract) {
    Tesseract = await import(
      /* @vite-ignore */
      'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js'
    );
  }
}

/**
 * Render a PDF page to an image on an offscreen canvas
 * @param {Object} page - PDF.js page object
 * @param {number} scale - Rendering scale (2.0 = ~144 DPI for 72 DPI PDFs)
 * @returns {HTMLCanvasElement}
 */
async function renderPageToCanvas(page, scale = 2.0) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;

  return canvas;
}

/**
 * Process a single PDF file using client-side OCR
 * @param {File} file - PDF or image file
 * @param {Function} onProgress - Progress callback
 * @returns {Object} { text, totalPages, pagesProcessed }
 */
export async function clientSideOcr(file, onProgress) {
  await loadDependencies(onProgress);

  const isPdf = file.type === 'application/pdf';
  let allText = '';
  let totalPages = 1;

  if (isPdf) {
    // Load PDF with PDF.js
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPages = pdfDoc.numPages;

    onProgress?.({
      current: 0,
      total: totalPages,
      percent: 0,
      message: `Starting client-side OCR for ${totalPages} pages...`
    });

    // Create a single Tesseract worker (reused across pages)
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: () => {} // Suppress verbose logging
    });

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      onProgress?.({
        current: pageNum,
        total: totalPages,
        percent: Math.round(((pageNum - 1) / totalPages) * 100),
        message: `Processing page ${pageNum} of ${totalPages} (client-side)...`
      });

      try {
        const page = await pdfDoc.getPage(pageNum);
        const canvas = renderPageToCanvas(page, 2.0);

        const { data } = await worker.recognize(await canvas);

        if (pageNum > 1) allText += '\n\n---\n\n';
        allText += data.text || '';

        // Help GC
        (await canvas).width = 0;
        (await canvas).height = 0;
      } catch (err) {
        console.warn(`Client OCR: Page ${pageNum} failed:`, err);
        if (pageNum > 1) allText += '\n\n---\n\n';
        allText += `[Page ${pageNum} could not be processed: ${err.message}]`;
      }
    }

    await worker.terminate();
  } else {
    // Single image
    onProgress?.({
      current: 0,
      total: 1,
      percent: 0,
      message: "Processing image (client-side)..."
    });

    const worker = await Tesseract.createWorker('eng', 1, {
      logger: () => {}
    });

    const { data } = await worker.recognize(file);
    allText = data.text || '';
    await worker.terminate();
  }

  onProgress?.({
    current: totalPages,
    total: totalPages,
    percent: 100,
    message: "Client-side processing complete!"
  });

  return {
    text: allText,
    totalPages,
    pagesProcessed: totalPages,
    // Client-side doesn't generate formatted PDF/DOCX
    formattedPdf: null,
    formattedDocx: null,
    clientSide: true
  };
}
