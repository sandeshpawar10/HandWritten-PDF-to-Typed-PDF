import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { createDocxBuffer } from './docxExportService.js';
import { createPdfBuffer } from './pdfExportService.js';
import { verifyPdfBuffer } from './pdfVerifier.js';
import { transcribePage, maskKey } from './geminiPool.js';
import { parseBase64Payload, LIMITS } from '../utils/validation.js';
import { markdownToAst } from './ocrAst.js';
import { verifyPageAst } from './ocrVerifier.js';

const OCR_PROMPT_VERSION = 'v2.2_diagram_budget';

/**
 * Persistent content-addressed and atomic page cache.
 */
const CACHE_DIR = path.join(process.cwd(), '.ocr_cache');
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize .ocr_cache directory:', e.message);
}

const pageMemoryCache = new Map();

/**
 * Generate SHA-256 content-addressed cache key.
 */
export function computePageCacheKey(sourceBuffer, pageNum, promptVersion = OCR_PROMPT_VERSION) {
  return crypto.createHash('sha256')
    .update(sourceBuffer)
    .update(`_p${pageNum}_`)
    .update(promptVersion)
    .digest('hex');
}

/**
 * Read cached page from memory or disk.
 */
function getCachedPage(cacheKey) {
  if (pageMemoryCache.has(cacheKey)) {
    return pageMemoryCache.get(cacheKey);
  }
  try {
    const filePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data && data.text) {
        pageMemoryCache.set(cacheKey, data.text);
        return data.text;
      }
    }
  } catch {
    // fallback / cache miss
  }
  return null;
}

/**
 * Atomically save page to memory and disk (write to temp file then rename).
 */
function saveCachedPage(cacheKey, text, pageAst = null) {
  pageMemoryCache.set(cacheKey, text);
  try {
    const payload = JSON.stringify({
      cacheKey,
      savedAt: new Date().toISOString(),
      text,
      ast: pageAst
    });
    const tempFile = path.join(CACHE_DIR, `tmp_${cacheKey}_${Date.now()}.json`);
    const targetFile = path.join(CACHE_DIR, `${cacheKey}.json`);
    fs.writeFileSync(tempFile, payload, 'utf8');
    fs.renameSync(tempFile, targetFile);
  } catch (e) {
    console.warn(`Failed to persist cache for ${cacheKey}:`, e.message);
  }
}

/**
 * Clear all cached OCR files on disk and memory.
 */
