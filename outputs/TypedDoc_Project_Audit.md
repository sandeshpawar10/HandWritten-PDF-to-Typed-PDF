# TypedDoc Project Audit and Improvement Plan

**Audit scope:** frontend, backend, OCR pipeline, API-key/model pool, PDF/DOCX formatting, persistence, security, UI, deployment, and validation.

**Audit date:** 2026-10-18

## Executive summary

The project has a good foundation: React/Vite frontend, Firebase authentication and persistence, Express backend, SSE progress streaming, page-level caching, retry logic, Markdown/KaTeX rendering, and DOCX export. The production frontend build succeeds.

However, the current implementation does not yet deliver the promised “formatted PDF” pipeline or a defensible “zero-loss accuracy” guarantee. The main blockers are:

1. `formatted_pdf` is always returned as `null`; the backend only creates DOCX. The PDF viewer/download path is therefore dead for server results.
2. The six-key pool is globally constrained by a default of two page workers, so it cannot efficiently use six keys.
3. The four-model fallback strategy is reactive and page-local rather than quota-aware, capability-aware, and key/model aware.
4. The server receives the entire PDF as base64 JSON, then reloads it and serializes every page into a new single-page PDF. This creates avoidable memory, CPU, payload, and latency costs.
5. Accuracy validation only checks Markdown syntax such as balanced fences and `$$`; it does not compare OCR output against the source image or independently verify math, tables, diagrams, or omitted regions.
6. The browser fallback is implemented but never invoked: `convertWithFallback()` simply calls the server path, while `clientSideOcr` and `shouldFallbackToClient` are unused.
7. The repository has no real automated tests. `npm test` exits successfully with “Tests to be implemented”.
8. The README is materially stale: it describes Mistral while the implementation uses Gemini, and it documents settings and limits that do not match the code.

A realistic goal is not “100% guaranteed accuracy” because handwriting, blur, occlusion, and ambiguous symbols make that impossible to guarantee with any model. The correct product goal is **measured, auditable, high-confidence transcription with zero silent omissions**: detect uncertainty, preserve the source, verify important regions, and require user confirmation for low-confidence output.

## Validation performed

- `npm.cmd run build`: **passes**. Vite transforms 2,131 modules and emits a warning that the main JS chunk is about 1.6 MB minified / 450 KB gzip.
- `npm.cmd run lint`: **0 errors, 159 warnings**. Warnings include many unused imports, missing React prop validation, unused fallback code, and unused variables.
- `npm test`: configured as a placeholder and does not run tests.
- Repository status/history could not be inspected because Git rejected the checkout as a dubious-ownership directory. No repository changes were made by this audit.

## Critical issues and fixes

### 1. Server formatted PDF output is not implemented

`server/services/geminiOcrService.js` returns `formatted_pdf: null` for both PDF and image branches. `src/components/FormattedDocumentViewer.jsx` expects a base64 PDF and the upload UI offers a formatted PDF download, but the server cannot provide it.

**Fix:** choose one authoritative document-rendering path:

- Best quality: create a structured document AST from OCR, then render the AST with a server-side PDF engine such as Playwright/Chromium, Typst, or a robust PDF layout library.
- Minimum viable fix: use the same sanitized Markdown/HTML renderer for preview and PDF generation, with explicit page styles, page breaks, fonts, math rendering, table splitting, and diagram handling.
- Return a `renderedPdf` artifact with a content hash, MIME type, byte length, and generation version. Prefer an object-storage URL or short-lived signed URL over embedding a large base64 PDF in JSON.

Do not generate a PDF from plain OCR text alone if layout preservation is a product requirement. Keep block types, positions, reading order, tables, equations, diagrams, handwriting regions, and confidence metadata.

### 2. The six API keys are under-utilized

`geminiOcrService.js` defaults `OCR_CONCURRENCY` to `2` even when four or more keys exist. With six keys, at most two pages are actively dispatched by the document worker pool. The pool can select different keys, but there are only two callers feeding it.

**Fix:** separate three concepts:

- `globalConcurrency`: maximum pages in flight for the server instance.
- `perKeyConcurrency`: maximum concurrent requests for one key.
- `perKeyRate`: requests/minute and token/minute budgets for one key.

