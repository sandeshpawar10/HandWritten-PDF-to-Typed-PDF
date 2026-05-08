// import { GoogleGenAI } from "@google/genai";
// import { convertPdfToImages } from './pdf-parser';

// function getAiClient(): GoogleGenAI {
//   const customKey = typeof window !== "undefined" ? localStorage.getItem("TYPEDDOC_GEMINI_API_KEY") : null;
//   const apiKey = customKey
//     || (typeof process !== "undefined" && (process as any).env?.GEMINI_API_KEY)
//     || (import.meta as any).env?.VITE_GEMINI_API_KEY
//     || "AIzaSyCI_7VFzKKJdebu5TiK3rf_iTwT5Z4FGBE";

//   return new GoogleGenAI({ apiKey });
// }

// // ── Retry configuration ──
// const MAX_RETRIES = 4;
// const BASE_DELAY_MS = 3000;  // 3 seconds initial wait
// const MAX_DELAY_MS = 60000;  // 1 minute max wait

// /** Maximum recommended file size in bytes (10 MB) */
// const MAX_RECOMMENDED_SIZE = 10 * 1024 * 1024;

// /**
//  * Sleep for a given number of milliseconds.
//  */
// function sleep(ms: number): Promise<void> {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }

// /**
//  * Check if an error is a rate limit (429) or quota error.
//  */
// function isRateLimitError(err: any): boolean {
//   const msg = (err?.message || '').toLowerCase();
//   const status = err?.status || err?.httpStatus || 0;
//   return (
//     status === 429 ||
//     msg.includes('429') ||
//     msg.includes('rate limit') ||
//     msg.includes('quota') ||
//     msg.includes('resource exhausted') ||
//     msg.includes('too many requests')
//   );
// }

// /**
//  * Wrapper that calls the Gemini API with automatic retry + exponential backoff
//  * when rate-limited (429 / quota errors).
//  */
// async function callWithRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
//   let lastError: any;

//   for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
//     try {
//       return await fn();
//     } catch (err: any) {
//       lastError = err;

//       if (!isRateLimitError(err) || attempt === MAX_RETRIES) {
//         throw err;
//       }

//       // Exponential backoff: 3s → 6s → 12s → 24s (with jitter)
//       const delay = Math.min(
//         BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000,
//         MAX_DELAY_MS
//       );
//       console.warn(
//         `[TypedDoc] Rate limited on "${label}" (attempt ${attempt + 1}/${MAX_RETRIES + 1}). ` +
//         `Retrying in ${(delay / 1000).toFixed(1)}s...`
//       );
//       await sleep(delay);
//     }
//   }

//   throw lastError;
// }

// // ── Public API ──

// export async function convertHandwritingToText(
//   file: File,
//   onProgress?: (status: string) => void
// ): Promise<string> {
//   // Warn about very large files
//   if (file.size > MAX_RECOMMENDED_SIZE) {
//     const sizeMB = (file.size / 1024 / 1024).toFixed(1);
//     console.warn(
//       `[TypedDoc] File "${file.name}" is ${sizeMB} MB. ` +
//       `Large files are more likely to hit API rate limits.`
//     );
//   }

//   const isPdf = file.type === "application/pdf";

//   if (isPdf) {
//     return convertPdfHandwritingToText(file, onProgress);
//   } else {
//     return convertImageHandwritingToText(file, onProgress);
//   }
// }

// async function convertImageHandwritingToText(
//   file: File,
//   onProgress?: (status: string) => void
// ): Promise<string> {
//   onProgress?.('Reading file...');
//   const base64Data = await fileToBase64(file);

//   onProgress?.('Sending to Gemini AI...');
//   const response = await callWithRetry(
//     () => getAiClient().models.generateContent({
//       model: "gemini-2.0-flash",
//       contents: [
//         {
//           role: "user",
//           parts: [
//             {
//               inlineData: {
//                 mimeType: file.type,
//                 data: base64Data,
//               },
//             },
//             {
//               text: getTranscriptionPrompt(),
//             },
//           ],
//         },
//       ],
//     }),
//     file.name
//   );

//   return response.text ?? "";
// }

// async function convertPdfHandwritingToText(
//   file: File,
//   onProgress?: (status: string) => void
// ): Promise<string> {
//   const images = await convertPdfToImages(file, onProgress);
//   const totalPages = images.length;
  
