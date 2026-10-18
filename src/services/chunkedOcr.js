/**
 * Chunked OCR Service - Handles unlimited pages with progress tracking
 * Falls back to client-side Tesseract.js OCR if server is unavailable
 */

import { auth } from '../lib/firebase.js';
import { clientSideOcr } from './clientOcr.js';

// API Configuration
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD
  ? "https://typeddoc.onrender.com"
  : "http://localhost:3001");
const CHUNKED_OCR_URL = `${API_BASE}/api/v1/ocr/chunked`;

// File size limits
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (increased for large PDFs)
const WARN_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Inactivity timeout: If no heartbeat or progress is received for 3 minutes,
// consider connection stalled. Heartbeats are sent every 15s from server.
const INACTIVITY_TIMEOUT_MS = 180000; // 3 minutes
// Maximum safety cap for very large multi-page jobs
const MAX_OVERALL_TIMEOUT_MS = 45 * 60 * 1000; // 45 minutes

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Convert document to formatted PDF with chunked processing
 * Supports unlimited pages (tested up to 200 pages)
 * @param {File} file - Image or PDF file
 * @param {Function} onProgress - Progress callback (current, total, percent, message)
 * @returns {Object} { text, formattedPdf, formattedDocx, totalPages, pagesProcessed }
 */
