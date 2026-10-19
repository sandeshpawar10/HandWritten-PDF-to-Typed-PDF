# TypedDoc Unique Features: Detailed Product and Implementation Roadmap

## Purpose

TypedDoc already converts handwritten documents into editable text and formatted files. The next stage should make it a **trustworthy document-understanding and review platform**, not only an OCR converter.

The most valuable direction is to combine:

- accurate transcription;
- source-to-output verification;
- region-level correction;
- faithful and clean document export;
- study and productivity tools;
- privacy and collaboration controls.

The key product principle should be:

> Never hide uncertainty. Show users exactly what was recognized, what may be wrong, and how to correct it quickly.

---

# 1. Source–Text Comparison Mode

## What it does

Display the original page beside the typed transcription. Scrolling, page selection, and selected regions should stay synchronized.

Example layout:

```text
+------------------------+--------------------------+
| Original page image    | Typed transcription      |
|                        |                          |
| equation / handwriting | recognized equation      |
|                        |                          |
+------------------------+--------------------------+
```

## Why users need it

Users currently have to compare the original PDF and generated output manually. Side-by-side comparison makes it easy to identify:

- missing words;
- wrong digits;
- incorrect mathematical symbols;
- omitted table cells;
- wrong heading order;
- diagram mistakes.

## How to implement it

### Backend data model

Store each OCR block with its source coordinates:

```json
{
  "id": "p3-b12",
  "page": 3,
  "type": "paragraph",
  "text": "Document management systems...",
  "bbox": {
    "x": 180,
    "y": 420,
    "width": 1900,
    "height": 120
  },
  "confidence": 0.96,
  "sourceRegionId": "p3-r12"
}
```

### Frontend components

Create:

```text
src/components/SourceTextCompare.jsx
src/components/SourcePageCanvas.jsx
src/components/OcrBlockOverlay.jsx
src/components/ComparisonToolbar.jsx
```

### Required features

- page thumbnail list;
- previous/next page controls;
- synchronized page selection;
- zoom controls;
- select block from source or output;
- highlight matching block;
- open correction panel;
- display confidence and warnings.

## Recommended implementation order

1. Add page thumbnails.
2. Render source page image.
3. Render typed blocks beside it.
4. Add block IDs and matching selection.
5. Add synchronized scrolling.
6. Add correction and reprocessing controls.

---

# 2. Confidence Highlighting System

## What it does

Every text, equation, table, code, and diagram block receives a confidence score and warning state.

Suggested display:

- green: high confidence;
- yellow: requires review;
- red: likely incorrect or incomplete;
- gray: preserved source image because reconstruction was uncertain.

## Why users need it

A document may be mostly correct while containing a few dangerous errors. Users should not need to manually review every line.

## Confidence model

Do not rely only on the model’s self-reported confidence. Combine multiple signals:

```text
finalConfidence =
  0.35 * modelConfidence
+ 0.25 * verifierAgreement
+ 0.15 * syntaxValidity
+ 0.15 * sourceRegionCompleteness
+ 0.10 * visualQualityScore
```

Use different thresholds by block type:

```text
paragraph: 0.85
heading: 0.90
math: 0.96
table: 0.94
code: 0.98
diagram: 0.95
```

Math, code, and diagrams should require higher confidence than normal prose.

## Backend changes

Add an OCR verification result:

```json
{
  "confidence": 0.88,
  "status": "review",
  "signals": {
    "model": 0.91,
    "secondPassAgreement": 0.82,
    "syntax": 1.0,
    "regionCoverage": 0.79
  },
  "warnings": [
    "Possible missing superscript",
    "Right edge of source region is faint"
  ]
}
```

## UI behavior

Provide filters:

```text
All blocks | Needs review | Math | Tables | Diagrams | Code
```

Add a review queue:

```text
Review 7 uncertain regions
```

Each click should open the next unresolved block.

---

# 3. One-Click Region Reprocessing

## What it does

The user selects a word, equation, table cell, paragraph, or image region and clicks:

```text
Reprocess selected region
```

Only that region is sent to a stronger verification model.

## Why users need it

Reprocessing an entire 27-page PDF because one equation is wrong is slow and expensive. Region-level reprocessing reduces:

- latency;
- API cost;
- quota usage;
- user frustration.

## Backend flow

```text
User selects region
  -> crop source image
  -> build region-specific prompt
  -> send to verify model
  -> compare candidate results
  -> update AST block
  -> mark version change
```

## API design

```text
POST /api/v1/documents/:documentId/pages/:pageNumber/regions/:regionId/reprocess
```

