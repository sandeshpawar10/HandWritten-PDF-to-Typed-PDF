/**
 * server/services/geminiPool.js
 * Paced, quota-aware multi-key and multi-model scheduler for Gemini OCR.
 *
 * Capabilities:
 *  1. Supports named keys (GEMINI_KEY_01...) and comma-separated GEMINI_API_KEY.
 *  2. Unblocks full 6-key concurrency: 1 in-flight request per key, dynamically acquired.
 *  3. Independent health/quota state per (key, model) pair.
 *  4. Never wipes out all key blocks on model switch.
 *  5. Configurable model tiers: PRIMARY, FAST, VERIFY, FALLBACK.
 *  6. Telemetry tracking per-key dispatch, 429s, latency, and success rates.
 *  7. Masked key logging for security.
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

// Configurable model tiers
export const MODEL_TIERS = {
  primary: env('GEMINI_MODEL_PRIMARY', env('GEMINI_MODEL', 'gemini-3.8-flash')),
  fast: env('GEMINI_MODEL_FAST', 'gemini-3.5-flash'),
  verify: env('GEMINI_MODEL_VERIFY', env('GEMINI_MODEL', 'gemini-3.8-flash')),
  fallback: env('GEMINI_MODEL_FALLBACK', 'gemini-3.5-flash-lite')
};

// Priority fallback candidate list
const CANDIDATE_MODELS = [
  MODEL_TIERS.primary,
  MODEL_TIERS.fast,
  MODEL_TIERS.fallback,
  'gemini-3.1-flash-lite'
].filter((m, i, arr) => m && arr.indexOf(m) === i);

const RPM_PER_KEY = num('GEMINI_RPM_PER_KEY', 5); // Safe 5 RPM per key (~12s spacing)
const MAX_IN_FLIGHT_PER_KEY = num('GEMINI_MAX_IN_FLIGHT_PER_KEY', 1);
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

/** Helper to mask sensitive keys in logs (shows only last 4 chars) */
export function maskKey(key) {
  if (!key || typeof key !== 'string') return '****';
  return `***${key.slice(-4)}`;
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
      // fallback
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
  const base = Math.min(60000, 2000 * 2 ** (n - 1));
  return base / 2 + Math.random() * (base / 2);
}

function msUntilPacificMidnight() {
  const now = new Date();
  const la = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const next = new Date(la);
  next.setHours(24, 0, 0, 0);
  return Math.max(60000, next - la);
}

/** Parse Retry-After / RetryInfo / QuotaFailure from response */
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

/**
 * KeyPool manages pacing and quota states per (key, model) pair.
 */
class KeyPool {
  constructor(keys) {
    this.baseIntervalMs = Math.ceil(60000 / RPM_PER_KEY);
    this.intervalMs = this.baseIntervalMs;
    this.slots = keys.map((key, i) => ({
      key,
      id: i + 1,
      masked: maskKey(key),
      nextAt: 0,
      inFlight: 0,
      // Map of modelId -> { blockedUntil: number, reason: string }
      modelBlocks: new Map(),
      // Telemetry
      stats: {
        dispatched: 0,
        succeeded: 0,
        rateLimited429: 0,
        totalLatencyMs: 0
      }
    }));
  }

  isKeyBlockedForModel(slot, model, now) {
    const block = slot.modelBlocks.get(model);
    return Boolean(block && block.blockedUntil > now);
  }

  availableAtForModel(slot, model) {
    const block = slot.modelBlocks.get(model);
    const blockedUntil = block ? block.blockedUntil : 0;
    return Math.max(slot.nextAt, blockedUntil);
  }

  /**
   * Acquire a slot for a given model tier.
   */
  async acquire(model, signal, onWait) {
    for (;;) {
      if (signal?.aborted) throw new OcrError('Aborted', 'ABORTED');
      const now = Date.now();

      // Check if all slots are blocked long-term on this model
      const allBlockedLong = this.slots.every((s) => {
        const block = s.modelBlocks.get(model);
        return block && block.blockedUntil - now > MAX_QUEUE_WAIT_MS;
      });
      if (allBlockedLong) {
        return null; // Signals need to fall back to next model tier
      }

      let best = null;
      for (const s of this.slots) {
        if (s.inFlight >= MAX_IN_FLIGHT_PER_KEY) continue;
        if (!best || this.availableAtForModel(s, model) < this.availableAtForModel(best, model)) {
          best = s;
        }
      }

      if (best && this.availableAtForModel(best, model) <= now) {
        best.inFlight++;
        best.nextAt = now + this.intervalMs;
        best.stats.dispatched++;
        return best;
      }

      const wait = best ? this.availableAtForModel(best, model) - now : 500;
      onWait?.(Math.ceil(wait / 1000));
      await sleep(Math.min(Math.max(wait, 250), 2000) + Math.random() * 250, signal);
    }
  }

  release(slot, latencyMs = 0, success = true) {
    slot.inFlight = Math.max(0, slot.inFlight - 1);
    if (latencyMs > 0) {
      slot.stats.totalLatencyMs += latencyMs;
    }
    if (success) {
      slot.stats.succeeded++;
      this.intervalMs = Math.max(this.baseIntervalMs, this.intervalMs * 0.97);
    }
  }

  block(slot, model, ms, reason) {
    slot.stats.rateLimited429++;
    slot.modelBlocks.set(model, {
      blockedUntil: Math.max(slot.modelBlocks.get(model)?.blockedUntil || 0, Date.now() + ms),
      reason
    });
  }

  slowDown() {
    this.intervalMs = Math.min(60000, this.intervalMs * 1.3);
  }