//   if (totalPages === 0) {
//     throw new Error("No pages could be extracted from the PDF.");
//   }

//   let finalMarkdown = "";
//   const BATCH_SIZE = 5;
//   const DELAY_MS = 6000; // 6 seconds pacing to guarantee < 15 RPM

//   for (let i = 0; i < totalPages; i += BATCH_SIZE) {
//     const end = Math.min(i + BATCH_SIZE, totalPages);
//     onProgress?.(`Transcribing pages ${i + 1} to ${end} of ${totalPages}...`);
    
//     const parts: any[] = [];
//     let promptText = `${getTranscriptionPrompt()}\n\n`;
    
//     for (let j = i; j < end; j++) {
//       parts.push({
//         inlineData: {
//           mimeType: "image/jpeg",
//           data: images[j],
//         },
//       });
//       promptText += `Image ${j - i + 1} is Page ${j + 1} of ${totalPages}.\n`;
//     }
    
//     promptText += `\nPlease transcribe ALL provided pages in order. Separate the transcription for each page with exactly "--- Page N ---" where N is the page number (e.g., "--- Page 1 ---"). Do not wrap the whole output in a single code block.`;
    
//     parts.push({ text: promptText });

//     const response = await callWithRetry(
//       () => getAiClient().models.generateContent({
//         model: "gemini-2.0-flash",
//         contents: [{ role: "user", parts: parts }],
//       }),
//       `Pages ${i + 1}-${end}`
//     );

//     const batchText = response.text ?? "";
//     finalMarkdown += `\n\n${batchText}`;

//     if (end < totalPages) {
//       onProgress?.(`Waiting 6s to prevent rate limits...`);
//       await sleep(DELAY_MS); 
//     }
//   }

//   return finalMarkdown.trim();
// }

// function getTranscriptionPrompt(): string {
//   return `You are the 'Typed Document' transcription engine. Your goal is to transform handwritten notes into a perfectly legible, professional typed document using **Markdown** formatting.

// ## CRITICAL RULES:

// ### 1. Tables (MOST IMPORTANT)
// - If you see ANY handwritten table, grid, or columnar data, you MUST reproduce it as a proper Markdown table.
// - Use the standard Markdown table syntax with pipes and dashes:
//   | Column 1 | Column 2 | Column 3 |
//   |----------|----------|----------|
//   | data     | data     | data     |
// - Preserve all rows and columns exactly as written.
// - If cells are merged or span multiple columns, represent them as best as possible.
// - Even rough/sketchy tables with hand-drawn lines must be converted to Markdown tables.

// ### 2. Headings & Structure
// - Use Markdown headings: # for main titles, ## for sections, ### for subsections.
// - Preserve the document's hierarchical structure.

// ### 3. Lists
// - Ordered lists: use 1. 2. 3. numbering.
// - Unordered lists: use - bullet points.
// - Preserve nested/indented lists with proper indentation.

// ### 4. Text Formatting
// - Use **bold** for emphasized or underlined words.
// - Use *italic* for lightly emphasized text.
// - Preserve paragraph breaks with blank lines between paragraphs.

// ### 5. Math & Formulas
// - Render mathematical formulas inline using backticks for simple expressions: \`E = mc²\`
// - For complex equations, use a code block:
//   \`\`\`
//   f(x) = ax² + bx + c
//   \`\`\`

// ### 6. Diagrams & Flowcharts
// - If there is a hand-drawn diagram or flowchart, describe it in a blockquote:
//   > **[Diagram]**: Flowchart showing Step A → Step B → Step C with a decision diamond at Step B.

// ### 7. Accuracy
// - Transcribe with 100% accuracy.
// - If words are ambiguous, choose the most likely professional word that fits the context.
// - Do NOT skip any content. Transcribe everything visible.

// ### 8. Output
// - Output ONLY the final Markdown text.
// - No preamble, no commentary, no explanations.
// - Do not wrap the entire output in a code block.`;
// }

// function fileToBase64(file: File): Promise<string> {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.readAsDataURL(file);
//     reader.onload = () => {
//       const base64String = (reader.result as string).split(",")[1];
//       resolve(base64String);
//     };
//     reader.onerror = (error) => reject(error);
//   });
// }






// import { GoogleGenAI } from "@google/genai";
// import { convertPdfToImages } from './pdf-parser';

