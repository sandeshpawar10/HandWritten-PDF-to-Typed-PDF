import { PDFDocument } from 'pdf-lib';
import { createDocxBuffer } from './docxExportService.js';

function getModelName() {
  const envModel = process.env.GEMINI_MODEL;
  if (!envModel || envModel.includes('2.0-flash') || envModel.includes('1.5-flash')) {
    return 'gemini-3.8-flash';
  }
  return envModel;
}

const GEMINI_MODEL = getModelName();
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

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
   - Use standard LaTeX symbols: \\times, \\cdot, \\frac{a}{b}, \\sum, \\int, \\in, \\subseteq, \\cup, \\cap, \\oplus, \\oplus, \\land, \\lor, \\neg.

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
  // 1. Try retry-after header
  const retryHeader = response.headers.get('retry-after');
  if (retryHeader) {
    const sec = parseInt(retryHeader, 10);
    if (!isNaN(sec) && sec > 0) return sec + 2;
  }

  // 2. Try parsing message: "Please retry in 28.219388019s."
  const msg = errJson?.error?.message || '';
  const match = msg.match(/retry in ([\d.]+)s/i);
  if (match) {
    const sec = parseFloat(match[1]);
    if (!isNaN(sec) && sec > 0) return Math.ceil(sec) + 2;
  }

  // 3. Fallback default
  return 30;
}

/**
 * Call Gemini Flash API using multi-key round-robin pool with smart failover and auto-retry
 * @param {string} mimeType - MIME type of the part
 * @param {string} base64Data - Base64 encoded file data
 * @param {string[]} apiKeys - Array of Gemini API keys
 * @param {number} pageNum - Current page number
 * @param {number} totalPages - Total page count
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<string>} - Transcribed markdown
 */
async function callGeminiFlashWithPool(mimeType, base64Data, apiKeys, pageNum, totalPages, onProgress) {
  const maxAttempts = Math.max(apiKeys.length * 3, 6);
  let attempts = 0;

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

      // Stream live countdown to client (1-second tick)
      for (let sec = waitSec; sec > 0; sec--) {
        onProgress?.({
          current: Math.max(0, pageNum - 1),
          total: totalPages,
          percent: Math.round(((pageNum - 1) / totalPages) * 100),
          message: `⏳ Rate limit reached. Resuming page ${pageNum} of ${totalPages} in ${sec}s...`
        });
        await new Promise(r => setTimeout(r, 1000));
      }

      selectedKey = soonestKey;
      keyCooldowns.delete(soonestKey);
    }

    // 3. Make the API request with the selected key
    const url = `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${selectedKey}`;
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
      console.warn(`Network error with key #${selectedKeyNumber}:`, fetchErr.message);
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
        // ignore JSON parse error
      }

      // Handle HTTP 429 Rate Limit with Smart Key Failover
      if (response.status === 429) {
        const cooldownSec = parseRetryDelay(response, errJson);
        keyCooldowns.set(selectedKey, Date.now() + cooldownSec * 1000);
        console.warn(`⚠️ Key #${selectedKeyNumber} hit rate limit (429). Cooldown: ${cooldownSec}s.`);

        if (apiKeys.length > 1) {
          // Immediately try the next key in the pool!
          console.log(`Rotating to next available API key for page ${pageNum}...`);
          onProgress?.({
            current: Math.max(0, pageNum - 1),
            total: totalPages,
            percent: Math.round(((pageNum - 1) / totalPages) * 100),
            message: `Key #${selectedKeyNumber} quota reached. Rotating to next API key for page ${pageNum}...`
          });
          continue;
        } else {
          // Single key: countdown wait
          for (let sec = cooldownSec; sec > 0; sec--) {
            onProgress?.({
              current: Math.max(0, pageNum - 1),
              total: totalPages,
              percent: Math.round(((pageNum - 1) / totalPages) * 100),
              message: `⏳ Free-tier rate limit reached. Resuming page ${pageNum} of ${totalPages} in ${sec}s...`
            });
            await new Promise(r => setTimeout(r, 1000));
          }
          keyCooldowns.delete(selectedKey);
          continue;
        }
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
 * Main chunked Gemini OCR processing function with progress reporting
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

  const transcribedPages = [];

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

    onProgress?.({
      current: 0,
      total: totalPages,
      percent: 0,
      message: `Starting Gemini Flash OCR for ${totalPages} page(s)...`
    });

    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      const progressPercent = Math.round((i / totalPages) * 100);

      onProgress?.({
        current: i,
        total: totalPages,
        percent: progressPercent,
        message: `Transcribing page ${pageNum} of ${totalPages} with Gemini Flash...`
      });

      console.log(`Processing page ${pageNum}/${totalPages}...`);

      // Extract single-page PDF in-memory (100% individual page attention)
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePageBytes = await singlePageDoc.save();
      const singlePageBase64 = Buffer.from(singlePageBytes).toString('base64');

      try {
        const pageText = await callGeminiFlashWithPool('application/pdf', singlePageBase64, apiKeys, pageNum, totalPages, onProgress);
        transcribedPages.push(`--- Page ${pageNum} ---\n\n${pageText}`);
      } catch (pageErr) {
        console.error(`Error transcribing page ${pageNum}:`, pageErr.message);
        throw {
          status: 500,
          data: {
            error: `Failed to transcribe page ${pageNum}: ${pageErr.message}`,
            type: 'GEMINI_PAGE_ERROR'
          }
        };
      }

      onProgress?.({
        current: pageNum,
        total: totalPages,
        percent: Math.round((pageNum / totalPages) * 100),
        message: `Page ${pageNum} transcribed successfully.`
      });

      // Gentle pause (1 second) between pages to keep network flow smooth
      if (i < totalPages - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    onProgress?.({
      current: totalPages,
      total: totalPages,
      percent: 100,
      message: 'Generating formatted Word document...'
    });

    const fullMarkdown = transcribedPages.join('\n\n');

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
      message: 'Generating formatted Word document...'
    });

    let formattedDocx = null;
    try {
      const docxBuffer = await createDocxBuffer('Transcribed Notes', pageText);
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