Request:

```json
{
  "region": {
    "x": 120,
    "y": 400,
    "width": 1800,
    "height": 300
  },
  "blockType": "math",
  "mode": "verify"
}
```

Response:

```json
{
  "regionId": "p3-r12",
  "oldContent": "A = B + C",
  "newContent": "A = B - C",
  "confidence": 0.97,
  "alternatives": [],
  "changed": true
}
```

## Important safety rule

Never overwrite the old result without storing a version. Keep:

- old content;
- new content;
- source crop;
- model used;
- timestamp;
- user who approved the change.

---

# 4. Faithful Layout and Clean Reflow Modes

## What it does

Offer two different PDF outputs.

### Faithful Layout

Preserves:

- source page count;
- page dimensions;
- approximate positions;
- equations near original locations;
- diagrams and tables in original regions.

### Clean Reflow

Creates a polished academic document optimized for reading and editing.

## Why users need both

Students may want a clean revision document. Researchers, legal users, and auditors may require the output to correspond closely to the source.

## Implementation architecture

The OCR result should be an AST, not Markdown only:

```json
{
  "documentId": "doc-123",
  "pages": [
    {
      "page": 1,
      "width": 2480,
      "height": 3508,
      "blocks": [
        {
          "type": "heading",
          "text": "Module 5",
          "bbox": [120, 180, 2200, 300],
          "confidence": 0.98
        }
      ]
    }
  ]
}
```

## Faithful renderer

Create one PDF page per source page:

```text
source page image / blank page
  + typed text positioned by bbox
  + equation rendering
  + preserved uncertain crops
  + selectable text layer
```

## Clean renderer

Flatten the AST into a professional flow:

```text
heading -> paragraph -> equation -> table -> code -> diagram
```

Use the server-side PDF renderer, not `window.print()`.

## UI options

```text
Export PDF
  [Faithful original layout]
  [Clean academic reflow]
```

Store the selected mode with the export job.

---

# 5. Searchable Scanned PDF

## What it does

Preserve the original page image while adding a hidden/selectable OCR text layer.

The visual output remains identical to the scan, but users can:

- search text;
- copy text;
- select paragraphs;
- use screen readers more effectively;
- index the document.

## Why it is valuable

This is the safest output when exact original appearance matters. It does not require risky reconstruction of every diagram or handwriting shape.

## Implementation

1. Render or preserve the original page image.
2. Generate OCR text blocks with bounding boxes.
3. Add transparent text positioned over each source region.
4. Store confidence and source mapping separately.
5. Export as a PDF with the image and text layer.

## Important detail

Do not use invisible text as a replacement for visual verification. Keep the original image as the visible layer and use OCR only as the selectable/searchable layer.

---

# 6. Intelligent Math Verification

## What it does

Show the original equation, recognized LaTeX, rendered equation, and alternative interpretation together.

Example:

```text
Original crop: [image]
Recognized:    x^2 + 2x + 1 = 0
Rendered:      x² + 2x + 1 = 0
Confidence:    91%
```

## Why users need it

A single math-symbol error can change the meaning of an entire derivation.

## Verification pipeline

```text
source equation crop
  -> primary OCR model
  -> LaTeX parser
  -> renderer
  -> verification model
  -> symbol-level comparison
```

## Checks to add

Detect suspicious changes involving:

- `+` versus `-`;
- `=` versus `\neq`;
- `1` versus `l`;
- `0` versus `O`;
- `x` versus `\times`;
- missing superscripts;
- missing subscripts;
- missing fractions;
- missing parentheses;
- incorrect Greek symbols;
- incomplete matrices.

## UI actions

```text
Accept result
Edit LaTeX
Choose alternative
Reprocess equation
Keep original crop
```

---

# 7. Diagram Reconstruction Editor

## What it does

Allow users to edit reconstructed diagrams, flowcharts, trees, graphs, and state machines.

## Why users need it

Plain Markdown or ASCII cannot always preserve:

- node positions;
- arrow directions;
- edge labels;
- graph topology;
- crossing relationships;
- visual grouping.

## Data model

```json
{
  "type": "diagram",
  "nodes": [
    { "id": "A", "label": "Start", "x": 120, "y": 100 }
  ],
  "edges": [
    { "from": "A", "to": "B", "label": "yes", "directed": true }
  ],
  "confidence": 0.84
}
```

## Frontend options

- simple node/edge editor;
- SVG canvas;
- undo/redo;
- add/remove node;
- edit labels;
- move elements;
- preserve original crop;
- export as SVG, PDF, or PNG.

