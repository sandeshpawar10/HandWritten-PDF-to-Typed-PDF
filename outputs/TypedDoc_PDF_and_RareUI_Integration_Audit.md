# TypedDoc PDF Download and Rare UI Integration Audit

## Audit result

The current implementation is **working and correctly structured for the normal authenticated server-processing path**, but it is not completely finished.

### Overall status

- **Server-generated formatted PDF:** Correctly implemented for normal server OCR success.
- **Browser-print PDF replacement:** Correctly removed from the main formatted-PDF download path.
- **PDF authenticity:** Verified by metadata, magic-byte, loading, controller, and provenance tests.
- **Rare UI integration:** Partially complete. Six Rare UI-derived components are actively used in the application. Three additional components are copied and exported but are not mounted in any screen.
- **Fallback behavior:** Still a product gap. If the server OCR path fails and TypedDoc falls back to browser OCR, the result intentionally has no formatted PDF.
- **Automated quality:** 46 tests passed, production build passed, and ESLint passed.

## 1. Formatted PDF download verification

### What is correct

The main export path is no longer a browser printout.

`src/services/export.js` defines `exportServerPdf()` and sends a POST request to:

```text
/api/v1/render/pdf
```

It sends the document title and Markdown content to the server, receives a base64-encoded PDF, converts it into an `application/pdf` Blob, and downloads it as:

```text
<document>_formatted.pdf
```

`exportToPdf()` delegates directly to `exportServerPdf()`. This confirms that the authoritative export function uses the server renderer rather than `window.print()`.

The browser-print implementation still exists as `printCurrentView()`, but it is explicitly labelled and isolated for a separate “Print Current View” action. It is not used by the authoritative `exportToPdf()` path. Keeping it is acceptable as long as the UI never labels it as the formatted PDF download.

### Server renderer evidence

`server/services/pdfExportService.js` creates the PDF with `pdf-lib`, embeds fonts, draws the document content directly onto PDF pages, and sets the following metadata:

```text
Creator:  TypedDoc Server PDF Engine
Producer: TypedDoc PDF Renderer
Author:   TypedDoc
```

It also writes a provenance footer such as:

```text
TypedDoc Server PDF Renderer • Layout: Clean Reflow
```

or:

```text
TypedDoc Server PDF Renderer • Layout: Faithful Source Pages
```

The controller at `server/controllers/renderController.js` returns the PDF as base64 JSON for the frontend and can also return a binary PDF when requested with `Accept: application/pdf` or `?format=binary`.

The route is registered at:

```text
POST /api/v1/render/pdf
```

and is protected by the shared authentication middleware and rate limiter in `server/routes/apiRoutes.js`.

### Download buttons are using server PDF data

The completed-job download button in `src/components/FileUpload.jsx` only downloads when `job.formattedPdf` exists. It uses `downloadBase64File()` with MIME type `application/pdf` and names the file `_formatted.pdf`.

The modal in `src/components/FormattedDocumentViewer.jsx` also downloads `formattedPdf` directly as a PDF Blob. Its iframe preview uses a Blob URL created from the same server-generated PDF bytes. The iframe is only a viewer; it does not generate the PDF.

### Automated evidence

The following tests passed:

- valid `%PDF` magic header;
- PDF can be loaded by `pdf-lib`;
- server renderer metadata is present;
- browser metadata such as Chrome, Edge, and Mozilla is absent;
- PDF telemetry identifies `renderer: pdf-lib` and `pdfSource: server-pdf`;
- JSON render endpoint returns base64 PDF and telemetry;
- binary render endpoint returns `application/pdf`;
- clean-reflow and faithful modes are tested;
- the full project test suite passed: **46 passed, 0 failed**.

The production frontend build also passed and ESLint returned no errors.

## 2. Important PDF limitations that remain

### A. Browser OCR fallback still does not produce a formatted PDF

In `src/services/chunkedOcr.js`, `convertWithFallback()` falls back to `clientSideOcr()` when the server is unavailable, times out, or encounters selected network/server errors.

The fallback result explicitly returns:

```js
formattedPdf: null,
formattedDocx: null,
pdfSource: 'unavailable',
clientSide: true
```

The UI correctly informs the user:

```text
OCR completed in browser mode. Server-formatted PDF is unavailable. Please retry with a stable connection.
```

This is honest and safe, but it means the requirement “every successful conversion should provide an original formatted PDF” is not fully met. A user can receive OCR text without a formatted PDF when the server fails.

#### Recommended fix

Choose one of these product policies:

1. **Strict formatted-output policy:** do not mark browser fallback as a successful conversion. Show the OCR text only as a recovery preview and require the user to retry server processing before enabling formatted PDF download.
2. **Client renderer fallback:** after client OCR, send the extracted Markdown to `/api/v1/render/pdf` when the server becomes available, or add a local `pdf-lib` renderer. The first option is safer because it keeps one authoritative renderer.
3. **Offline export mode:** explicitly label the result `Offline text-only export` and provide a separate text/Markdown download, never calling it a formatted PDF.