// // ─────────────────────────────────────────────
// //  API client – NEVER fall back to a hardcoded key.
// //  Users MUST supply their own key via Settings.
// // ─────────────────────────────────────────────
// function getAiClient(): GoogleGenAI {
//   const customKey =
//     typeof window !== "undefined"
//       ? localStorage.getItem("TYPEDDOC_GEMINI_API_KEY")
//       : null;

//   const envKey =
//     (typeof process !== "undefined" && (process as any).env?.GEMINI_API_KEY) ||
//     (import.meta as any).env?.VITE_GEMINI_API_KEY ||
//     null;

//   const apiKey = customKey || envKey;

//   if (!apiKey) {
//     throw new Error(
//       "NO_API_KEY: No Gemini API key found. Please go to Settings and add your own free key from Google AI Studio (https://aistudio.google.com/app/apikey)."
//     );
//   }

//   return new GoogleGenAI({ apiKey });
// }

// // ─────────────────────────────────────────────
// //  Retry / back-off config
// // ─────────────────────────────────────────────
// const MAX_RETRIES = 5;
// const BASE_DELAY_MS = 8_000;
// const MAX_DELAY_MS = 120_000;

// /** Per-page delay to stay under the free-tier 15 RPM limit. */
// const PAGE_DELAY_MS = 5_000;

// const MAX_RECOMMENDED_SIZE = 20 * 1024 * 1024;

// function sleep(ms: number): Promise<void> {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }

// function isRateLimitError(err: any): boolean {
//   const msg = (err?.message || '').toLowerCase();
//   const status = err?.status || err?.httpStatus || 0;
//   return (
//     status === 429 ||
//     msg.includes('429') ||
//     msg.includes('rate limit') ||
//     msg.includes('quota') ||
//     msg.includes('resource exhausted') ||
//     msg.includes('too many requests')
//   );
// }

// function getRetryDelay(err: any, attempt: number): number {
//   const retryAfterSec =
//     err?.headers?.['retry-after'] ||
//     err?.response?.headers?.['retry-after'] ||
//     null;

//   if (retryAfterSec) {
//     const parsed = parseInt(retryAfterSec, 10);
//     if (!isNaN(parsed)) return Math.min(parsed * 1000 + 1000, MAX_DELAY_MS);
//   }

//   return Math.min(
//     BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 2_000,
//     MAX_DELAY_MS
//   );
// }

// async function callWithRetry<T>(
//   fn: () => Promise<T>,
//   label: string,
//   onProgress?: (status: string) => void
// ): Promise<T> {
//   let lastError: any;

//   for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
//     try {
//       return await fn();
//     } catch (err: any) {
//       lastError = err;

//       if (!isRateLimitError(err) || attempt === MAX_RETRIES) {
//         throw err;
//       }

//       const delay = getRetryDelay(err, attempt);
//       const delaySec = (delay / 1000).toFixed(0);

//       console.warn(
//         `[TypedDoc] Rate limited on "${label}" (attempt ${attempt + 1}/${MAX_RETRIES + 1}). ` +
//         `Waiting ${delaySec}s…`
//       );
//       onProgress?.(`Rate limited. Waiting ${delaySec}s before retry ${attempt + 1}/${MAX_RETRIES}…`);
//       await sleep(delay);
//     }
//   }

//   throw lastError;
// }

// // ─────────────────────────────────────────────
// //  Public API
// // ─────────────────────────────────────────────

// export async function convertHandwritingToText(
//   file: File,
//   onProgress?: (status: string) => void
// ): Promise<string> {
//   if (file.size > MAX_RECOMMENDED_SIZE) {
//     const sizeMB = (file.size / 1024 / 1024).toFixed(1);
//     console.warn(`[TypedDoc] File "${file.name}" is ${sizeMB} MB. Large files increase rate-limit risk.`);
//   }

//   const isPdf = file.type === "application/pdf";
//   return isPdf
//     ? convertPdfHandwritingToText(file, onProgress)
//     : convertImageHandwritingToText(file, onProgress);
// }

// async function convertImageHandwritingToText(
//   file: File,
//   onProgress?: (status: string) => void
// ): Promise<string> {
//   onProgress?.('Reading file…');
//   const base64Data = await fileToBase64(file);

