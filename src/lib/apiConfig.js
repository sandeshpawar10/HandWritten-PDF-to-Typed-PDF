/**
 * src/lib/apiConfig.js
 * Centralized API base URL and endpoint configuration.
 */

export const API_BASE = (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '')
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, '')
  : (import.meta.env.PROD ? "https://typeddoc.onrender.com" : "");

export const CHUNKED_OCR_URL = API_BASE ? `${API_BASE}/api/v1/ocr/chunked` : '/api/v1/ocr/chunked';
export const FORMATTED_OCR_URL = API_BASE ? `${API_BASE}/api/v1/ocr/formatted` : '/api/v1/ocr/formatted';
export const RENDER_PDF_URL = API_BASE ? `${API_BASE}/api/v1/render/pdf` : '/api/v1/render/pdf';
export const OCR_STATS_URL = API_BASE ? `${API_BASE}/api/v1/ocr/stats` : '/api/v1/ocr/stats';