  getTelemetry() {
    return this.slots.map(s => ({
      slotId: s.id,
      maskedKey: s.masked,
      inFlight: s.inFlight,
      dispatched: s.stats.dispatched,
      succeeded: s.stats.succeeded,
      rateLimited429: s.stats.rateLimited429,
      avgLatencyMs: s.stats.dispatched > 0
        ? Math.round(s.stats.totalLatencyMs / Math.max(1, s.stats.succeeded))
        : 0
    }));
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

export function getPoolTelemetry() {
  return pool ? pool.getTelemetry() : [];
}

function buildGenConfig() {
  const g = { temperature: 0.1, maxOutputTokens: MAX_OUTPUT_TOKENS };
  const think = process.env.GEMINI_THINKING_BUDGET;
  if (think !== undefined && think !== '') g.thinkingConfig = { thinkingBudget: Number(think) };
  const mr = process.env.GEMINI_MEDIA_RESOLUTION;
  if (mr) g.mediaResolution = mr;
  return g;
}

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

    const slot = await keyPool.acquire(model, signal, (sec) =>
      onStatus?.(`Page ${pageNum}: waiting for an available API key slot (~${sec}s)...`)
    );

    // If all keys blocked on this model, move to next model tier WITHOUT wiping other blocks!
    if (!slot) {
      if (modelIndex < CANDIDATE_MODELS.length - 1) {
        modelIndex++;
        const prevModel = model;
        model = CANDIDATE_MODELS[modelIndex];
        console.warn(`[enginePool] Keys blocked on ${prevModel}. Switching page ${pageNum} to model tier: ${model}`);
        onStatus?.(`Primary engine busy. Routing to next model tier (${model})...`);
        await sleep(1000, signal);
        continue;
      }
      throw new OcrError(
        'All API keys have exhausted quota across all candidate models. Saved pages are preserved.',
        'QUOTA_EXHAUSTED'
      );
    }

    let res;
    let body;
    const reqStart = Date.now();

    try {
      res = await fetch(`${API_URL}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': slot.key },
        body: JSON.stringify({ contents, generationConfig: buildGenConfig() }),
        signal: timeoutSignal(signal)
      });
      body = await res.json().catch(() => null);
    } catch (err) {
      keyPool.release(slot, Date.now() - reqStart, false);
      if (signal?.aborted) throw new OcrError('Aborted', 'ABORTED');
      transient++;
      console.warn(`Network error (key #${slot.id} [${slot.masked}], page ${pageNum}): ${err.message}`);
      await sleep(backoffMs(transient), signal);
      continue;
    }

    const latencyMs = Date.now() - reqStart;

    if (!res.ok) {
      const detail = body?.error?.message || `HTTP ${res.status}`;

      if (res.status === 429) {
        const { retrySec, scope } = parseQuota(res, body);
        const ms = scope === 'day' ? msUntilPacificMidnight() : (retrySec + 1) * 1000;
        // Block THIS key for THIS model only
        keyPool.block(slot, model, ms, `429/${scope}`);
        keyPool.release(slot, latencyMs, false);

        if (scope === 'minute') {
          keyPool.slowDown();
        }
        console.warn(
          `Key #${slot.id} [${slot.masked}] 429 (${scope}) on ${model}: ${detail}. Blocked ${Math.round(ms / 1000)}s.`
        );

        // Check if all slots are blocked on current model
        const now = Date.now();
        const allBlocked = keyPool.slots.every((s) => keyPool.isKeyBlockedForModel(s, model, now));
        if (allBlocked && modelIndex < CANDIDATE_MODELS.length - 1) {
          modelIndex++;
          model = CANDIDATE_MODELS[modelIndex];
          console.warn(`[enginePool] Switching page ${pageNum} to model tier: ${model}`);
          onStatus?.(`Engine quota reached. Switching to ${model}...`);
          await sleep(1000, signal);
        }
        continue;
      }

      keyPool.release(slot, latencyMs, false);

      if (res.status === 401 || res.status === 403) {
        keyPool.block(slot, model, 6 * 3600 * 1000, `auth ${res.status}`);
        console.error(`Key #${slot.id} [${slot.masked}] auth failure (${res.status}): ${detail}.`);
        continue;
      }

      if ([500, 502, 503, 504].includes(res.status) || detail.toLowerCase().includes('high demand')) {
        transient++;
        const isHighDemand = res.status === 503 || detail.toLowerCase().includes('high demand');
        if (modelIndex < CANDIDATE_MODELS.length - 1 && (isHighDemand || transient >= 2)) {
          modelIndex++;
          const prevModel = model;
          model = CANDIDATE_MODELS[modelIndex];
          console.warn(`[enginePool] Page ${pageNum}: fast failover from ${prevModel} to ${model} due to upstream ${res.status}`);
          onStatus?.(`Page ${pageNum}: primary model busy (${res.status}), switching to ${model}...`);
          await sleep(500, signal);
          continue;
        }
        const wait = backoffMs(transient);
        onStatus?.(`Page ${pageNum}: service busy (${res.status}), retrying in ${Math.round(wait / 1000)}s...`);
        await sleep(wait, signal);
        continue;
      }

      throw new OcrError(`Transcription API error: ${detail}`, 'API_ERROR');
    }

    keyPool.release(slot, latencyMs, true);

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

    if (finish && finish !== 'STOP' && finish !== 'MAX_TOKENS') {
      if (++bad > 3) throw new OcrError(`Blocked response (finishReason=${finish})`, 'BLOCKED');
      assembled = '';
      contents = baseContents;
      await sleep(2000 * bad, signal);
      continue;
    }

    assembled += text;

    if (finish === 'MAX_TOKENS') {
      if (++continuations > MAX_CONTINUATIONS) {
        console.warn(`Page ${pageNum} reached continuation limit.`);
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

  throw new OcrError(`Page ${pageNum} not completed within deadline`, 'PAGE_DEADLINE');
}