//   onProgress?.('Sending to Gemini AI…');
//   const response = await callWithRetry(
//     () =>
//       getAiClient().models.generateContent({
//         model: "gemini-2.0-flash",
//         contents: [
//           {
//             role: "user",
//             parts: [
//               { inlineData: { mimeType: file.type, data: base64Data } },
//               { text: getTranscriptionPrompt() },
//             ],
//           },
//         ],
//       }),
//     file.name,
//     onProgress
//   );

//   return response.text ?? "";
// }

// // ONE PAGE PER REQUEST — the single biggest fix for rate-limit errors.
// // Sending 5 large images per call burns through token quotas extremely fast.
// async function convertPdfHandwritingToText(
//   file: File,
//   onProgress?: (status: string) => void
// ): Promise<string> {
//   const images = await convertPdfToImages(file, onProgress);
//   const totalPages = images.length;

//   if (totalPages === 0) {
//     throw new Error("No pages could be extracted from the PDF.");
//   }

//   const pageTexts: string[] = [];

//   for (let i = 0; i < totalPages; i++) {
//     const pageNum = i + 1;
//     onProgress?.(`Transcribing page ${pageNum} of ${totalPages}…`);

//     const parts: any[] = [
//       { inlineData: { mimeType: "image/jpeg", data: images[i] } },
//       {
//         text:
//           `${getTranscriptionPrompt()}\n\n` +
//           `This is page ${pageNum} of ${totalPages}. Transcribe it now.`,
//       },
//     ];

//     const response = await callWithRetry(
//       () =>
//         getAiClient().models.generateContent({
//           model: "gemini-2.0-flash",
//           contents: [{ role: "user", parts }],
//         }),
//       `Page ${pageNum}`,
//       onProgress
//     );

//     pageTexts.push(`--- Page ${pageNum} ---\n\n${response.text ?? ""}`);

//     if (i < totalPages - 1) {
//       onProgress?.(`Page ${pageNum} done. Pacing requests…`);
//       await sleep(PAGE_DELAY_MS);
//     }
//   }

//   return pageTexts.join("\n\n").trim();
// }

// function getTranscriptionPrompt(): string {
//   return `You are the 'Typed Document' transcription engine. Your goal is to transform handwritten notes into a perfectly legible, professional typed document using **Markdown** formatting.

// ## CRITICAL RULES:

// ### 1. Tables (MOST IMPORTANT)
// - If you see ANY handwritten table, grid, or columnar data, reproduce it as a proper Markdown table.
// - Use standard Markdown table syntax with pipes and dashes:
//   | Column 1 | Column 2 |
//   |----------|----------|
//   | data     | data     |

// ### 2. Headings & Structure
// - Use Markdown headings: # for main titles, ## for sections, ### for subsections.
// - Preserve the document's hierarchical structure.

// ### 3. Lists
// - Ordered lists: 1. 2. 3.
// - Unordered lists: - bullets
// - Preserve nesting with proper indentation.

// ### 4. Text Formatting
// - **bold** for emphasized/underlined words.
// - *italic* for lightly emphasized text.
// - Blank lines between paragraphs.

// ### 5. Math & Formulas
// - Inline: \`E = mc²\`
// - Block: code fence for complex equations.

// ### 6. Diagrams
// - > **[Diagram]**: brief description of the diagram.

// ### 7. Accuracy
// - Transcribe with 100% accuracy. Do NOT skip any content.
// - Choose the most likely professional word for ambiguous text.

// ### 8. Output
// - Output ONLY the final Markdown. No preamble, no commentary.
// - Do not wrap the output in a code block.`;
// }

// function fileToBase64(file: File): Promise<string> {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.readAsDataURL(file);
//     reader.onload = () => resolve((reader.result as string).split(",")[1]);
//     reader.onerror = error => reject(error);
//   });
// }






/**
 * mistral-ocr.ts  (kept as gemini.ts so no import paths need changing)
 *
 * Uses Mistral OCR 3 — a dedicated OCR API purpose-built for documents.
 *
 * WHY MISTRAL OCR IS BETTER FOR THIS APP:
 *  ✅ Dedicated /v1/ocr endpoint — NOT a general chat/vision model
 *  ✅ Sends the ENTIRE PDF in one API call (no per-page splitting needed)
 *  ✅ $2 per 1,000 pages — ~13x cheaper than GPT-4o
 *  ✅ 88.9% handwriting accuracy — best in class
 *  ✅ Outputs clean Markdown natively with table/heading structure preserved
 *  ✅ No rate limit nightmares — generous quota
 *
 * Get a free API key at: https://console.mistral.ai/api-keys
 */