## Safety rule

If diagram confidence is below threshold, preserve the original crop automatically and label it:

```text
Original visual retained because reconstruction confidence is low.
```

---

# 8. Smart Document Summaries and Study Tools

## What it does

After transcription, optionally generate:

- chapter summary;
- key concepts;
- important formulas;
- glossary;
- flashcards;
- practice questions;
- quiz mode;
- “explain this page” mode.

## Why users need it

Students can turn handwritten notes into a complete revision workflow.

## Processing architecture

Do not send the entire document to a model every time. Use the AST and page summaries:

```text
page ASTs
  -> section grouping
  -> section summaries
  -> document summary
  -> flashcards and quiz questions
```

## API examples

```text
POST /api/v1/documents/:id/summary
POST /api/v1/documents/:id/flashcards
POST /api/v1/documents/:id/quiz
POST /api/v1/documents/:id/explain
```

## UI design

Add tabs:

```text
Document | Summary | Formulas | Flashcards | Quiz
```

Allow users to create study content from selected pages instead of only the complete document.

---

# 9. Automatic Document Structure Detection

## What it does

Detect and organize:

- title page;
- chapters;
- headings;
- definitions;
- examples;
- exercises;
- conclusions;
- references;
- page sections.

## Why users need it

Many handwritten notes have inconsistent headings and spacing. Automatic structure makes them easier to navigate.

## AST additions

```json
{
  "type": "definition",
  "title": "Definition",
  "content": "...",
  "sectionId": "chapter-2"
}
```

## UI improvements

- generated table of contents;
- outline sidebar;
- click heading to jump to page;
- collapse/expand sections;
- reorder sections;
- rename sections.

## Validation

Allow users to edit detected hierarchy because automatic structure detection can be wrong for informal notes.

---

# 10. Version History and Difference View

## What it does

Save every meaningful document change and show differences between versions.

## Why users need it

Users can safely:

- reprocess a page;
- change an equation;
- edit a table;
- switch export styles;
- undo a correction.

## Version model

```json
{
  "documentId": "doc-123",
  "version": 4,
  "parentVersion": 3,
  "createdBy": "user-123",
  "createdAt": "2026-10-19T12:00:00Z",
  "changeType": "region-reprocess",
  "changedBlocks": ["p3-b12"]
}
```

## UI

Add:

```text
Version history
  v4 - Equation corrected
  v3 - Table reviewed
  v2 - OCR verification completed
  v1 - Initial transcription
```

Allow:

- compare versions;
- restore version;
- duplicate as new document;
- export a selected version.

---

# 11. Smart Export Presets

## What it does

Provide professional formatting presets:

- university notes;
- research paper;
- technical documentation;
- exam revision notes;
- legal/official document;
- minimal black-and-white;
- accessible large-print document.

## Why users need it

Users should not need to understand typography, margins, page breaks, and heading styles.

## Preset model

```json
{
  "name": "University Notes",
  "pageSize": "A4",
  "bodyFont": "Times New Roman",
  "bodySize": 10.5,
  "lineHeight": 1.35,
  "showPageNumbers": true,
  "showSourceConfidence": false,
  "preserveDiagrams": true
}
```

## Implementation

Move style values out of hard-coded renderer constants and into configuration:

```text
server/rendering/presets/universityNotes.js
server/rendering/presets/researchPaper.js
server/rendering/presets/accessibleLargePrint.js
```

Let users save custom presets.

---

# 12. Privacy and Data-Control Center

## What it does

Give users control over document storage and deletion.

Controls should include:

- automatic document deletion;
- retention period;
- delete original source;
- delete OCR result;
- delete all document data;
- download data archive;
- processing history;
- local-only mode where available.

## Why users need it

Handwritten notes can contain private academic, business, medical, legal, or personal information.

## Backend requirements

- encrypt data at rest;
- use signed URLs with short expiry;
- restrict document access by user ID;
- delete derived artifacts together with source files;
- log deletion events;
- avoid logging document text or API keys;
- add retention cleanup jobs.

## UI

Create:

```text
Settings -> Privacy and data
```

Show:

```text
Original file stored: Yes
OCR cache stored: Yes
Retention: 30 days
Auto-delete: On
```

---

# 13. Offline Queue and Resume

## What it does

Allow users to select files while offline. The application stores a pending job locally and resumes when the connection returns.

## Why users need it

Large document processing can fail because of temporary network interruption. Users should not restart from the beginning.

## Implementation

Use:

- IndexedDB for job metadata;
- resumable page-level processing;
- upload chunk hashes;
- server-side job IDs;
- retry with exponential backoff;
- online/offline events.

## Job states

```text
queued
uploading
uploaded
processing
paused
needs-review
completed
failed
cancelled
```

## Important design rule

Store the OCR result per page, not only after the full document completes.

---

# 14. Collaboration and Comments

## What it does

Allow users to share a document and comment on a specific region or block.

## Why users need it

Teachers, students, researchers, and office teams may need review workflows.

## Permissions

```text
Owner
Editor
Reviewer
Viewer
```

## Comment model

```json
{
  "id": "comment-9",
  "documentId": "doc-123",
  "page": 3,
  "blockId": "p3-b12",
  "text": "Check whether this symbol is a minus sign.",
  "createdBy": "user-2",
  "status": "open"
}
```

## UI actions

- add comment to selected block;
- mention another reviewer;
- resolve comment;
- filter unresolved comments;
- export review report;
- approve final version.

---

# 15. Document Quality Score

## What it does

Show users a clear quality report after processing.

Example:

```text
Overall confidence: 94%

Text accuracy:     97%
Math accuracy:     89%
Table accuracy:    93%
Diagram accuracy:  81%
Pages to review:   4
```

## Why users need it

Users need to know whether the document is ready to use or needs review.

## Scoring dimensions

Track separately:

- word error rate;
- character error rate;
- math symbol accuracy;
- table cell accuracy;
- code exact-match rate;
- diagram entity/edge accuracy;
- source-region coverage;
- unresolved region count;
- page expansion ratio;
- model disagreement.

## UI

Use a quality panel with:

- overall score;
- score by content type;
- review queue;
- explanation of warnings;
- “review next issue” button.

Do not present a single score as a guarantee of perfect accuracy. Make the underlying reasons visible.

---

# 16. Multilingual, Translation, and Accessibility Features

## Potential capabilities

- handwritten language detection;
- multilingual OCR;
- translation after transcription;
- bilingual PDF export;
- text-to-speech;
- voice note transcription;
- dyslexia-friendly formatting;
- large-print output;
- screen-reader-friendly structured HTML;
- high-contrast mode.

## Recommended flow

```text
Original OCR
  -> user chooses translation language
  -> translated AST
  -> side-by-side bilingual export
```

Never replace the original transcription automatically. Store translation as a separate version or layer.

---

# Recommended architecture for all new features

```text
Upload
  -> source storage
  -> page planner
  -> page rendering
  -> OCR blocks
  -> AST
  -> confidence and verification
  -> review queue
  -> user corrections
  -> version history
  -> export renderer
  -> PDF / DOCX / Markdown / searchable PDF
```

## Suggested service structure

```text
server/services/
  ocrAst.js
  ocrVerifier.js
  confidenceService.js
  regionReprocessService.js
  sourcePageService.js
  diagramService.js
  mathVerificationService.js
  documentVersionService.js
  documentQualityService.js
  pdfExportService.js
  searchablePdfService.js
  studyToolsService.js
```

## Suggested frontend structure

```text
src/components/
  SourceTextCompare.jsx
  ConfidenceOverlay.jsx
  ReviewQueue.jsx
  RegionReprocessDialog.jsx
  MathReviewPanel.jsx
  DiagramEditor.jsx
  VersionHistory.jsx
  QualityReport.jsx
  ExportPresetPicker.jsx
  PrivacyCenter.jsx
  CollaborationPanel.jsx
```

---

# API roadmap

## Core review APIs

```text
GET    /api/v1/documents/:id/ast
GET    /api/v1/documents/:id/pages/:pageNumber/source
GET    /api/v1/documents/:id/review-queue
POST   /api/v1/documents/:id/regions/:regionId/reprocess
PATCH  /api/v1/documents/:id/blocks/:blockId
```

## Export APIs

```text
POST /api/v1/documents/:id/export/pdf
POST /api/v1/documents/:id/export/searchable-pdf
POST /api/v1/documents/:id/export/docx
POST /api/v1/documents/:id/export/markdown
```

## Version and collaboration APIs

```text
GET    /api/v1/documents/:id/versions
POST   /api/v1/documents/:id/versions
POST   /api/v1/documents/:id/restore/:versionId
GET    /api/v1/documents/:id/comments
POST   /api/v1/documents/:id/comments
PATCH  /api/v1/comments/:commentId
```

## Study tool APIs

```text
POST /api/v1/documents/:id/summary
POST /api/v1/documents/:id/flashcards
POST /api/v1/documents/:id/quiz
POST /api/v1/documents/:id/explain
```