Start with `globalConcurrency = min(6, available healthy key slots, memory-safe limit)` and benchmark. Do not simply set it to 6 without measuring memory and provider limits. For a 512 MB container, use a bounded queue and a memory semaphore. A good first configuration is six keys, one request per key, with an aggregate cap of 4–6 concurrent pages, then increase only after load testing.

The current pool’s `MAX_IN_FLIGHT_PER_KEY = 1` is sensible for quota safety, but the document worker count prevents the pool from reaching all slots. Add pool telemetry showing per-key dispatch count, wait time, 429 count, average latency, model success rate, and bytes/tokens per request.

### 3. Four-model fallback is not an efficient routing policy

`geminiPool.js` uses a candidate list and moves a page to the next model after repeated overload or when all key slots appear blocked. This can cause unnecessary retries, resets, and model switching. It also does not maintain separate quota state per `(model, key)` pair.

**Recommended routing model:**

| Tier | Purpose | Suggested behavior |
|---|---|---|
| Primary vision model | Highest handwriting/math/layout quality | Use for all pages initially; reserve enough quota for difficult pages |
| Fast vision model | Easy printed/clean pages and first-pass classification | Use only when a page is classified as low complexity |
| Long-context/strong reasoning model | Repair, verification, difficult equations/tables/diagrams | Use selectively on low-confidence pages, not every page |
| Cheap/light fallback | Provider overload or non-critical retry | Use only after explicit quality policy permits it |

Before using the four identifiers in production, call a startup capability check and verify that each model is available for the configured API project and supports the requested input modality, output-token limit, thinking configuration, and media resolution. Keep model IDs in configuration rather than hard-coding a list of assumed models.

Maintain independent health/quota state for every key-model pair. A 429 on one model should not automatically invalidate the key for every model unless the provider response indicates a project-wide limit. Do not reset all key blocks when changing models; that can immediately recreate the same quota storm.

Use a scheduler that scores candidates by:

```text
score = quality_weight * expected_quality
      - latency_weight * estimated_latency
      - quota_weight * projected_quota_cost
      - failure_weight * recent_error_rate
```

The scheduler should reserve a small fraction of capacity for verification and retries. Never spend all keys on first-pass OCR and then have no capacity for quality repair.

### 4. Accuracy validation is too weak for “no loss” claims

`checkCompleteness()` only detects unclosed code fences, unbalanced `$$`, and suspiciously short text. It cannot detect missing lines, a wrong digit, a changed minus sign, a missed diagram edge, a merged table cell, or an incorrectly inferred heading.

**Implement an accuracy pipeline:**

1. **Source preservation:** retain the original PDF/image and a page render hash.
2. **Region detection:** classify text, math, table, code, diagram, and blank/uncertain regions.
3. **Primary transcription:** produce structured blocks with bounding boxes and confidence.
4. **Independent verification:** send only uncertain or high-risk regions to a second model or a second pass with a different prompt/model.
5. **Consistency checks:** compare number of detected regions, table rows/columns, math delimiters, code indentation, page order, and heading hierarchy.
6. **Visual diff:** render the reconstructed page and show source vs. output side by side for review.
7. **Confidence gates:** flag pages/blocks below thresholds; never silently mark them complete.
8. **Human correction loop:** allow editing a block and re-running verification only for that region.
9. **Evaluation set:** build a versioned benchmark of real handwritten pages, including math, diagrams, tables, code, multiple languages, blur, skew, and low contrast.

Measure character error rate, word error rate, symbol/math accuracy, table cell accuracy, code exact-match rate, diagram entity/edge accuracy, omission rate, and page-level confidence. “Zero silent omissions” is a more meaningful acceptance criterion than a blanket 100% accuracy claim.

### 5. Whole-document base64 JSON processing is expensive

The client converts the whole file to base64 and posts it in JSON. Base64 adds roughly one-third payload overhead. The server then creates additional buffers and per-page base64 strings. This increases memory pressure and makes large documents slower.

**Fix in order:**

- Use `multipart/form-data` streaming uploads rather than base64 JSON.
- Enforce decoded byte size, page count, and per-page pixel limits after parsing.
- Store the upload in temporary object storage or a job workspace and pass a signed URL to workers.
- Parse page metadata once, then render pages only when needed.
- Reuse a bounded page-rendering pipeline; avoid creating and serializing a new PDF for every page when the model accepts rendered page images.
- If the provider accepts the original PDF, test sending page ranges or a document URL rather than reconstructing single-page PDFs.
- Use a job queue for multi-page work and return a job ID; keep SSE only for progress subscription.
- Keep result artifacts out of JSON. Return URLs and metadata.

