import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { createDocxBuffer } from './docxExportService.js';

// Active Gemini models in priority fallback order
// If the primary model exhausts quota, the system falls back to the next model in the chain
const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite'
].filter((m, i, arr) => arr.indexOf(m) === i);

let currentModelIndex = 0;

function getActiveModel() {
  return CANDIDATE_MODELS[currentModelIndex % CANDIDATE_MODELS.length];
}

function switchToNextModel() {
  if (currentModelIndex < CANDIDATE_MODELS.length - 1) {
    currentModelIndex++;
    console.log(`[Model Fallback] Switching active model to: ${getActiveModel()}`);
    // Clear cooldowns because Google's quota is enforced independently per model
    keyCooldowns.clear();
    return true;
  }
  return false;
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

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
 * Rate limit parameters for Gemini Free Tier:
 * 15 requests per minute per key = 1 request every 4,000 ms.
 * We set MIN_KEY_INTERVAL_MS = 4,200 ms to provide a 5% buffer,
 * guaranteeing zero 429 quota exhaustion errors during normal operation.
 */
const MIN_KEY_INTERVAL_MS = 4200;

const keyCooldowns = new Map(); // apiKey -> timestamp (ms) until which key is in 429/503 cooldown
const keyLastUsedTime = new Map(); // apiKey -> timestamp (ms) when last request was initiated
const inFlightKeys = new Set(); // apiKey -> actively executing an HTTP request
let keyRoundRobinIndex = 0;

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
 * Fair token bucket & concurrency coordinator across the pool of Gemini API keys.
 * Enforces:
 * 1. Mutual exclusion: A key cannot be used by two workers simultaneously.
 * 2. Rate pacing: Enforces a minimum interval of 4200ms per key (< 15 RPM).
 * 3. Cooldown compliance: Skips keys cooling down from 429 or 503.
 * 4. Automatic wait: If all keys are currently in use or cooling down, waits asynchronously
 *    and streams status messages to the client.
 */
async function acquireApiKey(apiKeys, pageNum, totalPages, onProgress) {
  while (true) {
    const now = Date.now();
    let soonestAvailableTime = Infinity;
    let candidateFound = null;

    // Search keys starting from keyRoundRobinIndex
    for (let i = 0; i < apiKeys.length; i++) {
      const idx = (keyRoundRobinIndex + i) % apiKeys.length;
      const key = apiKeys[idx];

      // If another worker is currently in-flight with this key, skip it
      if (inFlightKeys.has(key)) {
        continue;
      }

      // Check cooldown (from 429 or 503)
      const cooldownUntil = keyCooldowns.get(key) || 0;
      if (now < cooldownUntil) {
        soonestAvailableTime = Math.min(soonestAvailableTime, cooldownUntil);
        continue;
      }

      // Check minimum interval between requests for this key
      const lastUsed = keyLastUsedTime.get(key) || 0;
      const eligibleAt = lastUsed + MIN_KEY_INTERVAL_MS;
      if (now < eligibleAt) {
        soonestAvailableTime = Math.min(soonestAvailableTime, eligibleAt);
        continue;
      }

      // Key is completely free, cooled down, and interval has passed!
      candidateFound = { key, keyIndex: idx };
      keyRoundRobinIndex = (idx + 1) % apiKeys.length;
      break;
    }

    if (candidateFound) {
      inFlightKeys.add(candidateFound.key);
      keyLastUsedTime.set(candidateFound.key, Date.now());
      return candidateFound;
    }

    // No key is ready right now. Calculate how long to wait.
    let waitMs = soonestAvailableTime === Infinity ? 1000 : Math.max(100, soonestAvailableTime - now);
    waitMs = Math.min(waitMs, 2000); // Check frequently in case an in-flight key finishes earlier

    // If all keys are in cooldown from Google rate limits, notify progress
    const allInCooldown = apiKeys.every(k => (keyCooldowns.get(k) || 0) > now);
    if (allInCooldown) {
      let maxWaitMs = 0;
      for (const k of apiKeys) {
        maxWaitMs = Math.max(maxWaitMs, (keyCooldowns.get(k) || 0) - now);
      }
      const waitSec = Math.ceil(maxWaitMs / 1000);
      onProgress?.({
        current: Math.max(0, pageNum - 1),
        total: totalPages,
        percent: Math.round(((pageNum - 1) / totalPages) * 100),
        message: `⏳ Quota cooldown. Resuming page ${pageNum} in ${waitSec}s...`
      });
    }

    await new Promise(r => setTimeout(r, waitMs));
  }
}

function releaseApiKey(key) {
  inFlightKeys.delete(key);
}

/**
 * Call Gemini Flash API using multi-key round-robin pool with smart failover,
 * jittered key selection, and persistent auto-recovery from 503 High Demand spikes.
 * @param {string} mimeType - MIME type of the part
 * @param {string} base64Data - Base64 encoded file data
 * @param {string[]} apiKeys - Array of Gemini API keys
 * @param {number} pageNum - Current page number
 * @param {number} totalPages - Total page count
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<string>} - Transcribed markdown
 */
async function callGeminiFlashWithPool(mimeType, base64Data, apiKeys, pageNum, totalPages, onProgress) {
  const maxAttempts = Math.max(apiKeys.length * 3, 18);
  let attempts = 0;
  let consecutiveQuotaErrors = 0;

  while (attempts < maxAttempts) {
    attempts++;

    // Acquire an eligible, rate-paced key from the pool
    const { key: selectedKey, keyIndex } = await acquireApiKey(apiKeys, pageNum, totalPages, onProgress);
    const selectedKeyNumber = keyIndex + 1;
    const currentModel = getActiveModel();

    try {
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
        keyCooldowns.set(selectedKey, Date.now() + 2000);
        await new Promise(r => setTimeout(r, 1000));
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

        // Handle HTTP 429 Rate Limit with Smart Key Failover & Model Fallback
        if (response.status === 429) {
          consecutiveQuotaErrors++;
          const cooldownSec = parseRetryDelay(response, errJson);
          keyCooldowns.set(selectedKey, Date.now() + cooldownSec * 1000);
          console.warn(`⚠️ Key #${selectedKeyNumber} hit rate limit (429) on ${currentModel}: ${errorDetail}. Cooldown: ${cooldownSec}s.`);

          // Circuit breaker: If all keys in the pool fail consecutively on this model,
          // switch to the next fallback model (e.g. gemini-3.5-flash-lite)
          if (consecutiveQuotaErrors >= apiKeys.length) {
            console.warn(`All ${apiKeys.length} API keys exhausted quota on ${currentModel}. Attempting model fallback...`);
            if (switchToNextModel()) {
              consecutiveQuotaErrors = 0;
              const nextModel = getActiveModel();
              onProgress?.({
                current: Math.max(0, pageNum - 1),
                total: totalPages,
                percent: Math.round(((pageNum - 1) / totalPages) * 100),
                message: `Quota reached on ${currentModel}. Switching to ${nextModel}...`
              });
              continue;
            } else {
              // All models exhausted across all keys - stop immediately instead of looping
              throw new Error(`Daily free-tier quota exhausted across all ${apiKeys.length} API keys and models (${errorDetail}). Quota resets at midnight Pacific Time. To remove all limits permanently, link a billing account in Google AI Studio.`);
            }
          }

          onProgress?.({
            current: Math.max(0, pageNum - 1),
            total: totalPages,
            percent: Math.round(((pageNum - 1) / totalPages) * 100),
            message: `Key #${selectedKeyNumber} quota reached. Rotating to next key for page ${pageNum}...`
          });
          continue;
        }

        // Handle HTTP 503 (High Demand), 500, 502, 504 - Transient Server Spikes from Google
        const isTransientServerError = [500, 502, 503, 504].includes(response.status) ||
          errorDetail.toLowerCase().includes('high demand') ||
          errorDetail.toLowerCase().includes('temporarily unavailable') ||
          errorDetail.toLowerCase().includes('try again later');

        if (isTransientServerError) {
          console.warn(`⚠️ High demand spike (${response.status}) on page ${pageNum} with key #${selectedKeyNumber} [attempt ${attempts}/${maxAttempts}]: ${errorDetail}`);

          // Brief pause on this specific key
          keyCooldowns.set(selectedKey, Date.now() + 3000);

          // Exponential backoff
          const backoffSec = Math.min(2 * Math.ceil(attempts / 2), 8);
          for (let sec = backoffSec; sec > 0; sec--) {
            onProgress?.({
              current: Math.max(0, pageNum - 1),
              total: totalPages,
              percent: Math.round(((pageNum - 1) / totalPages) * 100),
              message: `⏳ High demand spike on Page ${pageNum}. Retrying in ${sec}s...`
            });
            await new Promise(r => setTimeout(r, 1000));
          }

          continue;
        }

        if (response.status === 400) {
          throw new Error(`API request error: ${errorDetail}`);
        } else if (response.status === 403) {
          throw new Error(`API authentication failed for key #${selectedKeyNumber}: ${errorDetail}`);
        }

        throw new Error(`API Error: ${errorDetail}`);
      }

      const result = await response.json();
      const candidate = result.candidates?.[0];
      const text = candidate?.content?.parts?.map(p => p.text).join('') || '';

      if (!text) {
        throw new Error('API returned an empty response for this page.');
      }

      // Success! Reset consecutive quota error counter and clear key cooldown
      consecutiveQuotaErrors = 0;
      keyCooldowns.delete(selectedKey);
      return cleanMarkdownOutput(text);

    } finally {
      // Release key back into pool so another worker can acquire it
      releaseApiKey(selectedKey);
    }
  }

  throw new Error(`Failed to transcribe page ${pageNum} after multiple retries across all available API keys.`);
}

/**
 * Clean up raw markdown output (remove unnecessary outer fences)
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

    // Determine concurrency based on available API keys (default: 1 sequential worker for zero-collision rate stability)
    const concurrency = Math.min(
      Math.max(1, apiKeys.length),
      parseInt(process.env.OCR_CONCURRENCY || '1', 10)
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
                type: 'PAGE_ERROR'
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

    const pageText = await callGeminiFlashWithPool(mimeType, rawData, apiKeys, 1, 1, onProgress);
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