For accuracy and consistent layout, option 2 with a server retry queue is the preferred approach.

### B. The normal upload path does not explicitly send `pageMode`

The frontend chunked OCR request sends only:

```js
{
  document: {
    type: 'document_url' | 'image_url',
    document_url: '...'
  }
}
```

The server defaults to `clean-reflow` when no page mode is present. This is acceptable as a default, but the UI currently does not let users choose between:

- clean reflow;
- faithful layout;
- preserve source pages.

If the user needs a predictable page-correspondence result, add a visible layout mode selector and send `pageMode` in the request body.

### C. “Faithful” is structural page correspondence, not pixel-perfect original layout

The server renderer uses `pdf-lib` to redraw extracted text and blocks. It preserves page boundaries in faithful/preserve-source-pages modes, but it does not preserve the original scanned page’s exact handwriting geometry, original fonts, embedded background, or pixel-level positioning.

Therefore:

- it is an authentic server-generated formatted PDF;
- it is not a pixel-identical reconstruction of the source PDF;
- tables, math, images, and page breaks are re-rendered from the extracted representation.

The project tests correctly verify page budgets and metadata, but they do not prove visual equivalence with the original document. Add golden-file or screenshot comparison tests if visual fidelity is a strict requirement.

### D. Some renderer fidelity issues remain possible

The PDF renderer currently has known structural constraints:

- table cells render only the first wrapped line in each cell;
- image support accepts data URLs but not arbitrary remote images;
- math is rendered as cleaned italic text, not embedded KaTeX glyphs;
- inline Markdown formatting is not fully parsed by the server renderer;
- code blocks are rendered with a standard Courier font rather than syntax highlighting;
- diagrams represented only by metadata are skipped.

These are not browser-print issues, but they affect “proper formatted PDF” quality. The AST-based renderer should eventually carry richer block information for tables, math, diagrams, and inline runs.

## 3. Rare UI integration verification

### Components actively integrated and mounted

The following components are not merely copied; they are imported and used in application screens:

#### InlineAIStatus

Used in `src/components/FileUpload.jsx` for each processing job. It displays queued, OCR, formatting, completed, and failure states.

Status: **Integrated.**

Important gap: `src/services/chunkedOcr.js` does not currently forward the server’s `stage` field into the progress object. The server emits stages such as `formatting`, `verifying`, and `complete`, but the client mapping currently keeps only `current`, `total`, `percent`, and `message`.

As a result, this expression in `FileUpload.jsx` usually cannot detect the server’s formatting/verifying stage:

```js
processingProgress?.stage === 'formatting'
```

The component will commonly remain in the `ocr` state until completion.

**Fix:** preserve `event.stage` in the SSE progress mapping:

```js
stage: event.stage || 'transcribing'
```

Also include `stage` in the initial/fallback progress objects.

#### AnimatedCounter

Used in:

- completed/total conversion count in `FileUpload.jsx`;
- document count in `App.jsx`;
- upload/list summary metrics.

Status: **Integrated and appropriate.**

Keep the count animation limited to summary metrics and make sure the static number remains available to assistive technology.

#### DeleteButton

Used in `FileUpload.jsx` to remove completed, failed, or queued jobs.

Status: **Integrated.**

The active conversion path uses a normal cancel button instead, which is correct because cancellation is not the same as deletion.

The document list still uses its original immediate trash button rather than DeleteButton. For destructive document deletion, integrating DeleteButton into `DocumentList.jsx` would improve safety.

#### NotificationBell

Used in the authenticated sidebar in `App.jsx`.

Status: **Integrated.**

It displays a notification popover, unread count, read controls, and clear-all behavior. `FileUpload.jsx` adds durable notifications for completed and failed jobs.

Important limitation: notification persistence uses one global localStorage key:

```text
typeddoc_notifications_v1
```

This is not user-scoped. If multiple Firebase users use the same browser profile, notifications can appear across accounts.

**Fix:** include the Firebase user UID in the storage key, or move notifications to a user-scoped Firestore collection:

```js
const STORAGE_KEY = `typeddoc_notifications_v1_${user.uid}`;
```

The current `NotificationBell` does not receive a user ID, so the better fix is to pass the authenticated UID or replace local storage with the existing user-scoped backend.

#### FAQDrawer

Used in `App.jsx` through the authenticated sidebar’s “Help & FAQ” button.

Status: **Integrated and useful.**

The drawer has Escape handling, a dialog role, accordion buttons, and reduced-motion support. It should additionally implement focus trapping and restore focus to the Help button when closed.

#### RailTOC

Used in `FormattedDocumentViewer.jsx` in the Reading View tab.

Status: **Integrated.**

It is placed beside the rendered Markdown and receives the scrolling container reference. This is an appropriate placement for long documents.

