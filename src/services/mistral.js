/**
 * Mistral OCR Service (Frontend)
 * Uses Mistral OCR + Mistral Chat to convert handwritten documents to formatted Markdown
 * with LaTeX math and intelligent formatting.
 */

import { auth } from '../lib/firebase.js';

// Issue #18: Extract magic numbers to named constants
// API Configuration
const API_BASE = import.meta.env.PROD
  ? "https://type-doc-backend.onrender.com"
  : "http://localhost:3001";
const PROXY_OCR_URL  = `${API_BASE}/api/ocr`;
const PROXY_CHAT_URL = `${API_BASE}/api/chat`;
const OCR_MODEL = "mistral-ocr-latest";
const CHAT_MODEL = "mistral-large-latest";

// File size limits (Issue #13 + OOM Prevention)
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB - prevents backend OOM on low-memory servers
const WARN_FILE_SIZE = 10 * 1024 * 1024; // 10MB - show warning
const MAX_FILE_SIZE_MB = 20; // For error messages

// Retry configuration (Issue #18)
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;

// Processing configuration (Issue #18)
const PAGES_PER_CHUNK = 2; // Pages processed per API call
const CHUNK_DELAY_MS = 1500; // Delay between chunk processing
const AVERAGE_READING_SPEED_WPM = 200; // For read time calculation

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isRateLimit(status, body) {
  if (status === 429) return true;
  const msg = (body?.message || body?.error?.message || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("quota") || msg.includes("too many");
}

function retryDelay(headers, attempt) {
  const ra = headers.get("retry-after");
  if (ra) { const s = parseInt(ra, 10); if (!isNaN(s)) return Math.min(s * 1000 + 500, MAX_DELAY_MS); }
  return Math.min(BASE_DELAY_MS * 2 ** attempt + Math.random() * 1000, MAX_DELAY_MS);
}

async function apiFetch(
  url, body,
  label, onProgress
) {
  let lastErr;
  // Get Firebase ID token
  if (!auth.currentUser) throw new Error("Must be logged in to process documents.");
  const token = await auth.currentUser.getIdToken();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) return data;

    const msg = data?.message || data?.error?.message || `HTTP ${res.status}`;
    if (isRateLimit(res.status, data) && attempt < MAX_RETRIES) {
      const d = retryDelay(res.headers, attempt);
      onProgress?.(`Rate limited – waiting ${(d/1000).toFixed(0)}s… (retry ${attempt+1}/${MAX_RETRIES})`);
      await sleep(d); continue;
    }
    if (res.status === 401) throw new Error("INVALID_API_KEY: Mistral key invalid. Check Settings.");
    if (res.status === 402 || msg.includes("billing") || msg.includes("quota"))
      throw new Error(`QUOTA: ${msg}`);
    lastErr = new Error(msg);
    throw lastErr;
  }
  throw lastErr ?? new Error("Max retries exceeded");
}

// ─────────────────────────────────────────────
//  Step 1 — Raw OCR via Mistral OCR endpoint
// ─────────────────────────────────────────────
async function runOCR(
  document,
  label,
  onProgress
) {
  const data = await apiFetch(PROXY_OCR_URL, { model: OCR_MODEL, document, include_image_base64: true }, label, onProgress);
  const pages = data.pages ?? [];
  
  const imageMap = {};
  
  const markdown = pages.map((p, i) => {
    // Extract base64 images into a separate map so we don't bloat the LLM context
    if (p.images && p.images.length > 0) {
      for (const img of p.images) {
        if (img.id && img.image_base64) {
          const b64 = img.image_base64;
          imageMap[img.id] = b64.startsWith("data:image") ? b64 : `data:image/jpeg;base64,${b64}`;
        }
      }
    }
    return `--- Page ${i + 1} ---\n\n${p.markdown}`;
  }).join("\n\n").trim();

  return { markdown, imageMap };
}

