import { GoogleGenAI } from "@google/genai";
import { convertPdfToImages } from './pdf-parser';

function getAiClient(): GoogleGenAI {
  const customKey = typeof window !== "undefined" ? localStorage.getItem("TYPEDDOC_GEMINI_API_KEY") : null;
  const apiKey = customKey
    || (typeof process !== "undefined" && (process as any).env?.GEMINI_API_KEY)
    || (import.meta as any).env?.VITE_GEMINI_API_KEY
    || "AIzaSyCI_7VFzKKJdebu5TiK3rf_iTwT5Z4FGBE";

  return new GoogleGenAI({ apiKey });
}

// ── Retry configuration ──
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 3000;  // 3 seconds initial wait
const MAX_DELAY_MS = 60000;  // 1 minute max wait

/** Maximum recommended file size in bytes (10 MB) */
const MAX_RECOMMENDED_SIZE = 10 * 1024 * 1024;

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is a rate limit (429) or quota error.
 */
function isRateLimitError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  const status = err?.status || err?.httpStatus || 0;
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('resource exhausted') ||
    msg.includes('too many requests')
  );
}

/**
 * Wrapper that calls the Gemini API with automatic retry + exponential backoff
 * when rate-limited (429 / quota errors).
 */
async function callWithRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      if (!isRateLimitError(err) || attempt === MAX_RETRIES) {
        throw err;
      }

      // Exponential backoff: 3s → 6s → 12s → 24s (with jitter)
      const delay = Math.min(
        BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000,
        MAX_DELAY_MS
      );
      console.warn(
        `[TypedDoc] Rate limited on "${label}" (attempt ${attempt + 1}/${MAX_RETRIES + 1}). ` +
        `Retrying in ${(delay / 1000).toFixed(1)}s...`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

// ── Public API ──

export async function convertHandwritingToText(
  file: File,
  onProgress?: (status: string) => void
): Promise<string> {
  // Warn about very large files
  if (file.size > MAX_RECOMMENDED_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    console.warn(
      `[TypedDoc] File "${file.name}" is ${sizeMB} MB. ` +
      `Large files are more likely to hit API rate limits.`
    );
  }

  const isPdf = file.type === "application/pdf";

  if (isPdf) {
    return convertPdfHandwritingToText(file, onProgress);
  } else {
    return convertImageHandwritingToText(file, onProgress);
  }
}

async function convertImageHandwritingToText(
  file: File,
  onProgress?: (status: string) => void
): Promise<string> {
  onProgress?.('Reading file...');
  const base64Data = await fileToBase64(file);

  onProgress?.('Sending to Gemini AI...');
  const response = await callWithRetry(
    () => getAiClient().models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64Data,
              },
            },
            {
              text: getTranscriptionPrompt(),
            },
          ],
        },
      ],
    }),
    file.name
  );

  return response.text ?? "";
}

async function convertPdfHandwritingToText(
  file: File,
  onProgress?: (status: string) => void
): Promise<string> {
  const images = await convertPdfToImages(file, onProgress);
  const totalPages = images.length;
  
  if (totalPages === 0) {
    throw new Error("No pages could be extracted from the PDF.");
  }

  let finalMarkdown = "";
  const BATCH_SIZE = 5;
  const DELAY_MS = 6000; // 6 seconds pacing to guarantee < 15 RPM

  for (let i = 0; i < totalPages; i += BATCH_SIZE) {
    const end = Math.min(i + BATCH_SIZE, totalPages);
    onProgress?.(`Transcribing pages ${i + 1} to ${end} of ${totalPages}...`);
    
    const parts: any[] = [];
    let promptText = `${getTranscriptionPrompt()}\n\n`;
    
    for (let j = i; j < end; j++) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: images[j],
        },
      });
      promptText += `Image ${j - i + 1} is Page ${j + 1} of ${totalPages}.\n`;
    }
    
    promptText += `\nPlease transcribe ALL provided pages in order. Separate the transcription for each page with exactly "--- Page N ---" where N is the page number (e.g., "--- Page 1 ---"). Do not wrap the whole output in a single code block.`;
    
    parts.push({ text: promptText });

    const response = await callWithRetry(
      () => getAiClient().models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: parts }],
      }),
      `Pages ${i + 1}-${end}`
    );

    const batchText = response.text ?? "";
    finalMarkdown += `\n\n${batchText}`;

    if (end < totalPages) {
      onProgress?.(`Waiting 6s to prevent rate limits...`);
      await sleep(DELAY_MS); 
    }
  }

  return finalMarkdown.trim();
}

function getTranscriptionPrompt(): string {
  return `You are the 'Typed Document' transcription engine. Your goal is to transform handwritten notes into a perfectly legible, professional typed document using **Markdown** formatting.

## CRITICAL RULES:

### 1. Tables (MOST IMPORTANT)
- If you see ANY handwritten table, grid, or columnar data, you MUST reproduce it as a proper Markdown table.
- Use the standard Markdown table syntax with pipes and dashes:
  | Column 1 | Column 2 | Column 3 |
  |----------|----------|----------|
  | data     | data     | data     |
- Preserve all rows and columns exactly as written.
- If cells are merged or span multiple columns, represent them as best as possible.
- Even rough/sketchy tables with hand-drawn lines must be converted to Markdown tables.

### 2. Headings & Structure
- Use Markdown headings: # for main titles, ## for sections, ### for subsections.
- Preserve the document's hierarchical structure.

### 3. Lists
- Ordered lists: use 1. 2. 3. numbering.
- Unordered lists: use - bullet points.
- Preserve nested/indented lists with proper indentation.

### 4. Text Formatting
- Use **bold** for emphasized or underlined words.
- Use *italic* for lightly emphasized text.
- Preserve paragraph breaks with blank lines between paragraphs.

### 5. Math & Formulas
- Render mathematical formulas inline using backticks for simple expressions: \`E = mc²\`
- For complex equations, use a code block:
  \`\`\`
  f(x) = ax² + bx + c
  \`\`\`

### 6. Diagrams & Flowcharts
- If there is a hand-drawn diagram or flowchart, describe it in a blockquote:
  > **[Diagram]**: Flowchart showing Step A → Step B → Step C with a decision diamond at Step B.

### 7. Accuracy
- Transcribe with 100% accuracy.
- If words are ambiguous, choose the most likely professional word that fits the context.
- Do NOT skip any content. Transcribe everything visible.

### 8. Output
- Output ONLY the final Markdown text.
- No preamble, no commentary, no explanations.
- Do not wrap the entire output in a code block.`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(",")[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
}