export function clearOcrCache() {
  pageMemoryCache.clear();
  try {
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        if (file.endsWith('.json') || file.endsWith('.md')) {
          fs.unlinkSync(path.join(CACHE_DIR, file));
        }
      }
    }
    return { success: true, message: 'OCR cache cleared successfully.' };
  } catch (e) {
    console.error('Error clearing OCR cache:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Strict academic transcription prompt.
 */
const OCR_SYSTEM_PROMPT = `You are an expert academic transcriber specializing in handwritten university notes, mathematics, computer science algorithms, and technical diagrams.

Transcribe the provided document page into clean, publication-ready GitHub-flavored Markdown following these strict requirements:

1. VERBATIM & EXHAUSTIVE ACCURACY (ZERO OMISSIONS):
   - Transcribe every single word, heading, formula, note, remark, and example from top to bottom.
   - Do NOT summarize, abridge, condense, or truncate ("...").
   - Transcribe every problem, question, step, and answer without skipping lines.

2. MATHEMATICS & VERTICAL STEP-BY-STEP EQUATIONS:
   - Every single mathematical formula, derivation, and algebraic step must be formatted vertically, step-by-step on its own line.
   - NEVER place multiple derivation steps on a single horizontal line (e.g. NEVER write "a = 1, b = 2, c = 3" on one line).
   - Use KaTeX-compatible display math blocks with blank lines before and after:
     $$
     \\text{Step 1: } a_1 = 3
     $$

     $$
     \\text{Step 2: } a_2 = 5
     $$
   - For multi-line aligned systems or derivations, format with clear vertical steps or \\begin{aligned} ... \\end{aligned} inside $$ ... $$.
   - Use standard LaTeX symbols: \\times, \\cdot, \\frac{a}{b}, \\sum, \\int, \\in, \\subseteq, \\cup, \\cap, \\oplus, \\land, \\lor, \\neg.

3. DIAGRAMS, FLOWCHARTS & TREES (ASCII ART & METADATA):
   - When hand-drawn diagrams, trees, state machines, graphs, flowcharts, or Venn diagrams appear:
   - Reconstruct them accurately as clean ASCII diagrams inside fenced code blocks (\`\`\`text).
   - Show all nodes, vertices, edges, directions, weights, and labels.
   - Attach a metadata tag immediately preceding the diagram block:
     [DIAGRAM_METADATA: {"type": "graph|tree|automaton|venn|circuit|flowchart", "title": "Brief Title", "confidence": 0.9}]
   - NEVER omit a diagram or write "[Diagram omitted]". Reconstruct the diagram's exact logic.

4. TABLES & GRIDS:
   - Format all tabular data, truth tables, coefficient matrices, and DP tables into standard Markdown tables (| Col 1 | Col 2 |).

5. CODE & ALGORITHMS:
   - Wrap all pseudocode, functions, and code blocks in fenced code blocks with appropriate language tags (\`\`\`c, \`\`\`python, \`\`\`text). Preserve indentation and line breaks verbatim.

Return ONLY the clean Markdown transcription of this page without conversational preamble or conversational sign-off.`;

/**
 * Parse all configured API keys (supports named keys GEMINI_KEY_01... and comma-separated GEMINI_API_KEY).
 */
export function getApiKeys() {
  const keys = [];

  // Check named keys GEMINI_KEY_01 to GEMINI_KEY_20
  for (let i = 1; i <= 20; i++) {
    const keyName = `GEMINI_KEY_${String(i).padStart(2, '0')}`;
    const k = process.env[keyName]?.trim();
    if (k && k !== 'your_gemini_api_key_here' && !keys.includes(k)) {
      keys.push(k);
    }
  }

  // Check comma-separated GEMINI_API_KEY
  const raw = process.env.GEMINI_API_KEY || '';
  for (const part of raw.split(',')) {
    const k = part.trim();
    if (k && k !== 'your_gemini_api_key_here' && !keys.includes(k)) {
      keys.push(k);
    }
  }

  return keys;
}

/**
 * Main chunked OCR processing function with persistent resume support & parallel worker pool.
 * @param {Object} body - Request body containing document payload
 * @param {Function} onProgress - Progress callback function (current, total, percent, message)
 * @returns {Promise<Object>} - Formatted result with text, pdf, docx, page counts
 */
export async function runGeminiOCR(body, onProgress) {
  const apiKeys = getApiKeys();

  if (apiKeys.length === 0) {
    throw {
      status: 500,
      data: {
        error: 'API key is not configured. Please set GEMINI_API_KEY or GEMINI_KEY_01..06 in your server environment.',
        type: 'CONFIG_ERROR'
      }
    };
  }

  const maskedSummary = apiKeys.map(k => maskKey(k)).join(', ');
  console.log(`OCR Service active with ${apiKeys.length} API key(s) in rotation pool [${maskedSummary}].`);

  if (!body || typeof body !== 'object' || !body.document) {
    throw {
      status: 400,
      data: { error: 'Invalid request: document object is required.', type: 'INVALID_REQUEST' }
    };
  }

  const rawData = body.document.image_url || body.document.document_url;
  if (!rawData) {
    throw {
      status: 400,
      data: { error: 'Invalid request: image_url or document_url is required.', type: 'INVALID_REQUEST' }
    };
  }

  // Validate magic bytes, limits, and payload
  const { mimeType, buffer } = parseBase64Payload(rawData);
  const isPdf = mimeType === 'application/pdf';
  const pageMode = body.pageMode || body.page_mode || body.document?.pageMode || 'clean-reflow';

  if (isPdf) {
    console.log('Loading PDF document with pdf-lib...');
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } catch (pdfErr) {
      throw {
        status: 422,
        data: { error: `Failed to parse PDF document: ${pdfErr.message}`, type: 'INVALID_PDF' }
      };
    }

    const totalPages = pdfDoc.getPageCount();
    console.log(`PDF loaded successfully. Total pages: ${totalPages}`);

    if (totalPages === 0) {
      throw {
        status: 422,
        data: { error: 'The uploaded PDF has 0 pages.', type: 'EMPTY_PDF' }
      };
    }

    if (totalPages > LIMITS.MAX_PAGE_COUNT) {
      throw {
        status: 413,
        data: {
          error: `Document has ${totalPages} pages, exceeding the maximum limit of ${LIMITS.MAX_PAGE_COUNT} pages.`,
          type: 'EXCEEDED_PAGE_LIMIT'
        }
      };
    }

    // Decoupled concurrency: Use up to number of healthy keys (e.g. 6) or OCR_CONCURRENCY
    const concurrency = Math.min(
      apiKeys.length,
      parseInt(process.env.OCR_CONCURRENCY || String(apiKeys.length), 10)
    );

    // PRE-SCAN: Scan for any pages ALREADY completed on disk or in memory
    const results = new Array(totalPages);
    const pagesToProcess = [];
    let completedCount = 0;

    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      const cacheKey = computePageCacheKey(buffer, pageNum);
      const cached = getCachedPage(cacheKey);
      if (cached) {
        results[i] = cached;
        completedCount++;
      } else {
        pagesToProcess.push(i);
      }
    }

    const activePages = new Set();
    const emitProgress = (customMessage = null) => {
      const inFlight = activePages.size;
      // Weighted progress: completed pages count for 1.0, active pages in-flight count for 0.4
      const weighted = completedCount + (inFlight * 0.4);
      const computedPercent = Math.round((weighted / totalPages) * 100);
      const minPercent = (completedCount > 0 || inFlight > 0) ? 5 : 0;
      const percent = Math.min(95, Math.max(minPercent, computedPercent));
      const sortedActive = Array.from(activePages).sort((a, b) => a - b);

      let defaultMessage = `Transcribing ${inFlight} page${inFlight > 1 ? 's' : ''} in parallel (${sortedActive.slice(0, 6).map(p => `p.${p}`).join(', ')}${sortedActive.length > 6 ? '...' : ''}) • ${completedCount}/${totalPages} completed`;
      if (inFlight === 0 && completedCount === totalPages) {
        defaultMessage = `All ${totalPages} pages transcribed successfully.`;
      }

      onProgress?.({
        stage: 'transcribing',
        current: completedCount,
        total: totalPages,
        percent,
        inFlight,
        activePages: sortedActive,
        message: customMessage || defaultMessage
      });
    };

    if (completedCount > 0) {
      console.log(`⚡ Instant Resume: ${completedCount}/${totalPages} pages restored from cache.`);
      emitProgress(`Restored ${completedCount} of ${totalPages} pages from cache. Resuming remaining ${pagesToProcess.length} page(s)...`);
    } else {
      onProgress?.({
        stage: 'rendering',
        current: 0,
        total: totalPages,
        percent: 0,
        inFlight: 0,
        activePages: [],
        message: `Starting parallel processing (${concurrency} page workers active across ${apiKeys.length} keys)...`
      });
    }

    // Process remaining pages in parallel worker pool
    if (pagesToProcess.length > 0) {
      console.log(`Processing ${pagesToProcess.length} pages with concurrency=${concurrency} across ${apiKeys.length} API keys...`);

      let queueIndex = 0;

      async function worker(workerId) {
        while (queueIndex < pagesToProcess.length) {
          const i = pagesToProcess[queueIndex++];
          const pageNum = i + 1;
          const cacheKey = computePageCacheKey(buffer, pageNum);

          console.log(`[Worker ${workerId}] Processing page ${pageNum}/${totalPages}...`);

          activePages.add(pageNum);
          emitProgress();

          // Extract single page in-memory
          const singlePageDoc = await PDFDocument.create();
          const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
          singlePageDoc.addPage(copiedPage);
          const singlePageBytes = await singlePageDoc.save();
          const singlePageBase64 = Buffer.from(singlePageBytes).toString('base64');

          try {
            const { text: pageText, model: usedModel } = await transcribePage({
              apiKeys,
              mimeType: 'application/pdf',
              base64Data: singlePageBase64,
              prompt: OCR_SYSTEM_PROMPT,
              pageNum,
              onStatus: (msg) => {
                const otherActive = Array.from(activePages).filter(p => p !== pageNum).sort((a, b) => a - b);
                const activeContext = otherActive.length > 0
                  ? `${msg} (${otherActive.length} other page${otherActive.length > 1 ? 's' : ''} active)`
                  : msg;
                emitProgress(activeContext);
              }
            });

            // Convert to structured AST and verify
            const pageAst = markdownToAst(pageText, pageNum, { model: usedModel });
            verifyPageAst(pageAst);

            const formattedPage = `--- Page ${pageNum} ---\n\n${pageText}`;
            results[i] = formattedPage;
            saveCachedPage(cacheKey, formattedPage, pageAst);
            
            activePages.delete(pageNum);
            completedCount++;
            emitProgress(`Page ${pageNum} completed (${completedCount}/${totalPages} finished).`);
          } catch (pageErr) {
            activePages.delete(pageNum);
            emitProgress();
            console.error(`[Worker ${workerId}] Error on page ${pageNum}:`, pageErr.message);
            throw {
              status: 500,
              data: {
                error: `Failed to transcribe page ${pageNum}: ${pageErr.message}`,
                type: pageErr.code || 'PAGE_ERROR'
              }
            };
          }
        }
      }

      const workerPromises = [];
      for (let w = 0; w < Math.min(concurrency, pagesToProcess.length); w++) {
        workerPromises.push(worker(w + 1));
      }

      await Promise.all(workerPromises);
    }

    onProgress?.({
      stage: 'formatting',
      current: totalPages,
      total: totalPages,
      percent: 95,
      message: 'Generating formatted PDF and Word documents...'
    });

    const fullMarkdown = results.join('\n\n');

    // Generate formatted Word document (DOCX)
    let formattedDocx = null;
    try {
      const docxBuffer = await createDocxBuffer('Transcribed Notes', fullMarkdown);
      formattedDocx = docxBuffer.toString('base64');
    } catch (docxErr) {
      console.warn('Docx generation warning:', docxErr.message);
    }

    // Generate formatted PDF document
    let formattedPdf = null;
    let pdfVerification = null;
    try {
      const pdfBuffer = await createPdfBuffer('Transcribed Notes', fullMarkdown, {
        pageMode,
        sourcePageCount: totalPages
      });
      formattedPdf = pdfBuffer.toString('base64');

      try {
        pdfVerification = await verifyPdfBuffer(pdfBuffer, {
          sourcePageCount: totalPages,
          pageMode
        });
        if (!pdfVerification.isValid) {
          console.warn('PDF verification warnings:', pdfVerification.warnings);
        }
      } catch (vErr) {
        console.warn('PDF verification run warning:', vErr.message);
      }
    } catch (pdfErr) {
      console.warn('PDF generation warning:', pdfErr.message);
    }

    onProgress?.({
      stage: 'complete',
      current: totalPages,
      total: totalPages,
      percent: 100,
      message: 'Processing complete!'
    });

    return {
      text: fullMarkdown,
      formatted_pdf: formattedPdf,
      formattedPdf,
      pdfSource: formattedPdf ? 'server-pdf' : 'unavailable',
      renderer: formattedPdf ? 'pdf-lib' : null,
      pageMode,
      pageCount: pdfVerification?.pageCount || totalPages,
      sourcePageCount: totalPages,
      expansionRatio: pdfVerification?.expansionRatio || null,
      formatted_docx: formattedDocx,
      formattedDocx,
      total_pages: totalPages,
      totalPages,
      pages_processed: totalPages,
      pagesProcessed: totalPages,
      pdf_verification: pdfVerification,
      pdfVerification
    };

  } else {
    // Single image processing
    console.log(`Processing single image (${mimeType})...`);
    const imageCacheKey = computePageCacheKey(buffer, 1);
    const cachedImage = getCachedPage(imageCacheKey);

    if (cachedImage) {
      console.log('Serving single image from cache.');
      let formattedDocx = null;
      let formattedPdf = null;
      let pdfVerification = null;
      try {
        const docxBuffer = await createDocxBuffer('Transcribed Note', cachedImage);
        formattedDocx = docxBuffer.toString('base64');
      } catch (e) {
        console.warn('DOCX warning:', e.message);
      }
      try {
        const pdfBuffer = await createPdfBuffer('Transcribed Note', cachedImage, {
          pageMode,
          sourcePageCount: 1
        });
        formattedPdf = pdfBuffer.toString('base64');
        pdfVerification = await verifyPdfBuffer(pdfBuffer, {
          sourcePageCount: 1,
          pageMode
        });
      } catch (e) {
        console.warn('PDF warning:', e.message);
      }

      return {
        text: cachedImage,
        formatted_pdf: formattedPdf,
        formattedPdf,
        pdfSource: formattedPdf ? 'server-pdf' : 'unavailable',
        renderer: formattedPdf ? 'pdf-lib' : null,
        pageMode,
        pageCount: 1,
        sourcePageCount: 1,
        expansionRatio: 1.0,
        formatted_docx: formattedDocx,
        formattedDocx,
        total_pages: 1,
        totalPages: 1,
        pages_processed: 1,
        pagesProcessed: 1,
        pdf_verification: pdfVerification,
        pdfVerification
      };
    }

    onProgress?.({
      stage: 'transcribing',
      current: 0,
      total: 1,
      percent: 30,
      message: 'Transcribing image with Gemini...'
    });

    const { text: pageText, model: usedModel } = await transcribePage({
      apiKeys,
      mimeType,
      base64Data: buffer.toString('base64'),
      prompt: OCR_SYSTEM_PROMPT,
      pageNum: 1,
      onStatus: (msg) => {
        onProgress?.({
          stage: 'transcribing',
          current: 0,
          total: 1,
          percent: 50,
          message: msg
        });
      }
    });

    const pageAst = markdownToAst(pageText, 1, { model: usedModel });
    verifyPageAst(pageAst);
    saveCachedPage(imageCacheKey, pageText, pageAst);

    onProgress?.({
      stage: 'formatting',
      current: 1,
      total: 1,
      percent: 85,
      message: 'Formatting PDF and Word document...'
    });

    let formattedDocx = null;
    let formattedPdf = null;
    let pdfVerification = null;
    try {
      const docxBuffer = await createDocxBuffer('Transcribed Note', pageText);
      formattedDocx = docxBuffer.toString('base64');
    } catch (e) {
      console.warn('DOCX warning:', e.message);
    }
    try {
      const pdfBuffer = await createPdfBuffer('Transcribed Note', pageText, {
        pageMode,
        sourcePageCount: 1
      });
      formattedPdf = pdfBuffer.toString('base64');
      pdfVerification = await verifyPdfBuffer(pdfBuffer, {
        sourcePageCount: 1,
        pageMode
      });
    } catch (e) {
      console.warn('PDF warning:', e.message);
    }

    onProgress?.({
      stage: 'complete',
      current: 1,
      total: 1,
      percent: 100,
      message: 'Processing complete!'
    });

    return {
      text: pageText,
      formatted_pdf: formattedPdf,
      formattedPdf,
      pdfSource: formattedPdf ? 'server-pdf' : 'unavailable',
      renderer: formattedPdf ? 'pdf-lib' : null,
      pageMode,
      pageCount: 1,
      sourcePageCount: 1,
      expansionRatio: 1.0,
      formatted_docx: formattedDocx,
      formattedDocx,
      total_pages: 1,
      totalPages: 1,
      pages_processed: 1,
      pagesProcessed: 1,
      pdf_verification: pdfVerification,
      pdfVerification
    };
  }
}