// ─────────────────────────────────────────────
//  Step 2 — AI post-processing for math + bold + headings
// ─────────────────────────────────────────────
const POST_PROCESS_PROMPT = `You are an elite Computer Science Professor and a Markdown formatting expert. I will give you raw OCR output from handwritten Data Structures and Algorithms notes.

Your job is to REFORMAT it and CORRECT OCR ERRORS silently without changing the intended meaning:

## 1. INTELLIGENT OCR SPELL-CHECK (CRITICAL)
- Handwriting OCR often makes mistakes. You MUST use your CS knowledge to quietly autocorrect obvious typos.
- Examples of required autocorrects:
  - "Trautable" → "Tractable"
  - "Intraitable" → "Intractable"
  - "salution" → "solution"

## 2. CODE SYNTAX AUTOCORRECTION
- If you see a code block or pseudocode, format it cleanly with \`\`\`c or \`\`\` text.
- OCR often breaks brackets and keywords. Quietly fix them to make the code valid:
  - Change "scarf" to "scanf"
  - Ensure functions start with "{" and end with "}" (OCR often misreads "{" as "}").
  - Restore proper indentation for loops and conditionals.

## 3. MATHEMATICAL RECONSTRUCTION
- Every mathematical expression MUST be wrapped in LaTeX delimiters ($ or $$).
- If an equation comes in scrambled (e.g., "⌈log n!⌉ 2 Cworst(n) ≥ ⌈log n!⌉ 2 n!"), DO NOT blindly copy the garbage. Use your context of Stirling's approximation, time complexities, or bounds to output the mathematically correct equation: $$ C_{worst}(n) \ge \\lceil \\log_2 n! \\rceil $$
- Convert written fractions like a/b to $\\frac{a}{b}$, and fix scrambled logarithms and inequalities.

## 4. DIAGRAM TEXT RECOVERY
- If OCR spits out random floating letters (like "A Reduce B Polynomial"), format it as a logical text sequence or a bulleted list rather than leaving it as a messy broken sentence. 
- Try to logically represent trees or graphs if the text is clearly describing nodes and edges.

## 5. FIX OCR LAYOUT & REMOVE EMPTY SPACES (CRITICAL)
- **Make the text continuous.** Completely REMOVE all extra blank lines, empty spaces, and huge vertical gaps between paragraphs.
- REARRANGE SCRAMBLED TEXT: Use context to rearrange misplaced text so it flows in logical, chronological order.
- DELETE HALLUCINATIONS: Completely remove any hallucinated PDF filenames, metadata, or repeated headers like "DAA_MODULE5_NOTES" or "localhost:3000".

## 6. HEADINGS & BOLD TEXT
- **Bold** every key term, definition, and label (e.g., **Theorem:**, **Note:**).
- Promote chapter names to #, ##, or ###.

## 7. PRESERVE INTENT WITHOUT OMITTING
- DO NOT OMIT ANY TEXT. You MUST include every single paragraph, sentence, and word exactly as written (except for the typos you fix).
- CRITICAL: Keep all code snippets, pseudocode, and algorithms. Do not summarize or skip them.
- Keep tables as Markdown tables.
- Keep page separators (--- Page N ---).

## OUTPUT:
- Return ONLY the reformatted Markdown.
- No preamble, no explanation, no code fences around the whole output.`;