### 6. Cache is useful but unsafe and incomplete

The page cache is plaintext on disk, has no TTL or size cap, is not atomically written, and its key is based only on file length plus the first 64 bytes. It does not include prompt version, model, preprocessing version, or renderer version. It can also retain sensitive documents indefinitely.

**Fix:** use SHA-256 over the original bytes plus a versioned processing key:

```text
cacheKey = sha256(fileBytes + promptVersion + preprocessingVersion + modelPolicyVersion)
```

Use a real cache store or a content-addressed directory with atomic temp-file rename, TTL, LRU/maximum-byte eviction, encryption at rest where required, and per-user access control. Store structured JSON rather than only Markdown so a later renderer can improve formatting without re-running OCR. Add an explicit “delete source and cache” action.

### 7. Request limits and input validation are inconsistent

The backend accepts 25 MB JSON payloads. `FileUpload` and `chunkedOcr` use 25 MB, while `formattedOcr.js` still says 20 MB. There is no explicit maximum page count, decoded-base64 limit, image dimension limit, or robust MIME/content validation for non-PDF data.

**Fix:** define one shared policy and validate it on both sides:

- maximum bytes after decoding;
- maximum pages;
- maximum image width/height and total pixels;
- accepted MIME plus magic-byte validation;
- encrypted/corrupt PDF policy;
- timeout and resource budget per job;
- meaningful 413/422 errors.

Do not rely on client-side limits for security.

## OCR pipeline redesign for speed and quality

### Recommended architecture

```text
Upload -> object storage/job record -> page planner
       -> page preprocessing/rendering pool
       -> first-pass OCR workers
       -> structured block normalizer
       -> confidence/risk classifier
       -> selective verification/repair workers
       -> deterministic renderer
       -> artifact storage + result manifest
       -> UI progress/review/download
```

### Page planner

For each page, detect whether it already contains a text layer. If it does, extract text and layout directly and use vision only for handwriting/image regions. Detect page orientation, skew, contrast, resolution, and content type. Do not send a full high-resolution page to the expensive model when a crop is sufficient.

### Preprocessing

Create a deterministic preprocessing pipeline with versioned settings: deskew, crop margins, adaptive contrast, denoise, and resolution normalization. Preserve the original page and never overwrite it. For equations and diagrams, retain a high-resolution crop even if normal text uses a lower-resolution render.

### Structured output

Replace “Markdown only” as the internal model contract with JSON validated against a schema, for example:

```json
{
  "page": 1,
  "blocks": [
    {
      "type": "paragraph|heading|math|table|code|diagram|list|image",
      "bbox": [0, 0, 100, 100],
      "order": 1,
      "content": "...",
      "latex": "...",
      "confidence": 0.0,
      "sourceRegions": [[0, 0, 100, 100]],
      "warnings": []
    }
  ],
  "unresolvedRegions": []
}
```

Generate Markdown, DOCX, HTML, and PDF from the same AST. This prevents the preview, DOCX export, and PDF export from drifting apart.

### Continuations

The current continuation logic resends the original page plus all accumulated output, which increases context size and can duplicate content. Use a continuation cursor/section protocol, or split a page into detected regions. If continuation is necessary, include a short tail context and require a unique block ID rather than resending the entire output. Deduplicate overlap deterministically.

### Parallelism

Use a bounded async queue with backpressure. Limit memory by counting the original file, rendered page buffers, in-flight request payloads, and generated artifacts. Dispatch pages out of order but assemble results by page number. Preserve resumability using per-page job records rather than only process-local memory and local disk.

### PDF rendering

For faithful output, use a renderer that supports:

- embedded fonts and Unicode;
- KaTeX/MathJax or SVG math;
- tables that can repeat headers across pages;
- code blocks with preserved whitespace;
- diagrams as SVG or source-region images;
- page breaks and widow/orphan control;
- selectable text;
- accessibility metadata where practical.

