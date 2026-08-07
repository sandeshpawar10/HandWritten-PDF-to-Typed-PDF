/**
 * mistral-ocr.ts  (kept as gemini.ts so no import paths need changing)
 * Uses Mistral OCR 3 + Mistral Chat to produce properly formatted Markdown
 * with real LaTeX math and smart bold/heading detection.
 */

import { auth } from '../lib/firebase.js';

const API_BASE = "https://type-doc-backend.onrender.com";
const PROXY_OCR_URL  = `${API_BASE}/api/ocr`;
const PROXY_CHAT_URL = `${API_BASE}/api/chat`;
const OCR_MODEL        = "mistral-ocr-latest";
const CHAT_MODEL       = "mistral-medium-latest";   // used for post-processing

const MAX_RECOMMENDED_SIZE = 50 * 1024 * 1024;

// ─────────────────────────────────────────────
//  Retry helpers
// ─────────────────────────────────────────────
const MAX_RETRIES   = 4;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS  = 60_000;

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
const POST_PROCESS_PROMPT = `You are a Markdown formatting expert. I will give you raw OCR output from a handwritten document.

Your job is to REFORMAT it — do NOT change the words, only improve the Markdown structure:

## 1. MATHEMATICS (MOST IMPORTANT)
- Every mathematical expression MUST be wrapped in LaTeX delimiters:
  - Inline math: $expression$ — e.g. $x^2 + y^2 = r^2$, $\\frac{a}{b}$, $\\alpha + \\beta$
  - Block/display math: $$ expression $$ — for equations on their own line
- Convert ALL of these to proper LaTeX:
  - Plain text like "x^2" → $x^2$
  - Code blocks containing equations → $$ ... $$
  - Fractions written as "a/b" in context → $\\frac{a}{b}$
  - Greek letters written out → $\\alpha$, $\\beta$, $\\theta$, etc.
  - Square roots → $\\sqrt{x}$
  - Subscripts like "x_1" → $x_1$
  - Integrals, summations, limits → proper LaTeX
  - Chemical/physics formulas → $E = mc^2$
- CRITICAL: DO NOT wrap Markdown headers (##, ###) or plain text paragraphs inside $$...$$. 
- CRITICAL: DO NOT put text words inside the math block. Instead of `$$ a_n = ... \text{ For } n = 0 $$`, write `$$ a_n = ... $$ For $n = 0$`.
- If a line is ONLY an equation, use display math ($$).
- If math is mid-sentence, use inline math ($).

## 2. HEADINGS — detect and promote:
- Main document title → # Title
- Chapter/section names (usually underlined or ALL CAPS or written larger) → ## Section
- Subsection names → ### Subsection
- If a short line is followed by body text and reads like a topic name → make it ## or ###

## 3. BOLD TEXT — apply intelligently:
- **Bold** every: topic name, key term, definition word, important concept
- In a definition like "Ohm's Law: V = IR", bold the term: **Ohm's Law**
- Bold the first mention of any technical term
- Bold labels before colons: **Note:**, **Example:**, **Theorem:**, **Proof:**
- Do NOT bold entire sentences or paragraphs

## 4. PRESERVE EVERYTHING ELSE:
- Keep all original words exactly — do not summarize or omit
- Keep tables as Markdown tables
- Keep lists as lists
- Keep page separators (--- Page N ---)
- Keep blockquotes (> ...)

## OUTPUT:
- Return ONLY the reformatted Markdown
- No preamble, no explanation, no code fences around the whole output`;

async function postProcess(
  rawMarkdown,
  onProgress
) {
  onProgress?.("Formatting math, bold text, and headings…");

  const pages = rawMarkdown.split(/(?=--- Page \d+ ---)/);
  const CHUNK_SIZE = 6; // pages per chunk (increased from 3 for faster processing)
  const processed = [];

  for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
    const chunk = pages.slice(i, i + CHUNK_SIZE).join("\n\n");
    const pageNums = `${i + 1}–${Math.min(i + CHUNK_SIZE, pages.length)}`;
    onProgress?.(`Formatting pages ${pageNums} of ${pages.length}…`);
    
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

    // Small pause between chunks
    if (i + CHUNK_SIZE < pages.length) await sleep(1500);
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
  if (file.size > MAX_RECOMMENDED_SIZE)
    console.warn(`[TypedDoc] File is ${(file.size / 1024 / 1024).toFixed(1)} MB — may be slow.`);

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