async function postProcess(
  rawMarkdown,
  onProgress
) {
  onProgress?.("Formatting math, bold text, and headings…");

  const pages = rawMarkdown.split(/(?=--- Page \d+ ---)/);
  const processed = [];
  const failures = []; // Track failed chunks for user notification

  for (let i = 0; i < pages.length; i += PAGES_PER_CHUNK) {
    const chunk = pages.slice(i, i + PAGES_PER_CHUNK).join("\n\n");
    const pageNums = `${i + 1}–${Math.min(i + PAGES_PER_CHUNK, pages.length)}`;
    onProgress?.(`Formatting pages ${pageNums} of ${pages.length}…`);

    try {
      const data = await apiFetch(
        PROXY_CHAT_URL,
        {
          model: CHAT_MODEL,
          max_tokens: 8192,
          messages: [
            { role: "system", content: POST_PROCESS_PROMPT },
            { role: "user", content: chunk },
          ],
        },
        `post-process pages ${pageNums}`,
        onProgress
      );

      let text = data.choices?.[0]?.message?.content ?? chunk;

      // Robustly extract the markdown payload from the AI's response.
      // AI often includes conversational filler like "Here is the formatted text: \n ```markdown \n ... \n ```"
      const match = text.match(/```(?:markdown)?\s*\n([\s\S]*?)\n```/i);
      if (match) {
        text = match[1].trim();
      } else {
        // Fallback: manually strip if it's perfectly wrapped but missed by regex
        text = text.trim();
        if (text.startsWith("```markdown") && text.endsWith("```")) text = text.slice(11, -3).trim();
        else if (text.startsWith("```") && text.endsWith("```")) text = text.slice(3, -3).trim();
      }

      processed.push(text);

    } catch (error) {
      // PARTIAL RECOVERY: Don't fail the entire document
      // Fall back to raw OCR text for this chunk
      console.warn(`Post-processing failed for pages ${pageNums}:`, error.message);

      failures.push(pageNums);

      // Add warning banner to the failed chunk
      const warningBanner =
        `\n\n---\n\n` +
        `⚠️ **Processing Note**: Pages ${pageNums} could not be fully formatted due to a network error. ` +
        `Raw OCR text is shown below. You can manually edit this section.\n\n` +
        `---\n\n`;

      // Use raw OCR text as fallback
      processed.push(warningBanner + chunk);

      // Notify user but continue processing
      onProgress?.(
        `⚠️ Pages ${pageNums} partially processed. Continuing with remaining pages…`
      );
    }

    // Small pause between chunks to avoid rate limiting
    if (i + PAGES_PER_CHUNK < pages.length) await sleep(CHUNK_DELAY_MS);
  }

  // Notify user if any chunks failed
  if (failures.length > 0) {
    const failedPagesList = failures.join(', ');
    onProgress?.(
      `✓ Document processed with warnings. Pages ${failedPagesList} contain raw OCR text. ` +
      `All other pages were successfully formatted.`
    );
  }

  return processed.join("\n\n").trim();
}

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────
export async function convertHandwritingToText(
  file,
  onProgress
) {
  // Issue #13 + OOM Prevention: Strict file size validation
  // Backend has 25MB payload limit to prevent OOM on low-memory servers
  // Frontend enforces 20MB limit to stay safely under backend limit
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds maximum limit of ${MAX_FILE_SIZE_MB} MB. ` +
      `Please split large documents into smaller files (10-15 pages each) for better processing.`
    );
  }

  if (file.size > WARN_FILE_SIZE) {
    onProgress?.(
      `Large file detected (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
      `Processing may take several minutes. For faster results, consider splitting into smaller files.`
    );
  }

  const isPdf = file.type === "application/pdf";

  // Step 1: OCR
  onProgress?.(isPdf ? "Sending PDF to Mistral OCR…" : "Sending image to Mistral OCR…");
  const { markdown: rawMarkdown, imageMap } = isPdf
    ? await runOCR(
        { type: "document_url", document_url: `data:application/pdf;base64,${await toBase64(file)}` },
        file.name, onProgress
      )
    : await runOCR(
        { type: "image_url", image_url: `data:${file.type};base64,${await toBase64(file)}` },
        file.name, onProgress
      );

  // Step 2: Post-process for math + bold + headings (without massive base64 bloat)
  let formatted = await postProcess(rawMarkdown, onProgress);

  // Step 3: Inject the actual base64 images into the final output
  for (const [id, base64Url] of Object.entries(imageMap)) {
    formatted = formatted.split(`](${id})`).join(`](${base64Url})`);
  }

  onProgress?.("Done!");
  return formatted;
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.readAsDataURL(file);
    r.onload  = () => res(r.result.split(",")[1]);
    r.onerror = rej;
  });
}