For diagrams, do not promise exact reconstruction from ASCII. Keep the original crop in the output when reconstruction confidence is low and let the user choose “preserve image” versus “rebuild diagram”.

## API-key and model operations plan

### Configuration

Use named variables or a secret manager rather than one ambiguous comma-separated value:

```text
GEMINI_KEY_01=...
GEMINI_KEY_02=...
...
GEMINI_MODEL_PRIMARY=...
GEMINI_MODEL_FAST=...
GEMINI_MODEL_VERIFY=...
GEMINI_MODEL_FALLBACK=...
```

Do not log key values. At startup, validate only masked identifiers and capabilities. If the keys belong to different projects, track project-level quotas separately; if they belong to the same project, six keys may not create six independent daily quotas.

### Scheduler policy

- Probe and mark unhealthy key-model combinations.
- Track minute and daily quota separately.
- Parse provider retry hints, but never reset unrelated blocks.
- Use weighted round-robin among healthy slots.
- Reserve capacity for verification and retries.
- Route easy pages to the fast model only after classification.
- Route math/table/diagram/high-uncertainty pages to the strongest model.
- Use circuit breakers for repeated 401/403, 429, and 5xx responses.
- Expose operational metrics and an admin-safe health view.

### Cost and quality policy

The strongest model should not process every easy page if a fast model can match benchmark quality. Conversely, do not route difficult handwriting to a cheap fallback merely to reduce latency. Select based on benchmarked page type and measured confidence.

## Frontend and UI improvements

### Immediate UX fixes

- Show a real per-page progress timeline with current stage: upload, render, OCR, verify, render output.
- Show estimated remaining time based on observed page latency, not fixed messages.
- Make “PDF unavailable” impossible: either provide a real PDF or hide/disable the button with a clear explanation.
- Add pause, cancel, resume, and retry-from-failed-page actions.
- Preserve job state across refresh using a backend job ID.
- Display warnings and low-confidence regions instead of only “Done”.
- Add source preview beside the editable transcription.
- Add “accept all”, “review next issue”, and “re-run selected region” controls.
- Add page thumbnails and page navigation for long documents.
- Add export options: searchable PDF, original-page-background PDF, DOCX, Markdown, TXT, and JSON/AST.

### Editor improvements

- Fix autosave/version behavior so every keystroke does not create a Firestore version after the debounce; use snapshots only for explicit saves or meaningful intervals.
- Add optimistic save state, offline queue, conflict detection, and a clear last-saved timestamp.
- Add undo/redo, find/replace, page jump, and keyboard shortcuts.
- Keep source coordinates linked to output blocks so clicking text highlights the source.
- Add a side-by-side compare mode between OCR output and corrected output.

### Accessibility and responsive design

- Add visible focus states, keyboard navigation, focus trapping in modal dialogs, and proper `aria-live` progress announcements.
- Respect `prefers-reduced-motion`; the current design uses many continuous animations and hover transforms.
- Verify color contrast for dim text and colored status badges.
- Ensure buttons have consistent minimum touch targets and labels on mobile.
- Replace the iframe-only PDF preview with a fallback preview and accessible document metadata.

### Performance

The production bundle’s main JS chunk is about 1.6 MB minified. Split heavy features with dynamic imports:

- KaTeX and editor/preview code;
- DOCX generation;
- PDF viewer/export code;
- optional client OCR dependencies.

Also remove duplicate Markdown/DOCX parsing implementations by creating shared modules. Avoid rendering large full-document HTML on every keystroke; use pagination or virtualization for long documents.

## Security, reliability, and data handling

- Use a Firebase service account in production and fail closed if server authentication cannot be reliably initialized.
- Add request IDs and structured logs; do not log full uploaded content or provider payloads.
- Add server-side authorization to job/artifact lookup and deletion.
- Use object-storage signed URLs with short expiry for source/result files.
- Add retention controls and a user-facing delete-all-data action.
- Add CSRF strategy if cookie authentication is introduced; bearer-token APIs are simpler to reason about.
- Add per-user quotas based on pages, bytes, and compute cost, not only request count.
- Do not leave `npm audit` configured to ignore failures in CI. Triage and pin/upgrade vulnerable packages.
- Handle unhandled promise rejections with a controlled shutdown or error reporting policy.
- Add health checks for dependencies and a readiness endpoint separate from liveness.

## Data model improvements