// const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";
// const OCR_MODEL = "mistral-ocr-latest";

// const MAX_RECOMMENDED_SIZE = 50 * 1024 * 1024; // 50 MB

// // ─────────────────────────────────────────────
// //  API key
// // ─────────────────────────────────────────────
// function getApiKey(): string {
//   const customKey =
//     typeof window !== "undefined"
//       ? localStorage.getItem("TYPEDDOC_MISTRAL_API_KEY")
//       : null;

//   const envKey =
//     (typeof process !== "undefined" && (process as any).env?.MISTRAL_API_KEY) ||
//     (import.meta as any).env?.VITE_MISTRAL_API_KEY ||
//     null;

//   const apiKey = customKey || envKey;

//   if (!apiKey) {
//     throw new Error(
//       "NO_API_KEY: No Mistral API key found. Go to Settings and add your key from https://console.mistral.ai/api-keys"
//     );
//   }

//   return apiKey;
// }

// // ─────────────────────────────────────────────
// //  Retry / back-off
// // ─────────────────────────────────────────────
// const MAX_RETRIES = 4;
// const BASE_DELAY_MS = 5_000;
// const MAX_DELAY_MS = 60_000;

// function sleep(ms: number): Promise<void> {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }

// function isRateLimitError(status: number, body: any): boolean {
//   if (status === 429) return true;
//   const msg = (body?.message || body?.error?.message || '').toLowerCase();
//   return msg.includes('rate limit') || msg.includes('quota') || msg.includes('too many');
// }

// function getRetryDelay(headers: Headers, attempt: number): number {
//   const retryAfter = headers.get('retry-after');
//   if (retryAfter) {
//     const secs = parseInt(retryAfter, 10);
//     if (!isNaN(secs)) return Math.min(secs * 1000 + 500, MAX_DELAY_MS);
//   }
//   return Math.min(BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000, MAX_DELAY_MS);
// }

// // ─────────────────────────────────────────────
// //  Core OCR call — wraps Mistral's /v1/ocr endpoint
// // ─────────────────────────────────────────────
// async function callMistralOCR(
//   document: { type: string; [key: string]: any },
//   label: string,
//   onProgress?: (s: string) => void
// ): Promise<string> {
//   let lastError: any;

//   for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
//     const response = await fetch(MISTRAL_OCR_URL, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "Authorization": `Bearer ${getApiKey()}`,
//       },
//       body: JSON.stringify({
//         model: OCR_MODEL,
//         document,
//       }),
//     });

//     const body = await response.json();

//     if (response.ok) {
//       // Mistral OCR returns an array of pages, each with a `markdown` field
//       // We join them all together — no need to manually handle pages!
//       const pages: Array<{ markdown: string }> = body.pages ?? [];
//       return pages
//         .map((p, i) => `--- Page ${i + 1} ---\n\n${p.markdown}`)
//         .join("\n\n")
//         .trim();
//     }

//     const errMsg = body?.message || body?.error?.message || `HTTP ${response.status}`;

//     if (isRateLimitError(response.status, body) && attempt < MAX_RETRIES) {
//       const delay = getRetryDelay(response.headers, attempt);
//       const delaySec = (delay / 1000).toFixed(0);
//       console.warn(`[TypedDoc] Rate limited on "${label}" (attempt ${attempt + 1}). Waiting ${delaySec}s…`);
//       onProgress?.(`Rate limited. Waiting ${delaySec}s before retry ${attempt + 1}/${MAX_RETRIES}…`);
//       await sleep(delay);
//       continue;
//     }

//     if (response.status === 401) {
//       throw new Error("INVALID_API_KEY: Your Mistral API key is invalid or expired. Check Settings.");
//     }

//     if (response.status === 402 || errMsg.toLowerCase().includes('billing') || errMsg.toLowerCase().includes('quota')) {
//       throw new Error(`QUOTA: Mistral quota exceeded. Top up credits at https://console.mistral.ai — ${errMsg}`);
//     }

//     lastError = new Error(errMsg);
//     throw lastError;
//   }

//   throw lastError ?? new Error("Max retries exceeded");
// }

