import { PDFDocument } from 'pdf-lib';
import { createDocxBuffer } from './docxExportService.js';

function getModelChain() {
  const envModel = process.env.GEMINI_MODEL;
  const models = [];
  if (envModel && !envModel.includes('2.0-flash')) {
    models.push(envModel);
  }
  // Standard high-performance Flash fallback chain
  models.push('gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-1.5-flash');
  return [...new Set(models)];
}

const MODEL_CHAIN = getModelChain();
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * In-memory page cache to store completed page transcriptions.
 * If a job is retried or interrupted, already completed pages are served instantly.
 */
const pageMemoryCache = new Map();

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
 * Track cooldowns and round-robin index across multiple API keys
 */
const keyCooldowns = new Map(); // apiKey -> timestamp (ms)
let currentKeyIndex = 0;

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
 * Extract retry delay in seconds from Google's response headers or error message
 */
function parseRetryDelay(response, errJson) {
  const retryHeader = response.headers.get('retry-after');
  if (retryHeader) {
    const sec = parseInt(retryHeader, 10);
    if (!isNaN(sec) && sec > 0) return sec + 2;
  }

  const msg = errJson?.error?.message || '';
  const match = msg.match(/retry in ([\d.]+)s/i);
  if (match) {
    const sec = parseFloat(match[1]);
    if (!isNaN(sec) && sec > 0) return Math.ceil(sec) + 2;
  }

  return 30;
}

/**
 * Call Gemini Flash API using multi-key round-robin pool with smart failover,
 * automatic recovery from 503 High Demand spikes, and model fallback.
 * @param {string} mimeType - MIME type of the part
 * @param {string} base64Data - Base64 encoded file data
 * @param {string[]} apiKeys - Array of Gemini API keys
 * @param {number} pageNum - Current page number
 * @param {number} totalPages - Total page count
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<string>} - Transcribed markdown
 */