Store a document record plus job/artifact records rather than putting all content in one Firestore document:

```text
documents/{documentId}
  ownerId, title, sourceName, pageCount, status, createdAt, updatedAt

jobs/{jobId}
  ownerId, documentId, status, progress, policyVersion, error, createdAt

jobs/{jobId}/pages/{pageNumber}
  status, sourceHash, blocks, confidence, warnings, model, attempts, updatedAt

artifacts/{artifactId}
  ownerId, documentId, type, storagePath, sha256, byteLength, rendererVersion
```

Firestore’s 1 MB document limit makes large OCR content and version histories risky. Store large content and artifacts in object storage, and keep searchable summaries/indexes in Firestore or a dedicated search store.

## Testing and quality gates

Create real tests before changing concurrency or model routing:

1. Unit tests for data-URL parsing, PDF validation, cache keys, quota parsing, retry classification, Markdown/AST parsing, and download handling.
2. Contract tests for every API response shape, including SSE reconnect and cancellation.
3. Golden-page tests with expected text, equations, tables, code, diagrams, and confidence/warning behavior.
4. Property tests for malformed Markdown and malformed model output.
5. Load tests for 1, 5, 20, and 100-page files under 1, 2, 4, and 6 active keys.
6. Memory tests on a 512 MB-like container.
7. Browser tests for upload, cancel, retry, refresh/resume, editor save, export, modal accessibility, and offline recovery.
8. Security tests for cross-user document/artifact access, oversized payloads, invalid MIME, and malformed auth tokens.

CI should fail on test failure, build failure, and a bounded lint-error/warning policy. Replace the placeholder test script with a real runner such as Vitest plus Playwright for critical browser journeys.

## Prioritized implementation roadmap

### Phase 0: correctness blockers

- Implement or remove the formatted PDF path.
- Make result field naming consistent (`formattedPdf` vs. `formatted_pdf`, `totalPages` vs. `total_pages`).
- Wire cancellation through the backend and browser fallback intentionally.
- Add real tests and update the README/env documentation from Mistral to Gemini.
- Add strict input validation and a single file/page policy.

### Phase 1: accuracy foundation

- Introduce a structured OCR AST with confidence and source regions.
- Add second-pass verification for math, tables, code, diagrams, and low-confidence blocks.
- Add source/output side-by-side review and unresolved-region warnings.
- Build the golden evaluation set and baseline metrics.

### Phase 2: performance and key utilization

- Replace base64 JSON uploads with streaming multipart or signed object-storage uploads.
- Add a bounded job queue and per-page records.
- Increase concurrency based on load-test results, not a hard-coded two-worker default.
- Implement per-key/per-model health and quota accounting.
- Add telemetry and cost/latency dashboards.

### Phase 3: high-fidelity outputs

- Render PDF/DOCX/HTML from the same AST.
- Add embedded math, table continuation, code formatting, diagrams, source crops, and selectable text.
- Add searchable PDF and preservation mode that embeds original regions when reconstruction confidence is low.

### Phase 4: product polish

- Add page thumbnails, review queue, collaborative/versioned editing, keyboard shortcuts, accessibility improvements, reduced-motion mode, and bundle splitting.
- Add retention settings, export history, job history, and document-level reprocessing with selectable model policy.

## Acceptance criteria for the improved system

A release should not be called production-ready until it can demonstrate:

- no silent page omissions on the benchmark set;
- source hash and page count preserved end-to-end;
- every low-confidence region visible to the user;
- PDF/DOCX/preview generated from the same structured source;
- resumable jobs after browser refresh or server restart;
- bounded memory under the supported file/page limits;
- measured key utilization and no uncontrolled 429 storm;
- cross-user artifact access tests passing;
- real unit, integration, browser, and load tests in CI;
- documented quality/latency/cost trade-offs for each model tier.

## Most important immediate changes

If only five changes can be made first, do these:

1. Implement a real structured OCR result plus verification/confidence layer.
2. Implement the missing PDF renderer or remove the false formatted-PDF promise.
3. Replace the two-worker default with a bounded, telemetry-driven scheduler that can use all six keys safely.
4. Replace base64 JSON with streamed/signed uploads and page-level resumable jobs.
5. Add golden OCR tests and make CI run real tests rather than a placeholder.
