/**
 * geminiPool.js
 * Paced, self-healing Gemini client for page-by-page OCR.
 *
 * Design rules:
 *  1. PACE proactively (per-key RPM budget) instead of reacting to 429s.
 *  2. Slot reservation is synchronous -> no thundering herd when keys come back.
 *  3. 429  = key/quota problem  -> block THAT key for the exact time Google says.
 *     503  = model overload     -> back off with jitter, fall back to next model.
 *  4. Never silently accept a truncated page (finishReason / continuation / validation).
 *  5. Retry budget is a TIME deadline per page, not an attempt counter eaten by 429s.
 */

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const env = (name, def) => {
  const v = process.env[name];
  return v === undefined || v === '' ? def : v;
};
const num = (name, def) => {
  const n = Number(env(name, def));
  return Number.isFinite(n) ? n : def;
};

// Priority fallback list of active 3.x models
const CANDIDATE_MODELS = [
  env('GEMINI_MODEL', 'gemini-3.8-flash'),
  env('GEMINI_FALLBACK_MODEL', 'gemini-3.5-flash-lite'),
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite'
].filter((m, i, arr) => m && arr.indexOf(m) === i);

const RPM_PER_KEY = num('GEMINI_RPM_PER_KEY', 5); // Safe 5 RPM per key (~12s between calls per key)
const MAX_IN_FLIGHT = num('GEMINI_MAX_IN_FLIGHT_PER_KEY', 1);
const MAX_OUTPUT_TOKENS = num('GEMINI_MAX_OUTPUT_TOKENS', 8192);
const REQUEST_TIMEOUT_MS = num('GEMINI_REQUEST_TIMEOUT_MS', 180000);
const PAGE_DEADLINE_MS = num('GEMINI_PAGE_DEADLINE_MS', 15 * 60 * 1000);
const MAX_QUEUE_WAIT_MS = num('GEMINI_MAX_QUEUE_WAIT_MS', 10 * 60 * 1000);
const MAX_CONTINUATIONS = 4;

export class OcrError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new OcrError('Aborted', 'ABORTED'));
    const onAbort = () => {
      clearTimeout(t);
      reject(new OcrError('Aborted', 'ABORTED'));
    };
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