---

# Data model improvements

A document should contain separate source, OCR, review, and export data:

```json
{
  "id": "doc-123",
  "ownerId": "user-1",
  "source": {
    "fileName": "notes.pdf",
    "sha256": "...",
    "pageCount": 27,
    "storagePath": "..."
  },
  "ocr": {
    "promptVersion": "v2.1",
    "modelPolicyVersion": "v1.3",
    "pages": [],
    "status": "completed"
  },
  "review": {
    "unresolvedCount": 4,
    "approvedCount": 120,
    "lastReviewedAt": "..."
  },
  "exports": [
    {
      "format": "pdf",
      "mode": "faithful",
      "rendererVersion": "1.0.0",
      "pageCount": 27,
      "createdAt": "..."
    }
  ]
}
```

This makes exports reproducible and lets users re-render without repeating OCR.

---

# Implementation phases

## Phase 1: Trust and correctness

Implement first:

1. source–text comparison;
2. confidence highlighting;
3. review queue;
4. region reprocessing;
5. server-only formatted PDF download;
6. faithful and clean-reflow modes;
7. quality score;
8. source-region preservation for uncertain diagrams.

### Success criteria

- Users can identify every low-confidence region.
- Users can correct one region without reprocessing the document.
- Server PDF downloads never call browser print.
- Faithful mode produces approximately the source page count.

## Phase 2: Editing and productivity

Implement:

1. math verification;
2. diagram editor;
3. version history;
4. document outline;
5. export presets;
6. searchable scanned PDF.

### Success criteria

- Equations can be verified independently.
- Diagrams can be manually corrected.
- Users can undo and compare revisions.
- Exports are consistent across PDF, DOCX, and Markdown.

## Phase 3: Study and collaboration

Implement:

1. summaries;
2. flashcards;
3. quizzes;
4. comments;
5. sharing and permissions;
6. review approval workflows.

### Success criteria

- Users can create study material from selected pages.
- Multiple users can review and approve uncertain areas.
- Comments remain attached to the correct OCR block after edits.

## Phase 4: Privacy, accessibility, and scale

Implement:

1. privacy center;
2. retention controls;
3. offline queue;
4. multilingual output;
5. text-to-speech;
6. accessibility export;
7. usage and cost analytics.

### Success criteria

- Users can control data retention.
- Interrupted processing resumes at page level.
- Output is usable with assistive technology.
- Cost and quota usage remain visible and controlled.

---

# Testing strategy

## Unit tests

Test:

- AST parsing;
- confidence calculation;
- block-to-source mapping;
- page coordinate scaling;
- table rendering;
- math validation;
- version diffs;
- export presets;
- deletion logic.

## Integration tests

Test:

- upload to OCR to AST;
- AST to faithful PDF;
- AST to reflow PDF;
- region reprocessing;
- version creation;
- review approval;
- signed artifact download.

## Visual regression tests

Use fixed benchmark documents containing:

- handwriting;
- equations;
- tables;
- diagrams;
- code;
- multi-column pages;
- faint writing;
- crossed-out text;
- mixed languages.

Compare rendered output screenshots against approved baselines.

## Quality metrics

Track:

- character error rate;
- word error rate;
- math symbol accuracy;
- table cell accuracy;
- code exact-match rate;
- diagram node/edge accuracy;
- omitted region rate;
- duplicated content rate;
- page expansion ratio;
- percentage of blocks needing review;
- average correction time per page.

---

# Highest-value features to implement first

If development capacity is limited, implement these eight features first:

1. **Source–text comparison mode** — makes errors visible.
2. **Confidence highlighting** — directs user attention.
3. **Region-level reprocessing** — fixes errors quickly and cheaply.
4. **Faithful and clean-reflow export modes** — supports different user needs.
5. **Searchable scanned PDF** — preserves original appearance while adding search.
6. **Math and diagram verification** — protects high-risk content.
7. **Quality score and review queue** — makes output trust measurable.
8. **Version history** — makes corrections safe.

These features improve the core product more directly than adding unrelated AI features.

---

# Final product vision

TypedDoc should evolve from:

```text
Upload handwritten PDF -> receive typed text
```

to:

```text
Upload document
  -> receive structured transcription
  -> see source and output together
  -> review uncertain regions
  -> correct individual blocks
  -> preserve versions
  -> export faithfully or cleanly
  -> generate summaries and study material
```

The strongest differentiator will be **trustworthy, reviewable OCR with source traceability**. Many tools produce text; fewer show users exactly where that text came from and help them correct only the uncertain parts.
