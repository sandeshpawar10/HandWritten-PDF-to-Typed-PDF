/**
 * gemini.js
 * Calls the backend /api/ocr endpoint which now uses Gemini natively.
 */

import { auth } from '../lib/firebase.js';

const API_BASE = "https://type-doc-backend.onrender.com";
const PROXY_OCR_URL  = `${API_BASE}/api/ocr`;

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
    if (res.status === 401) throw new Error("INVALID_API_KEY: API key invalid. Check backend Settings.");
    if (res.status === 402 || msg.includes("billing") || msg.includes("quota"))
      throw new Error(`QUOTA: ${msg}`);
    lastErr = new Error(msg);
    throw lastErr;
  }
  throw lastErr ?? new Error("Max retries exceeded");
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

  onProgress?.("Sending document to Gemini 2.5 Flash...");
  
  const payload = { 
    type: file.type === "application/pdf" ? "document_url" : "image_url",
    [file.type === "application/pdf" ? "document_url" : "image_url"]: `data:${file.type};base64,${await toBase64(file)}`
  };

  const data = await apiFetch(PROXY_OCR_URL, payload, file.name, onProgress);
  
  const pages = data.pages ?? [];
  let formatted = pages.map((p, i) => `--- Page ${i + 1} ---\n\n${p.markdown}`).join("\n\n").trim();

  // Strip conversational wrappers if any
  const match = formatted.match(/```(?:markdown)?\s*\n([\s\S]*?)\n```/i);
  if (match) {
    formatted = match[1].trim();
  } else {
    if (formatted.startsWith("```markdown") && formatted.endsWith("```")) formatted = formatted.slice(11, -3).trim();
    else if (formatted.startsWith("```") && formatted.endsWith("```")) formatted = formatted.slice(3, -3).trim();
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