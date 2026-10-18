import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { createDocxBuffer } from './docxExportService.js';
import { transcribePage, OcrError } from './geminiPool.js';

/**
 * Persistent on-disk and in-memory page cache.
 * Survives process restarts, container redeployments, and network interruptions.
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

function getCachedPage(cacheKey) {
  if (pageMemoryCache.has(cacheKey)) {
    return pageMemoryCache.get(cacheKey);
  }
  try {
    const filePath = path.join(CACHE_DIR, `${cacheKey}.md`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content && content.trim().length > 0) {
        pageMemoryCache.set(cacheKey, content);
        return content;
      }
    }
  } catch (e) {
    // ignore read error
  }
  return null;
}

function saveCachedPage(cacheKey, content) {
  pageMemoryCache.set(cacheKey, content);
  try {
    const filePath = path.join(CACHE_DIR, `${cacheKey}.md`);
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (e) {
    console.warn(`Failed to persist cache for ${cacheKey}:`, e.message);
  }
}

/**
 * Strict academic prompt engineered for verbatim transcription,
 * vertical step-by-step LaTeX math, and structured ASCII diagrams.
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

3. DIAGRAMS, FLOWCHARTS & TREES (ASCII ART):
   - When hand-drawn diagrams, trees, state machines, graphs, flowcharts, or Venn diagrams appear:
   - Reconstruct them accurately as clean ASCII diagrams inside fenced code blocks (\`\`\`text).
   - Show all nodes, vertices, edges, directions, weights, and labels.
   - NEVER omit a diagram or write "[Diagram omitted]". Reconstruct the diagram's exact logic.

4. TABLES & GRIDS:
   - Format all tabular data, truth tables, coefficient matrices, and DP tables into standard Markdown tables (| Col 1 | Col 2 |).

5. CODE & ALGORITHMS:
   - Wrap all pseudocode, functions, and code blocks in fenced code blocks with appropriate language tags (\`\`\`c, \`\`\`python, \`\`\`text). Preserve indentation and line breaks verbatim.

Return ONLY the clean Markdown transcription of this page without conversational preamble or conversational sign-off.`;

/**
 * Parse all configured API keys (supports single key or comma-separated list of keys)
 */
function getApiKeys() {
  const raw = process.env.GEMINI_API_KEY || '';
  return raw
    .split(',')
    .map(k => k.trim())
    .filter(k => k && k !== 'your_gemini_api_key_here');
}

/**
 * Main chunked OCR processing function with persistent resume support & parallel worker pool
 * @param {Object} body - Request body containing document payload
 * @param {Function} onProgress - Progress callback function (current, total, percent, message)
 * @returns {Promise<Object>} - Formatted result with text, docx, page counts
 */