async function callGeminiFlashWithPool(mimeType, base64Data, apiKeys, pageNum, totalPages, onProgress) {
  const maxAttempts = Math.max(apiKeys.length * 4, 10);
  let attempts = 0;
  let modelIndex = 0;

  while (attempts < maxAttempts) {
    attempts++;
    const now = Date.now();

    // 1. Select the next available key that is not in cooldown
    let selectedKey = null;
    let selectedKeyNumber = 1;

    for (let i = 0; i < apiKeys.length; i++) {
      const idx = (currentKeyIndex + i) % apiKeys.length;
      const candidateKey = apiKeys[idx];
      const cooldownUntil = keyCooldowns.get(candidateKey) || 0;
      if (now >= cooldownUntil) {
        selectedKey = candidateKey;
        selectedKeyNumber = idx + 1;
        currentKeyIndex = (idx + 1) % apiKeys.length;
        break;
      }
    }

    // 2. If all keys are currently cooling down, wait for the one that resets soonest
    if (!selectedKey) {
      let soonestWaitMs = Infinity;
      let soonestKey = apiKeys[0];

      for (const k of apiKeys) {
        const cooldownUntil = keyCooldowns.get(k) || 0;
        const waitMs = Math.max(0, cooldownUntil - now);
        if (waitMs < soonestWaitMs) {
          soonestWaitMs = waitMs;
          soonestKey = k;
        }
      }

      const waitSec = Math.max(1, Math.ceil(soonestWaitMs / 1000));
      console.log(`All ${apiKeys.length} Gemini API key(s) in cooldown. Waiting ${waitSec}s for quota window to reset...`);

      for (let sec = waitSec; sec > 0; sec--) {
        onProgress?.({
          current: Math.max(0, pageNum - 1),
          total: totalPages,
          percent: Math.round(((pageNum - 1) / totalPages) * 100),
          message: `⏳ Free-tier rate limit reached. Resuming page ${pageNum} of ${totalPages} in ${sec}s...`
        });
        await new Promise(r => setTimeout(r, 1000));
      }

      selectedKey = soonestKey;
      keyCooldowns.delete(soonestKey);
    }

    // 3. Make the API request with the selected key and active model
    const currentModel = MODEL_CHAIN[modelIndex % MODEL_CHAIN.length];
    const url = `${GEMINI_API_URL}/${currentModel}:generateContent?key=${selectedKey}`;
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            },
            {
              text: OCR_SYSTEM_PROMPT
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192
      }
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
    } catch (fetchErr) {
      console.warn(`Network glitch with key #${selectedKeyNumber} on page ${pageNum}:`, fetchErr.message);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    if (!response.ok) {
      let errJson = null;
      let errorDetail = `HTTP ${response.status} ${response.statusText}`;
      try {
        errJson = await response.json();
        errorDetail = errJson.error?.message || errorDetail;
      } catch {
        // ignore parse error
      }

      // Handle HTTP 429 Rate Limit with Smart Key Failover
      if (response.status === 429) {
        const cooldownSec = parseRetryDelay(response, errJson);
        keyCooldowns.set(selectedKey, Date.now() + cooldownSec * 1000);
        console.warn(`⚠️ Key #${selectedKeyNumber} hit rate limit (429). Cooldown: ${cooldownSec}s.`);

        if (apiKeys.length > 1) {
          console.log(`Rotating to next available API key for page ${pageNum}...`);
          onProgress?.({
            current: Math.max(0, pageNum - 1),
            total: totalPages,
            percent: Math.round(((pageNum - 1) / totalPages) * 100),
            message: `Key #${selectedKeyNumber} quota reached. Rotating to next API key for page ${pageNum}...`
          });
          continue;
        } else {
          for (let sec = cooldownSec; sec > 0; sec--) {
            onProgress?.({
              current: Math.max(0, pageNum - 1),
              total: totalPages,
              percent: Math.round(((pageNum - 1) / totalPages) * 100),
              message: `⏳ Rate limit reached. Resuming page ${pageNum} of ${totalPages} in ${sec}s...`
            });
            await new Promise(r => setTimeout(r, 1000));
          }
          keyCooldowns.delete(selectedKey);
          continue;
        }
      }

      // Handle HTTP 503 (High Demand), 500, 502, 504 - Transient Server Spikes from Google
      const isTransientServerError = [500, 502, 503, 504].includes(response.status) ||
        errorDetail.toLowerCase().includes('high demand') ||
        errorDetail.toLowerCase().includes('temporarily unavailable') ||
        errorDetail.toLowerCase().includes('try again later');

      if (isTransientServerError) {
        const isHighDemand = response.status === 503 || errorDetail.toLowerCase().includes('high demand');
        console.warn(`⚠️ Gemini ${isHighDemand ? 'high demand spike (503)' : `server error (${response.status})`} on page ${pageNum} [attempt ${attempts}/${maxAttempts}]: ${errorDetail}`);

        // If the current model is persistently congested after 2 attempts, fall back to next model
        if (isHighDemand && attempts >= 2 && MODEL_CHAIN.length > 1) {
          modelIndex = (modelIndex + 1) % MODEL_CHAIN.length;
          console.log(`Switching to alternate Flash model (${MODEL_CHAIN[modelIndex]}) for page ${pageNum}...`);
        }

        const backoffSec = Math.min(2 * attempts + 1, 12);
        for (let sec = backoffSec; sec > 0; sec--) {
          onProgress?.({
            current: Math.max(0, pageNum - 1),
            total: totalPages,
            percent: Math.round(((pageNum - 1) / totalPages) * 100),
            message: `⏳ Google servers busy on Page ${pageNum} (${isHighDemand ? 'high demand spike' : 'temporary error'}). Retrying in ${sec}s...`
          });
          await new Promise(r => setTimeout(r, 1000));
        }

        // Rotate to another key and retry seamlessly
        continue;
      }

      if (response.status === 400) {
        throw new Error(`Gemini API request error: ${errorDetail}`);
      } else if (response.status === 403) {
        throw new Error(`Gemini API authentication failed for key #${selectedKeyNumber}: ${errorDetail}`);
      }

      throw new Error(`Gemini API Error: ${errorDetail}`);
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];
    const text = candidate?.content?.parts?.map(p => p.text).join('') || '';

    if (!text) {
      throw new Error('Gemini Flash returned an empty response for this page.');
    }

    // Success! Clear cooldown for this key
    keyCooldowns.delete(selectedKey);
    return cleanMarkdownOutput(text);
  }

  throw new Error(`Failed to transcribe page ${pageNum} after multiple retries across all available API keys.`);
}

