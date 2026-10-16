/**
 * OCR Service - PaddleOCR Integration
 * Replaces Mistral AI with local PaddleOCR processing
 */

import { auth } from '../lib/firebase.js';

// API Configuration
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD
  ? "https://typeddoc.onrender.com"
  : "http://localhost:3001");
const PROXY_OCR_URL = `${API_BASE}/api/v1/ocr`;

// File size limits (OOM Prevention)
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const WARN_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILE_SIZE_MB = 20;

// Retry configuration
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 3000;
const MAX_DELAY_MS = 60000;
const REQUEST_TIMEOUT_MS = 300000; // 5 minutes (increased for PDF processing)

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isRateLimit(status, body) {
  if (status === 429) return true;
  const msg = (body?.message || body?.error?.message || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("quota") || msg.includes("too many");
}

function retryDelay(headers, attempt) {
  const ra = headers.get("retry-after");
  if (ra) {
    const s = parseInt(ra, 10);
    if (!isNaN(s)) return Math.min(s * 1000 + 500, MAX_DELAY_MS);
  }
  return Math.min(BASE_DELAY_MS * 2 ** attempt + Math.random() * 1000, MAX_DELAY_MS);
}

async function apiFetch(url, body, onProgress) {
  let lastErr;

  // Get Firebase ID token
  if (!auth.currentUser) {
    throw new Error("Must be logged in to process documents.");
  }

  const token = await auth.currentUser.getIdToken();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok) return data;

      // Extract error message from response
      const errorMsg = data?.error || data?.message || `HTTP ${res.status}`;
      const errorType = data?.type || 'UNKNOWN';

      if (isRateLimit(res.status, data) && attempt < MAX_RETRIES) {
        const d = retryDelay(res.headers, attempt);
        onProgress?.(`Rate limited – waiting ${(d/1000).toFixed(0)}s… (retry ${attempt+1}/${MAX_RETRIES})`);
        await sleep(d);
        continue;
      }

      // Handle specific error types
      if (res.status === 429) {
        throw new Error(`Rate limit exceeded. Please wait a few minutes and try again.`);
      }
      if (res.status === 401) {
        throw new Error("Authentication failed. Please sign in again.");
      }
      if (res.status === 413) {
        throw new Error("File too large for server. Please reduce file size or split into smaller documents.");
      }
      if (res.status === 503 || errorType === 'SPAWN_ERROR') {
        throw new Error("OCR service is temporarily unavailable. The server may be starting up or under maintenance. Please try again in a few moments.");
      }
      if (res.status === 504 || errorType === 'TIMEOUT') {
        throw new Error("Processing took too long. Please try a smaller or simpler document.");
      }
      if (res.status === 500) {
        // Provide helpful messages for common server errors
        if (errorMsg.includes('Python') || errorMsg.includes('dependencies')) {
          throw new Error("Server configuration error. Please contact support.");
        }
        if (errorMsg.includes('memory') || errorMsg.includes('Memory')) {
          throw new Error("Server ran out of memory. Please try a smaller document or contact support.");
        }
        throw new Error(`Server error: ${errorMsg}`);
      }

      lastErr = new Error(errorMsg);
      throw lastErr;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error("Request timed out. The file may be too large or the server is busy. Please try again.");
      }

      throw error;
    }
  }

  throw lastErr ?? new Error("Max retries exceeded");
}

/**
 * Convert handwritten document to text using PaddleOCR
 */
export async function convertHandwritingToText(file, onProgress) {
  // File size validation
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds maximum limit of ${MAX_FILE_SIZE_MB} MB. ` +
      `Please split large documents into smaller files (10-15 pages each).`
    );
  }

  if (file.size > WARN_FILE_SIZE) {
    onProgress?.(
      `Processing large file (${(file.size / 1024 / 1024).toFixed(1)} MB). This may take several minutes.`
    );
  }

  const isPdf = file.type === "application/pdf";

  // Run OCR
  onProgress?.(isPdf ? "Processing PDF with OCR…" : "Processing image with OCR…");

  const base64 = await toBase64(file);
  const documentUrl = isPdf
    ? `data:application/pdf;base64,${base64}`
    : `data:${file.type};base64,${base64}`;

  const data = await apiFetch(
    PROXY_OCR_URL,
    {
      document: {
        type: isPdf ? "document_url" : "image_url",
        [isPdf ? "document_url" : "image_url"]: documentUrl
      }
    },
    onProgress
  );

  const pages = data.pages ?? [];

  // Extract text and format as markdown
  const markdown = pages.map((p, i) => {
    const text = p.text || p.markdown || "No text detected";
    return `--- Page ${i + 1} ---\n\n${text}`;
  }).join("\n\n").trim();

  if (!markdown || markdown.trim().length === 0) {
    throw new Error("No text could be extracted from the document. Please ensure the image is clear and contains readable text.");
  }

  onProgress?.("Processing complete!");
  return markdown;
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.readAsDataURL(file);
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
  });
}
