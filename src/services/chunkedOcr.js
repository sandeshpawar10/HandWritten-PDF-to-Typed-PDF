/**
 * Chunked OCR Service - Handles unlimited pages with progress tracking
 */

import { auth } from '../lib/firebase.js';

// API Configuration
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD
  ? "https://typeddoc.onrender.com"
  : "http://localhost:3001");
const CHUNKED_OCR_URL = `${API_BASE}/api/v1/ocr/chunked`;

// File size limits
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (increased for large PDFs)
const WARN_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Timeouts
const REQUEST_TIMEOUT_MS = 600000; // 10 minutes

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
export async function convertToFormattedDocumentChunked(file, onProgress) {
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
    message: isPdf ? "Starting PDF processing with chunked OCR..." : "Starting image processing..."
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

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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

    clearTimeout(timeoutId);

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data?.error || data?.message || `HTTP ${res.status}`;
      throw new Error(errorMsg);
    }

    if (!data.text || data.text.trim().length === 0) {
      throw new Error("No text could be extracted from the document.");
    }

    // Final progress update
    onProgress?.({
      current: data.pages_processed || data.total_pages,
      total: data.total_pages,
      percent: 100,
      message: "Processing complete!"
    });

    return {
      text: data.text,
      formattedPdf: data.formatted_pdf,
      formattedDocx: data.formatted_docx,
      totalPages: data.total_pages,
      pagesProcessed: data.pages_processed
    };

  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error("Request timed out after 10 minutes. Please try a smaller file or split your document.");
    }

    throw error;
  }
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