// // ─────────────────────────────────────────────
// //  Public API  (same signature — no other files need changing)
// // ─────────────────────────────────────────────
// export async function convertHandwritingToText(
//   file: File,
//   onProgress?: (status: string) => void
// ): Promise<string> {
//   if (file.size > MAX_RECOMMENDED_SIZE) {
//     console.warn(`[TypedDoc] File is ${(file.size / 1024 / 1024).toFixed(1)} MB — may be slow.`);
//   }

//   const isPdf = file.type === "application/pdf";
//   return isPdf
//     ? convertPdfWithMistralOCR(file, onProgress)
//     : convertImageWithMistralOCR(file, onProgress);
// }

// // ─────────────────────────────────────────────
// //  PDF — entire file in ONE API call 🎉
// //  Mistral OCR handles all pages server-side.
// //  No per-page splitting, no delays between pages.
// // ─────────────────────────────────────────────
// async function convertPdfWithMistralOCR(
//   file: File,
//   onProgress?: (status: string) => void
// ): Promise<string> {
//   onProgress?.('Reading PDF…');
//   const base64Data = await fileToBase64(file);

//   onProgress?.('Sending to Mistral OCR… (processing all pages at once)');

//   return callMistralOCR(
//     {
//       type: "document_url",
//       document_url: `data:application/pdf;base64,${base64Data}`,
//     },
//     file.name,
//     onProgress
//   );
// }

// // ─────────────────────────────────────────────
// //  Image (JPG / PNG / WEBP)
// // ─────────────────────────────────────────────
// async function convertImageWithMistralOCR(
//   file: File,
//   onProgress?: (status: string) => void
// ): Promise<string> {
//   onProgress?.('Reading image…');
//   const base64Data = await fileToBase64(file);

//   onProgress?.('Sending to Mistral OCR…');

//   return callMistralOCR(
//     {
//       type: "image_url",
//       image_url: `data:${file.type};base64,${base64Data}`,
//     },
//     file.name,
//     onProgress
//   );
// }

// // ─────────────────────────────────────────────
// //  Utility
// // ─────────────────────────────────────────────
// function fileToBase64(file: File): Promise<string> {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.readAsDataURL(file);
//     reader.onload = () => resolve((reader.result as string).split(",")[1]);
//     reader.onerror = error => reject(error);
//   });
// }








/**
 * mistral-ocr.ts  (kept as gemini.ts so no import paths need changing)
 * Uses Mistral OCR 3 + Mistral Chat to produce properly formatted Markdown
 * with real LaTeX math and smart bold/heading detection.
 */

const MISTRAL_OCR_URL  = "https://api.mistral.ai/v1/ocr";
const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";
const OCR_MODEL        = "mistral-ocr-latest";
const CHAT_MODEL       = "mistral-medium-latest";   // used for post-processing

const MAX_RECOMMENDED_SIZE = 50 * 1024 * 1024;

// ─────────────────────────────────────────────
//  API key
// ─────────────────────────────────────────────
function getApiKey(): string {
  const key =
    (typeof window !== "undefined" && localStorage.getItem("TYPEDDOC_MISTRAL_API_KEY")) ||
    (typeof process !== "undefined" && (process as any).env?.MISTRAL_API_KEY) ||
    (import.meta as any).env?.VITE_MISTRAL_API_KEY ||
    null;

  if (!key) throw new Error(
    "NO_API_KEY: No Mistral API key found. Go to Settings and add your key from https://console.mistral.ai/api-keys"
  );
  return key;
}