export async function runGeminiOCR(body, onProgress) {
  const apiKeys = getApiKeys();

  if (apiKeys.length === 0) {
    throw {
      status: 500,
      data: {
        error: 'API key is not configured. Please set GEMINI_API_KEY in your .env file or server environment.',
        type: 'CONFIG_ERROR'
      }
    };
  }

  console.log(`OCR Service active with ${apiKeys.length} API key(s) in rotation pool.`);

  if (!body || typeof body !== 'object' || !body.document) {
    throw {
      status: 400,
      data: { error: 'Invalid request: document is required', type: 'INVALID_REQUEST' }
    };
  }

  let rawData = body.document.image_url || body.document.document_url;
  if (!rawData) {
    throw {
      status: 400,
      data: { error: 'Invalid request: image_url or document_url is required', type: 'INVALID_REQUEST' }
    };
  }

  let mimeType = 'image/jpeg';
  if (rawData.startsWith('data:')) {
    const match = rawData.match(/^data:([^;]+);base64,/);
    if (match) {
      mimeType = match[1];
      rawData = rawData.split('base64,')[1];
    }
  }

  const buffer = Buffer.from(rawData, 'base64');
  const isPdf = mimeType === 'application/pdf' || buffer.subarray(0, 4).toString() === '%PDF';

  if (isPdf) {
    console.log('Loading PDF document with pdf-lib...');
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } catch (pdfErr) {
      throw {
        status: 400,
        data: { error: `Failed to parse PDF document: ${pdfErr.message}`, type: 'INVALID_PDF' }
      };
    }

    const totalPages = pdfDoc.getPageCount();
    console.log(`PDF loaded successfully. Total pages: ${totalPages}`);

    if (totalPages === 0) {
      throw {
        status: 400,
        data: { error: 'The uploaded PDF has 0 pages.', type: 'EMPTY_PDF' }
      };
    }

    // Determine concurrency based on available API keys (default: 2 workers when >=4 keys, else 1)
    const defaultConcurrency = apiKeys.length >= 4 ? 2 : 1;
    const concurrency = Math.min(
      Math.max(1, apiKeys.length),
      parseInt(process.env.OCR_CONCURRENCY || String(defaultConcurrency), 10)
    );

    // Document unique signature for disk and memory caching
    const docSignature = `${buffer.length}_${buffer.subarray(0, 64).toString('hex')}`;

    // PRE-SCAN: Scan for any pages ALREADY completed on disk or in memory
    const results = new Array(totalPages);
    const pagesToProcess = [];
    let completedCount = 0;

    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      const cacheKey = `${docSignature}_page_${pageNum}`;
      const cached = getCachedPage(cacheKey);
      if (cached) {
        results[i] = cached;
        completedCount++;
      } else {
        pagesToProcess.push(i);
      }
    }

    if (completedCount > 0) {
      console.log(`⚡ Instant Resume: ${completedCount}/${totalPages} pages restored from cache.`);
      onProgress?.({
        current: completedCount,
        total: totalPages,
        percent: Math.round((completedCount / totalPages) * 100),
        message: `Restored ${completedCount} of ${totalPages} pages from cache. Resuming remaining ${pagesToProcess.length} page(s)...`
      });
    } else {
      onProgress?.({
        current: 0,
        total: totalPages,
        percent: 0,
        message: `Starting parallel processing (${concurrency} workers active)...`
      });
    }

    // If all pages were already cached, skip straight to assembly
    if (pagesToProcess.length > 0) {
      console.log(`Processing remaining ${pagesToProcess.length} pages with concurrency = ${concurrency} across ${apiKeys.length} API keys...`);

      let queueIndex = 0;

      async function worker(workerId) {
        while (queueIndex < pagesToProcess.length) {
          const i = pagesToProcess[queueIndex++];
          const pageNum = i + 1;
          const cacheKey = `${docSignature}_page_${pageNum}`;

          console.log(`[Worker ${workerId}] Processing page ${pageNum}/${totalPages}...`);

          // Extract single-page PDF in-memory (100% individual page attention)
          const singlePageDoc = await PDFDocument.create();
          const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
          singlePageDoc.addPage(copiedPage);
          const singlePageBytes = await singlePageDoc.save();
          const singlePageBase64 = Buffer.from(singlePageBytes).toString('base64');

          onProgress?.({
            current: completedCount,
            total: totalPages,
            percent: Math.round((completedCount / totalPages) * 100),
            message: `Transcribing page ${pageNum} of ${totalPages}...`
          });

          try {
            const { text: pageText } = await transcribePage({
              apiKeys,
              mimeType: 'application/pdf',
              base64Data: singlePageBase64,
              prompt: OCR_SYSTEM_PROMPT,
              pageNum,
              onStatus: (msg) => {
                onProgress?.({
                  current: completedCount,
                  total: totalPages,
                  percent: Math.round((completedCount / totalPages) * 100),
                  message: msg
                });
              }
            });

            const formattedPage = `--- Page ${pageNum} ---\n\n${pageText}`;
            results[i] = formattedPage;
            // Persist to both memory AND disk so failure never forces restart
            saveCachedPage(cacheKey, formattedPage);
            completedCount++;

            onProgress?.({
              current: completedCount,
              total: totalPages,
              percent: Math.round((completedCount / totalPages) * 100),
              message: `Page ${pageNum} completed (${completedCount}/${totalPages} finished).`
            });
          } catch (pageErr) {
            console.error(`[Worker ${workerId}] Error transcribing page ${pageNum}:`, pageErr.message);
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

      // Launch worker pool
      const workerPromises = [];
      for (let w = 0; w < Math.min(concurrency, pagesToProcess.length); w++) {
        workerPromises.push(worker(w + 1));
      }

      await Promise.all(workerPromises);
    }

    onProgress?.({
      current: totalPages,
      total: totalPages,
      percent: 100,
      message: 'Assembling document & generating formatted Word document...'
    });

    const fullMarkdown = results.join('\n\n');

    // Generate formatted Word document (DOCX)
    let formattedDocx = null;
    try {
      const docxBuffer = await createDocxBuffer('Transcribed Notes', fullMarkdown);
      formattedDocx = docxBuffer.toString('base64');
    } catch (docxErr) {
      console.warn('Docx generation warning (non-fatal):', docxErr.message);
    }

    return {
      text: fullMarkdown,
      formatted_pdf: null,
      formatted_docx: formattedDocx,
      total_pages: totalPages,
      pages_processed: totalPages
    };

  } else {
    // Single image processing
    console.log(`Processing single image (${mimeType})...`);

    const imageSignature = `img_${buffer.length}_${buffer.subarray(0, 64).toString('hex')}`;
    const cachedImage = getCachedPage(imageSignature);
    if (cachedImage) {
      console.log('Serving single image from cache.');
      let formattedDocx = null;
      try {
        const docxBuffer = await createDocxBuffer('Transcribed Note', cachedImage);
        formattedDocx = docxBuffer.toString('base64');
      } catch (docxErr) {
        console.warn('Docx generation warning:', docxErr.message);
      }
      return {
        text: cachedImage,
        formatted_pdf: null,
        formatted_docx: formattedDocx,
        total_pages: 1,
        pages_processed: 1
      };
    }

    onProgress?.({
      current: 0,
      total: 1,
      percent: 25,
      message: 'Transcribing image...'
    });

    const { text: pageText } = await transcribePage({
      apiKeys,
      mimeType,
      base64Data: rawData,
      prompt: OCR_SYSTEM_PROMPT,
      pageNum: 1,
      onStatus: (msg) => {
        onProgress?.({
          current: 0,
          total: 1,
          percent: 50,
          message: msg
        });
      }
    });
    saveCachedPage(imageSignature, pageText);

    onProgress?.({
      current: 1,
      total: 1,
      percent: 85,
      message: 'Formatting document...'
    });

    let formattedDocx = null;
    try {
      const docxBuffer = await createDocxBuffer('Transcribed Note', pageText);
      formattedDocx = docxBuffer.toString('base64');
    } catch (docxErr) {
      console.warn('Docx generation warning (non-fatal):', docxErr.message);
    }

    onProgress?.({
      current: 1,
      total: 1,
      percent: 100,
      message: 'Processing complete!'
    });

    return {
      text: pageText,
      formatted_pdf: null,
      formatted_docx: formattedDocx,
      total_pages: 1,
      pages_processed: 1
    };
  }
}