/**
 * Clean up raw Gemini output (remove unnecessary markdown fences wrapping the entire output)
 */
function cleanMarkdownOutput(raw) {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```markdown') && cleaned.endsWith('```')) {
    cleaned = cleaned.slice(11, -3).trim();
  } else if (cleaned.startsWith('```md') && cleaned.endsWith('```')) {
    cleaned = cleaned.slice(5, -3).trim();
  }
  return cleaned;
}

/**
 * Main chunked Gemini OCR processing function with parallel multi-key worker pool
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
        error: 'Google Gemini API key is not configured. Please set GEMINI_API_KEY in your .env file or server environment.',
        type: 'CONFIG_ERROR'
      }
    };
  }

  console.log(`Gemini OCR Service active with ${apiKeys.length} API key(s) in rotation pool.`);

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

    // Determine concurrency based on available API keys (default: 3 concurrent workers)
    const concurrency = Math.min(
      Math.max(1, apiKeys.length),
      parseInt(process.env.OCR_CONCURRENCY || '3', 10)
    );

    console.log(`Processing ${totalPages} pages with concurrency = ${concurrency} across ${apiKeys.length} API keys...`);

    onProgress?.({
      current: 0,
      total: totalPages,
      percent: 0,
      message: `Starting parallel Gemini Flash OCR (${concurrency} workers active)...`
    });

    const results = new Array(totalPages);
    let completedCount = 0;
    let nextIndex = 0;

    // Cache namespace based on document buffer signature
    const docSignature = `${buffer.length}_${buffer.subarray(0, 64).toString('hex')}`;

    async function worker(workerId) {
      while (nextIndex < totalPages) {
        const i = nextIndex++;
        const pageNum = i + 1;
        const cacheKey = `${docSignature}_page_${pageNum}`;

        // Check if page is already cached in memory
        if (pageMemoryCache.has(cacheKey)) {
          console.log(`[Worker ${workerId}] Serving page ${pageNum}/${totalPages} from in-memory cache.`);
          results[i] = pageMemoryCache.get(cacheKey);
          completedCount++;
          onProgress?.({
            current: completedCount,
            total: totalPages,
            percent: Math.round((completedCount / totalPages) * 100),
            message: `Page ${pageNum} retrieved from cache (${completedCount}/${totalPages} complete).`
          });
          continue;
        }

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
          message: `Transcribing page ${pageNum} of ${totalPages} (${concurrency} pages running in parallel)...`
        });

        try {
          const pageText = await callGeminiFlashWithPool(
            'application/pdf',
            singlePageBase64,
            apiKeys,
            pageNum,
            totalPages,
            onProgress
          );

          const formattedPage = `--- Page ${pageNum} ---\n\n${pageText}`;
          results[i] = formattedPage;
          pageMemoryCache.set(cacheKey, formattedPage);
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
              type: 'GEMINI_PAGE_ERROR'
            }
          };
        }
      }
    }

    // Launch worker pool
    const workerPromises = [];
    for (let w = 0; w < concurrency; w++) {
      workerPromises.push(worker(w + 1));
    }

    await Promise.all(workerPromises);

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

    onProgress?.({
      current: 0,
      total: 1,
      percent: 25,
      message: 'Transcribing image with Gemini Flash...'
    });

    const pageText = await callGeminiFlashWithPool(mimeType, rawData, apiKeys, 1, 1, onProgress);

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