// ─────────────────────────────────────────────
//  Retry helpers
// ─────────────────────────────────────────────
const MAX_RETRIES   = 4;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS  = 60_000;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function isRateLimit(status: number, body: any) {
  if (status === 429) return true;
  const msg = (body?.message || body?.error?.message || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("quota") || msg.includes("too many");
}

function retryDelay(headers: Headers, attempt: number) {
  const ra = headers.get("retry-after");
  if (ra) { const s = parseInt(ra, 10); if (!isNaN(s)) return Math.min(s * 1000 + 500, MAX_DELAY_MS); }
  return Math.min(BASE_DELAY_MS * 2 ** attempt + Math.random() * 1000, MAX_DELAY_MS);
}

async function apiFetch(
  url: string, body: object,
  label: string, onProgress?: (s: string) => void
): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getApiKey()}` },
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
  document: { type: string; [k: string]: any },
  label: string,
  onProgress?: (s: string) => void
): Promise<string> {
  const data = await apiFetch(MISTRAL_OCR_URL, { model: OCR_MODEL, document }, label, onProgress);
  const pages: Array<{ markdown: string }> = data.pages ?? [];
  return pages.map((p, i) => `--- Page ${i + 1} ---\n\n${p.markdown}`).join("\n\n").trim();
}

// ─────────────────────────────────────────────
//  Step 2 — AI post-processing for math + bold + headings
//  Mistral OCR is great at raw text but needs a nudge to:
//   • wrap math in $...$ / $$...$$  (instead of plain text or code blocks)
//   • bold topic names / key terms
//   • promote underlined text to proper headings
// ─────────────────────────────────────────────
const POST_PROCESS_PROMPT = `You are a Markdown formatting expert. I will give you raw OCR output from a handwritten document.

Your job is to REFORMAT it — do NOT change the words, only improve the Markdown structure:

## 1. MATHEMATICS (MOST IMPORTANT)
- Every mathematical expression MUST be wrapped in LaTeX delimiters:
  - Inline math: $expression$ — e.g. $x^2 + y^2 = r^2$, $\\frac{a}{b}$, $\\alpha + \\beta$
  - Block/display math: $$\\n expression \\n$$ — for equations on their own line
- Convert ALL of these to proper LaTeX:
  - Plain text like "x^2" → $x^2$
  - Code blocks containing equations → $$ ... $$
  - Fractions written as "a/b" in context → $\\frac{a}{b}$
  - Greek letters written out → $\\alpha$, $\\beta$, $\\theta$, etc.
  - Square roots → $\\sqrt{x}$
  - Subscripts like "x_1" → $x_1$
  - Integrals, summations, limits → proper LaTeX
  - Chemical/physics formulas → $E = mc^2$
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
  rawMarkdown: string,
  onProgress?: (s: string) => void
): Promise<string> {
  onProgress?.("Formatting math, bold text, and headings…");

  // Split into chunks of ~6000 chars to stay within context limits
  // while preserving page boundaries
  const pages = rawMarkdown.split(/(?=--- Page \d+ ---)/);
  const CHUNK_SIZE = 3; // pages per chunk
  const processed: string[] = [];

  for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
    const chunk = pages.slice(i, i + CHUNK_SIZE).join("\n\n");
    const pageNums = `${i + 1}–${Math.min(i + CHUNK_SIZE, pages.length)}`;
    onProgress?.(`Formatting pages ${pageNums} of ${pages.length}…`);

    const data = await apiFetch(
      MISTRAL_CHAT_URL,
      {
        model: CHAT_MODEL,
        max_tokens: 4096,
        messages: [
          { role: "system", content: POST_PROCESS_PROMPT },
          { role: "user", content: chunk },
        ],
      },
      `post-process pages ${pageNums}`,
      onProgress
    );

    processed.push(data.choices?.[0]?.message?.content ?? chunk);

    // Small pause between chunks
    if (i + CHUNK_SIZE < pages.length) await sleep(1500);
  }

  return processed.join("\n\n").trim();
}

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────
export async function convertHandwritingToText(
  file: File,
  onProgress?: (status: string) => void
): Promise<string> {
  if (file.size > MAX_RECOMMENDED_SIZE)
    console.warn(`[TypedDoc] File is ${(file.size / 1024 / 1024).toFixed(1)} MB — may be slow.`);

  const isPdf = file.type === "application/pdf";

  // Step 1: OCR
  onProgress?.(isPdf ? "Sending PDF to Mistral OCR…" : "Sending image to Mistral OCR…");
  const rawMarkdown = isPdf
    ? await runOCR(
        { type: "document_url", document_url: `data:application/pdf;base64,${await toBase64(file)}` },
        file.name, onProgress
      )
    : await runOCR(
        { type: "image_url", image_url: `data:${file.type};base64,${await toBase64(file)}` },
        file.name, onProgress
      );

  // Step 2: Post-process for math + bold + headings
  const formatted = await postProcess(rawMarkdown, onProgress);

  onProgress?.("Done!");
  return formatted;
}

function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.readAsDataURL(file);
    r.onload  = () => res((r.result as string).split(",")[1]);
    r.onerror = rej;
  });
}