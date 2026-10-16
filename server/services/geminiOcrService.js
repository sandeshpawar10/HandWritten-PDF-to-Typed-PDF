import { PDFDocument } from 'pdf-lib';
import { createDocxBuffer } from './docxExportService.js';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
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
 * Helper to call Gemini Flash API
 * @param {string} mimeType - MIME type of the part
 * @param {string} base64Data - Base64 encoded file data
 * @param {string} apiKey - Google Gemini API key
 * @returns {Promise<string>} - Transcribed markdown
 */
async function callGeminiFlash(mimeType, base64Data, apiKey) {
  const url = `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

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

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || errorDetail;
    } catch {
      // ignore JSON parse error
    }

    if (response.status === 429) {
      throw new Error(`Gemini API rate limit exceeded. Please wait a moment and try again. (${errorDetail})`);
    } else if (response.status === 400) {
      throw new Error(`Gemini API request error: ${errorDetail}`);
    } else if (response.status === 403) {
      throw new Error(`Gemini API authentication failed. Please verify your GEMINI_API_KEY. (${errorDetail})`);
    }

    throw new Error(`Gemini API Error: ${errorDetail}`);
  }

  const result = await response.json();
  const candidate = result.candidates?.[0];
  const text = candidate?.content?.parts?.map(p => p.text).join('') || '';

  if (!text) {
    throw new Error('Gemini Flash returned an empty response for this page.');
  }

  return cleanMarkdownOutput(text);
}

/**
 * Clean up raw Gemini output (remove unnecessary markdown fences wrapping the entire output)
 */
function cleanMarkdownOutput(raw) {
  let cleaned = raw.trim();
  // If the model wrapped everything in ```markdown ... ```
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw {
      status: 500,
      data: {
        error: 'Google Gemini API key is not configured. Please set GEMINI_API_KEY in your .env file or server environment.',
        type: 'CONFIG_ERROR'
      }
    };
  }

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

      // Extract single-page PDF in-memory
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePageBytes = await singlePageDoc.save();
      const singlePageBase64 = Buffer.from(singlePageBytes).toString('base64');

      try {
        const pageText = await callGeminiFlash('application/pdf', singlePageBase64, apiKey);
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

    const pageText = await callGeminiFlash(mimeType, rawData, apiKey);

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