Verify that the generated heading IDs in `MarkdownPreview` exactly match `RailTOC` IDs for headings containing punctuation, duplicate titles, or non-English text. Add an integration test for duplicate headings and special characters.

### Components copied/exported but not actually integrated

The following components exist in `src/components/rare/` and are exported from `src/components/rare/index.js`, but they are not currently mounted in the application:

#### StepPlayer

Status: **Not integrated.**

It is tested as a constant/configuration component, but no screen renders it. The processing screen still uses `ChunkedProgressBar` and ordinary status elements.

Recommended location: the processing feed, alongside the numeric page progress.

#### TaskList

Status: **Not integrated.**

It is exported and its architecture is covered indirectly, but it is not used for OCR review tasks, preflight checks, or version review.

Recommended location: a future OCR verification panel showing equations, tables, diagrams, or low-confidence regions requiring review.

#### CodeBlock

Status: **Not integrated.**

It is exported but no editor/viewer currently renders OCR code blocks through it. `MarkdownPreview` still renders its own code presentation.

Recommended location: `MarkdownPreview` or the editor’s code-block renderer, after confirming the AST carries language and line information.

### Integration count

The current practical integration is approximately:

```text
6 actively used Rare UI components:
InlineAIStatus, AnimatedCounter, DeleteButton,
NotificationBell, FAQDrawer, RailTOC
```

The following are present but unused:

```text
StepPlayer, TaskList, CodeBlock
```

This is a partial implementation, not a complete integration of the recommended Rare UI set.

## 4. Automated verification results

### Tests

Command:

```text
npm.cmd test
```

Result:

```text
46 tests passed
0 failed
0 cancelled
```

Covered areas include:

- PDF parsing and generation;
- PDF page modes;
- PDF metadata and provenance;
- PDF verifier behavior;
- render-controller JSON and binary responses;
- OCR cache;
- Gemini pool scheduling;
- OCR AST verification;
- DOCX export;
- Rare UI state/constants;
- notifications.

### Production build

Command:

```text
npm.cmd run build
```

Result: **Passed.**

The Vite build transformed 2,144 modules and generated a valid production bundle.

### Lint

Command:

```text
npm.cmd run lint
```

Result: **Passed with no reported errors.**

## 5. What is verified versus what is not

### Verified

- the standard formatted PDF path is server-generated;
- the main export function does not call browser print;
- the PDF has TypedDoc server metadata;
- the PDF can be parsed as a valid PDF;
- the API endpoint is authenticated through shared route middleware;
- frontend imports compile;
- active Rare UI components render through valid imports;
- automated tests, build, and lint pass.

### Not fully verified

- a live authenticated browser upload from source PDF through Gemini, SSE, PDF generation, and download;
- visual comparison against the original source PDF;
- all Rare UI components from the roadmap being used in the product;
- browser fallback producing a formatted PDF;
- focus trapping in FAQ/notification overlays;
- notification isolation between multiple Firebase users;
- accurate formatting/verifying labels during live SSE progress because stage is not preserved by the client mapper.

## 6. Recommended fixes in priority order

### P0: fix before claiming completion

1. Preserve `event.stage` in `src/services/chunkedOcr.js` so the UI correctly shows OCR, verification, formatting, and completion phases.
2. Decide and document the fallback policy. Do not represent browser-only OCR as a fully formatted-PDF success.
3. Add a live end-to-end test or manual QA checklist that performs authenticated upload and confirms the downloaded file has:
   - `%PDF` magic bytes;
   - `TypedDoc Server PDF Engine` creator;
   - `TypedDoc PDF Renderer` producer;
   - expected filename ending `_formatted.pdf`.

### P1: fix for production quality

1. Scope notifications by Firebase user.
2. Add focus trapping and focus restoration to FAQDrawer and NotificationBell popover.
3. Add page mode selection and propagate `pageMode` from frontend to OCR backend.
4. Add visual regression tests for representative handwritten PDFs, equations, tables, diagrams, and page breaks.
5. Add duplicate-heading and non-English heading tests for RailTOC.

### P2: complete the planned Rare UI integration

1. Mount StepPlayer in the processing workflow.
2. Mount TaskList for low-confidence OCR verification tasks.
3. Use CodeBlock for detected code sections in the editor/viewer.
4. Replace immediate document deletion with a confirmation interaction.

## Final verdict

The formatted PDF download fix is **correct for the normal server path**. The downloaded file is a real PDF generated by the TypedDoc server renderer, not a browser printout. The implementation is supported by passing metadata, controller, PDF validity, and provenance tests.

The Rare UI work is **partially correctly integrated**. Six components are actively used in the application and the build/tests prove the imports and architecture are valid. However, StepPlayer, TaskList, and CodeBlock are not yet used in the UI, so the full planned component integration is not complete.

The most important remaining functional issue is the client-side fallback: it returns OCR text but no formatted PDF. The most important UI issue is that server progress stages are emitted but not preserved by the frontend, so the new Inline AI Status may not show the correct verification/formatting phase.