const timeoutSignal = (s) => {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.any && AbortSignal.timeout) {
    try {
      return s
        ? AbortSignal.any([s, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
        : AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    } catch {
      // Fall through to manual controller if AbortSignal.any throws
    }
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  if (s) {
    if (s.aborted) {
      clearTimeout(timer);
      ctrl.abort();
    } else {
      s.addEventListener('abort', () => {
        clearTimeout(timer);
        ctrl.abort();
      }, { once: true });
    }
  }
  return ctrl.signal;
};

function backoffMs(n) {
  const base = Math.min(60000, 2000 * 2 ** (n - 1)); // 2s,4s,8s,... cap 60s
  return base / 2 + Math.random() * (base / 2); // jitter
}

function msUntilPacificMidnight() {
  // Gemini daily quotas reset at midnight Pacific time
  const now = new Date();
  const la = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const next = new Date(la);
  next.setHours(24, 0, 0, 0);
  return Math.max(60000, next - la);
}

/** Read Retry-After / RetryInfo / QuotaFailure so we know HOW LONG and WHICH quota. */
function parseQuota(res, errJson) {
  let retrySec = null;
  let scope = 'minute';

  const hdr = parseInt(res.headers.get('retry-after'), 10);
  if (hdr > 0) retrySec = hdr;

  for (const d of errJson?.error?.details || []) {
    const type = d['@type'] || '';
    if (type.endsWith('RetryInfo') && d.retryDelay) {
      const s = parseFloat(d.retryDelay);
      if (s > 0) retrySec = s;
    }
    if (type.endsWith('QuotaFailure')) {
      for (const v of d.violations || []) {
        if (/PerDay/i.test(`${v.quotaId || ''} ${v.quotaMetric || ''}`)) scope = 'day';
      }
    }
  }
  const m = (errJson?.error?.message || '').match(/retry in ([\d.]+)s/i);
  if (retrySec == null && m) retrySec = parseFloat(m[1]);
  if (/per day|daily/i.test(errJson?.error?.message || '')) scope = 'day';

  return { retrySec: Math.ceil(retrySec ?? 30), scope };
}

class KeyPool {
  constructor(keys) {
    this.baseIntervalMs = Math.ceil(60000 / RPM_PER_KEY);
    this.intervalMs = this.baseIntervalMs;
    this.slots = keys.map((key, i) => ({
      key,
      id: i + 1,
      nextAt: 0,
      blockedUntil: 0,
      inFlight: 0,
      reason: ''
    }));
  }

  availableAt(s) {
    return Math.max(s.nextAt, s.blockedUntil);
  }

  /** Resolves with a key slot that is allowed to send a request right now. */
  async acquire(signal, onWait) {
    for (;;) {
      const now = Date.now();

      // Check if all keys are blocked beyond max wait time
      const allBlockedLong = this.slots.every((s) => s.blockedUntil - now > MAX_QUEUE_WAIT_MS);
      if (allBlockedLong) {
        return null; // Signals to caller that all keys are blocked long-term
      }

      let best = null;
      for (const s of this.slots) {
        if (s.inFlight >= MAX_IN_FLIGHT) continue;
        if (!best || this.availableAt(s) < this.availableAt(best)) best = s;
      }

      if (best && this.availableAt(best) <= now) {
        // Reserve synchronously: only ONE waiter can win this slot -> no stampede.
        best.inFlight++;
        best.nextAt = now + this.intervalMs;
        return best;
      }

      const wait = best ? this.availableAt(best) - now : 500;
      onWait?.(Math.ceil(wait / 1000));
      await sleep(Math.min(Math.max(wait, 250), 2000) + Math.random() * 250, signal);
    }
  }

  release(slot) {
    slot.inFlight = Math.max(0, slot.inFlight - 1);
  }

  block(slot, ms, reason) {
    slot.blockedUntil = Math.max(slot.blockedUntil, Date.now() + ms);
    slot.reason = reason;
  }

  resetAllBlocks() {
    this.intervalMs = this.baseIntervalMs;
    for (const s of this.slots) {
      s.blockedUntil = 0;
      s.reason = '';
    }
  }

  // Adaptive pacing: a 429 despite pacing means our RPM setting is too optimistic.
  slowDown() {
    this.intervalMs = Math.min(60000, this.intervalMs * 1.3);
  }
  reportSuccess() {
    this.intervalMs = Math.max(this.baseIntervalMs, this.intervalMs * 0.97);
  }
}

let pool = null;
let poolSig = '';
export function getPool(keys) {
  const sig = keys.join('|');
  if (!pool || sig !== poolSig) {
    pool = new KeyPool(keys);
    poolSig = sig;
  }
  return pool;
}

function buildGenConfig() {
  const g = { temperature: 0.1, maxOutputTokens: MAX_OUTPUT_TOKENS };
  const think = process.env.GEMINI_THINKING_BUDGET;
  if (think !== undefined && think !== '') g.thinkingConfig = { thinkingBudget: Number(think) };
  const mr = process.env.GEMINI_MEDIA_RESOLUTION;
  if (mr) g.mediaResolution = mr;
  return g;
}

/** Truncation and corruption detectors for LaTeX and diagrams. */
function checkCompleteness(text) {
  const problems = [];
  const fences = (text.match(/^```/gm) || []).length;
  if (fences % 2 !== 0) problems.push('unclosed code fence');
  const displayMath = (text.match(/\$\$/g) || []).length;
  if (displayMath % 2 !== 0) problems.push('unbalanced $$ display math block');
  if (text.trim().length < 15) problems.push('suspiciously short output');
  return problems;
}

function cleanMarkdown(raw) {
  let c = raw.trim();
  if (c.startsWith('```markdown') && c.endsWith('```')) c = c.slice(11, -3).trim();
  else if (c.startsWith('```md') && c.endsWith('```')) c = c.slice(5, -3).trim();
  return c;
}

/**
 * Transcribe ONE page/image. Resolves { text, warnings, model } or throws OcrError.
 */
export async function transcribePage({
  apiKeys,
  mimeType,
  base64Data,
  prompt,
  pageNum,
  onStatus,
  signal
}) {
  const keyPool = getPool(apiKeys);
  const deadline = Date.now() + PAGE_DEADLINE_MS;

  const baseContents = [
    {
      role: 'user',
      parts: [{ inline_data: { mime_type: mimeType, data: base64Data } }, { text: prompt }]
    }
  ];
  let contents = baseContents;
  let assembled = '';
  let modelIndex = 0;
  let model = CANDIDATE_MODELS[0];
  let transient = 0;
  let bad = 0;
  let continuations = 0;
  let invalid = 0;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new OcrError('Aborted', 'ABORTED');

    const slot = await keyPool.acquire(signal, (sec) =>
      onStatus?.(`Page ${pageNum}: waiting for an available API key slot (~${sec}s)...`)
    );

    // If all keys are blocked (e.g. daily quota exhausted), attempt model fallback
    if (!slot) {
      if (modelIndex < CANDIDATE_MODELS.length - 1) {
        modelIndex++;
        const prevModel = model;
        model = CANDIDATE_MODELS[modelIndex];
        keyPool.resetAllBlocks();
        console.warn(`[enginePool] All keys blocked on ${prevModel}. Switching page ${pageNum} to fallback model ${model}`);
        onStatus?.(`Daily limit reached on primary engine. Switching to backup engine...`);
        await sleep(1000, signal);
        continue;
      }
      throw new OcrError(
        'All API keys have exhausted their daily quota across all candidate models. Saved pages are preserved. Quota resets at midnight Pacific Time.',
        'QUOTA_EXHAUSTED'
      );
    }

    let res;
    let body;
    try {
      res = await fetch(`${API_URL}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': slot.key },
        body: JSON.stringify({ contents, generationConfig: buildGenConfig() }),
        signal: timeoutSignal(signal)
      });
      body = await res.json().catch(() => null);
    } catch (err) {
      keyPool.release(slot);
      if (signal?.aborted) throw new OcrError('Aborted', 'ABORTED');
      transient++;
      console.warn(`Network error (key #${slot.id}, page ${pageNum}): ${err.message}`);
      await sleep(backoffMs(transient), signal);
      continue;
    }
    keyPool.release(slot);

    if (!res.ok) {
      const detail = body?.error?.message || `HTTP ${res.status}`;

      if (res.status === 429) {
        const { retrySec, scope } = parseQuota(res, body);
        const ms = scope === 'day' ? msUntilPacificMidnight() : (retrySec + 1) * 1000;
        keyPool.block(slot, ms, `429/${scope}`);
        if (scope === 'minute') {
          keyPool.slowDown();
        }
        console.warn(
          `Key #${slot.id} 429 (${scope} quota) on ${model}: ${detail}. Blocked ${Math.round(ms / 1000)}s. ` +
            `Pacing now ${Math.round(keyPool.intervalMs / 1000)}s/request/key.`
        );

        // If this key hit daily quota and we have fallback models, check if all slots are blocked
        const now = Date.now();
        const allBlocked = keyPool.slots.every((s) => s.blockedUntil - now > 5000);
        if (allBlocked && modelIndex < CANDIDATE_MODELS.length - 1) {
          modelIndex++;
          const prevModel = model;
          model = CANDIDATE_MODELS[modelIndex];
          keyPool.resetAllBlocks();
          console.warn(`[enginePool] Switching to fallback model ${model} for page ${pageNum}`);
          onStatus?.(`Quota limit reached on primary engine. Switching to backup engine...`);
          await sleep(1000, signal);
        }
        continue;
      }

      if (res.status === 401 || res.status === 403) {
        keyPool.block(slot, 6 * 3600 * 1000, `auth ${res.status}`);
        console.error(`Key #${slot.id} rejected (${res.status}): ${detail}. Disabled for 6h.`);
        continue;
      }

      if ([500, 502, 503, 504].includes(res.status) || detail.toLowerCase().includes('high demand')) {
        transient++;
        if (modelIndex < CANDIDATE_MODELS.length - 1 && transient >= 3) {
          modelIndex++;
          console.warn(`Switching page ${pageNum} to fallback model ${CANDIDATE_MODELS[modelIndex]} due to server busy (${res.status})`);
          model = CANDIDATE_MODELS[modelIndex];
          keyPool.resetAllBlocks();
        }
        const wait = backoffMs(transient);
        onStatus?.(`Page ${pageNum}: high demand (${res.status}), retrying in ${Math.round(wait / 1000)}s...`);
        await sleep(wait, signal);
        continue;
      }

      throw new OcrError(`Transcription API error: ${detail}`, 'API_ERROR');
    }

    const cand = body?.candidates?.[0];
    const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
    const finish = cand?.finishReason;

    if (!text.trim()) {
      if (++bad > 3) {
        throw new OcrError(`Empty response from API (finishReason=${finish || 'none'})`, 'EMPTY');
      }
      await sleep(2000 * bad, signal);
      continue;
    }

    keyPool.reportSuccess();

    // SAFETY / RECITATION => output is blocked, retry
    if (finish && finish !== 'STOP' && finish !== 'MAX_TOKENS') {
      if (++bad > 3) throw new OcrError(`Blocked response (finishReason=${finish})`, 'BLOCKED');
      assembled = '';
      contents = baseContents;
      await sleep(2000 * bad, signal);
      continue;
    }

    assembled += text;

    // Output hit the token ceiling -> ask the model to continue instead of losing the tail!
    if (finish === 'MAX_TOKENS') {
      if (++continuations > MAX_CONTINUATIONS) {
        console.warn(`Page ${pageNum} hit max continuations limit, preserving assembled text.`);
        return { text: cleanMarkdown(assembled), warnings: ['max_continuations_reached'], model };
      }
      console.warn(`Page ${pageNum} hit MAX_TOKENS, requesting continuation #${continuations}...`);
      onStatus?.(`Page ${pageNum}: long page detected, fetching remaining math/content (part ${continuations + 1})...`);
      contents = [
        ...baseContents,
        { role: 'model', parts: [{ text: assembled }] },
        {
          role: 'user',
          parts: [
            {
              text:
                'Continue the transcription of this same page exactly from where you stopped. ' +
                'Do not repeat anything already written. Output only the remaining Markdown.'
            }
          ]
        }
      ];
      continue;
    }

    // Completeness validation: check for broken $$ math blocks or unclosed code fences
    const problems = checkCompleteness(assembled);
    if (problems.length && invalid < 1) {
      invalid++;
      console.warn(`Page ${pageNum} failed validation (${problems.join(', ')}); redoing once.`);
      assembled = '';
      contents = baseContents;
      continue;
    }

    return { text: cleanMarkdown(assembled), warnings: problems, model };
  }

  throw new OcrError(`Page ${pageNum} not completed within the deadline`, 'PAGE_DEADLINE');
}