export async function convertToFormattedDocumentChunked(file, onProgress, externalSignal) {
  // File size validation
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds maximum limit of 25 MB. ` +
      `Please split very large documents into smaller files.`
    );
  }

  if (file.size > WARN_FILE_SIZE) {
    onProgress?.({
      current: 0,
      total: 0,
      percent: 0,
      message: `Processing large file (${(file.size / 1024 / 1024).toFixed(1)} MB). This may take 5-10 minutes.`
    });
  }

  const isPdf = file.type === "application/pdf";

  onProgress?.({
    current: 0,
    total: 0,
    percent: 0,
    message: isPdf ? "Starting PDF processing..." : "Starting image processing..."
  });

  const base64 = await toBase64(file);
  const documentUrl = isPdf
    ? `data:application/pdf;base64,${base64}`
    : `data:${file.type};base64,${base64}`;

  // Get Firebase ID token
  if (!auth.currentUser) {
    throw new Error("Must be logged in to process documents.");
  }

  const token = await auth.currentUser.getIdToken();

  // Track cancellation source
  let isCancelledByUser = false;
  if (externalSignal) {
    if (externalSignal.aborted) {
      throw new Error("Conversion cancelled by user.");
    }
    externalSignal.addEventListener('abort', () => {
      isCancelledByUser = true;
    }, { once: true });
  }

  let lastProgress = { current: 0, total: 0, percent: 0, message: '' };
  const wrappedOnProgress = (p) => {
    lastProgress = { ...lastProgress, ...p };
    onProgress?.(p);
  };

  const MAX_RECONNECTS = 3;
  let finalResult = null;

  for (let attempt = 0; attempt <= MAX_RECONNECTS; attempt++) {
    if (isCancelledByUser || externalSignal?.aborted) {
      throw new Error("Conversion cancelled by user.");
    }

    if (attempt > 0) {
      wrappedOnProgress({
        ...lastProgress,
        message: `Connection refreshed. Resuming from saved pages (attempt ${attempt}/${MAX_RECONNECTS})...`
      });
      await sleep(2000 * attempt);
    }

    const token = await auth.currentUser.getIdToken();
    const controller = new AbortController();

    let isTimedOutDueToInactivity = false;
    let inactivityTimer = setTimeout(() => {
      isTimedOutDueToInactivity = true;
      controller.abort();
    }, INACTIVITY_TIMEOUT_MS);

    function pokeActivity() {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        isTimedOutDueToInactivity = true;
        controller.abort();
      }, INACTIVITY_TIMEOUT_MS);
    }

    const onExternalAbort = () => {
      isCancelledByUser = true;
      clearTimeout(inactivityTimer);
      controller.abort();
    };
    if (externalSignal) {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const res = await fetch(CHUNKED_OCR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          document: {
            type: isPdf ? "document_url" : "image_url",
            [isPdf ? "document_url" : "image_url"]: documentUrl
          }
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        clearTimeout(inactivityTimer);
        let errorMsg = `HTTP ${res.status}`;
        try {
          const text = await res.text();
          try {
            const json = JSON.parse(text);
            errorMsg = json.error || json.message || errorMsg;
          } catch {
            if (text && text.trim().length > 0 && text.length < 300) {
              errorMsg = text.trim();
            }
          }
        } catch {
          // ignore read error
        }

        if ([502, 503, 504].includes(res.status) && attempt < MAX_RECONNECTS) {
          console.warn(`Server busy (${res.status}), resuming...`);
          continue;
        }
        throw new Error(errorMsg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Reset inactivity timer on receipt of ANY data chunk or heartbeat
        pokeActivity();

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          // Skip SSE comments (heartbeats)
          if (line.startsWith(':')) continue;
          if (line.startsWith('data: ')) {
            let event = null;
            try {
              event = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            if (event.type === 'progress') {
              wrappedOnProgress({
                current: event.current_page ?? event.current ?? 0,
                total: event.total_pages ?? event.total ?? 0,
                percent: event.percent ?? Math.round(((event.current_page || 0) / (event.total_pages || 1)) * 100),
                message: event.message || `Processing page ${event.current_page || 0} of ${event.total_pages || 0}...`
              });
            } else if (event.type === 'result') {
              finalResult = event;
            } else if (event.type === 'error') {
              throw new Error(event.error || 'OCR processing failed');
            }
          }
        }
      }

      clearTimeout(inactivityTimer);

      // Process any remaining data in the buffer
      const remainingLines = buffer.split('\n');
      for (const line of remainingLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith(':')) continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const event = JSON.parse(trimmed.slice(6));
            if (event.type === 'result') {
              finalResult = event;
            } else if (event.type === 'error') {
              throw new Error(event.error || 'OCR processing failed');
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }

      if (finalResult) {
        break; // Successfully completed!
      }

      // Stream finished without finalResult (e.g. proxy severed connection at 15m)
      if (attempt < MAX_RECONNECTS) {
        console.warn(`Stream closed before final result; resuming from cache (attempt ${attempt + 1}/${MAX_RECONNECTS})...`);
        continue;
      }

      throw new Error('Connection interrupted. Click Retry to resume from saved pages.');

    } catch (error) {
      clearTimeout(inactivityTimer);

      if (isCancelledByUser || externalSignal?.aborted) {
        throw new Error("Conversion cancelled by user.");
      }

      if (isTimedOutDueToInactivity && attempt < MAX_RECONNECTS) {
        console.warn('Inactivity timeout hit; reconnecting to resume...');
        continue;
      }

      // Check if transient network error
      const isNetworkError = error.name === 'TypeError' || error.message?.toLowerCase().includes('network') || error.message?.toLowerCase().includes('fetch');
      if (isNetworkError && attempt < MAX_RECONNECTS) {
        console.warn('Network error encountered; reconnecting to resume...', error.message);
        continue;
      }

      throw error;
    } finally {
      clearTimeout(inactivityTimer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  if (!finalResult) {
    throw new Error('Connection interrupted. Click Retry to resume from saved pages.');
  }

  if (!finalResult.text || finalResult.text.trim().length === 0) {
    throw new Error("No text could be extracted from the document.");
  }

  // Final progress update
  onProgress?.({
    current: finalResult.pages_processed || finalResult.total_pages || 0,
    total: finalResult.total_pages || 0,
    percent: 100,
    message: "Processing complete!"
  });

  return {
    text: finalResult.text,
    formattedPdf: finalResult.formatted_pdf || finalResult.formattedPdf,
    formattedDocx: finalResult.formatted_docx || finalResult.formattedDocx,
    totalPages: finalResult.total_pages || finalResult.totalPages,
    pagesProcessed: finalResult.pages_processed || finalResult.pagesProcessed
  };
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.readAsDataURL(file);
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
  });
}

/**
 * Download base64 file
 */
export function downloadBase64File(base64Data, filename, mimeType) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Errors that should trigger client-side fallback
 * (server unavailable, OOM, timeout — not auth or validation errors)
 */
function shouldFallbackToClient(error) {
  const msg = (error?.message || '').toLowerCase();
  return (
    msg.includes('no result received') ||
    msg.includes('out of memory') ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('unavailable') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('oom') ||
    msg.includes('aborted') ||
    error?.name === 'AbortError' ||
    error?.name === 'TypeError' // fetch network errors
  );
}

/**
 * Convert document with automatic fallback to client-side OCR
 * Tries server-side chunked OCR first. If it fails due to server issues
 * (OOM, timeout, crash), automatically falls back to Tesseract.js in the browser.
 *
 * @param {File} file - Image or PDF file
 * @param {Function} onProgress - Progress callback
 * @returns {Object} { text, formattedPdf, formattedDocx, totalPages, pagesProcessed, clientSide? }
 */
export async function convertWithFallback(file, onProgress, externalSignal) {
  // Always use high-precision server-side OCR with persistent resume
  return await convertToFormattedDocumentChunked(file, onProgress, externalSignal);
}

