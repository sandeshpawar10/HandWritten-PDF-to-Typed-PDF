# DMS Module 5 PDF Comparison

## Files compared

| File | Size | Pages | Page size | PDF content |
|---|---:|---:|---|---|
| Original: `DMS MODULE 5.pdf` | 7,924,633 bytes | 27 | A4, approximately 595.28 × 841.89 pt | Image-only scan: 27 image XObjects, no embedded fonts, no selectable text layer |
| TypedDoc: `dms 5 by typeddoc.pdf` | 657,876 bytes | 69 | A4, approximately 594.96 × 841.92 pt | Text/vector PDF: 15 font resource names, no image XObjects, no annotations |

## Overall verdict

The TypedDoc result is a **successful text/vector reflow export**, but it is not yet a faithful formatted reproduction of the original document. It is much smaller and likely searchable/selectable, which is a genuine improvement for digital usability. However, it expands from 27 pages to 69 pages, approximately **2.56 times the original page count**. That is the dominant quality problem.

The output should currently be described as:

> “OCR transcription exported as a reflowed typed PDF.”

It should not yet be described as:

> “A faithful typed copy with preserved page layout.”

The exact character-by-character and visual comparison cannot be proven from the PDF containers alone because the original contains only scanned images and no text layer. A true semantic accuracy audit requires rendering both PDFs to images and comparing page regions, or comparing the original images against the OCR source-region metadata. The structural evidence below is nevertheless conclusive about the pagination and rendering architecture.

## What TypedDoc does well

### 1. The generated PDF is dramatically smaller

The output is approximately 0.66 MB compared with the original’s approximately 7.92 MB. This is expected because the original stores scanned page images while TypedDoc stores text and vector drawing commands.

This is beneficial for:

- download speed;
- storage;
- search/indexing;
- text selection and copy/paste;
- accessibility potential;
- downstream document processing.

The reduction in size does **not** by itself prove better OCR accuracy. It only proves that the output is a reflowed text/vector document instead of a scan.

### 2. The output is a real text/vector PDF

The original has no fonts and contains one image object per page. The TypedDoc PDF contains font resources and no image XObjects. This means the output is not simply returning the original scan or embedding page screenshots; it is generating a typed document.

### 3. Both documents use A4 dimensions

The page geometry is close to A4 in both documents. Therefore, the large page-count difference is not caused by switching to a larger paper size. It is caused by content reflow, margins, typography, forced page breaks, or excessive vertical spacing.

## Main problems found

## 1. Severe pagination overflow: 27 pages became 69

This is the clearest measurable defect.

- Original: 27 pages
- TypedDoc output: 69 pages
- Difference: 42 additional pages
- Expansion factor: approximately 2.56×

This indicates that the output is not using a page layout model based on the original. It is taking the recognized Markdown and flowing it through a browser print layout.

### Why this is happening in the current code

The main cause is in `src/services/export.js`:

- PDF generation uses `window.print()`.
- The document is cloned into `#active-print-container`.
- CSS applies A4 dimensions and margins.
- Every OCR separator matching `--- Page N ---` uses:

```css
break-before: page;
page-break-before: always;
```

- The generated Markdown also contains headings, paragraphs, code blocks, math blocks, tables, and generous margins.
- Browser pagination depends on Chrome’s line wrapping, installed fonts, font loading timing, CSS, and page-break behavior.

The result is a natural reflow plus forced page breaks. A long transcription of one source page can occupy multiple output pages before the next forced source-page break occurs.

### Important distinction

If the target is a compact typed document, 69 pages may be acceptable only if the text genuinely requires that much space. But if the target is a typed equivalent of the original, the page expansion is too large and needs correction.

## 2. The output is not layout-faithful

The original is a page image. It contains the exact original positions of:

- headings;
- handwriting;
- equations;
- tables;
- diagrams;
- annotations;
- arrows;
- spacing;
- page margins;
- visual grouping.

The TypedDoc output contains reflowed text/vector content. It does not preserve the original coordinates because the current OCR contract asks Gemini to return Markdown only.

Markdown does not contain enough information to reproduce the original layout. Once the model returns only Markdown, the renderer no longer knows:

- where a line was located on the source page;
- whether two blocks were side-by-side;
- the dimensions of a table;
- where a diagram’s nodes and edges were drawn;
- how much whitespace separated sections;
- whether a note belonged to a particular equation or diagram.

For accurate formatting, the OCR result must include page coordinates and block types, not only text.

## 3. Diagrams and visual content are at high risk

The original contains image-only pages. The TypedDoc output contains no image objects. Therefore, any original diagram, handwritten visual, chart, or sketch has either been:

- converted to ASCII/text;
- reconstructed as vector/text content;
- omitted;
- or represented indirectly in the Markdown.

This may be acceptable for a “typed notes” product, but it is not safe for a zero-loss document conversion. Diagram topology, arrows, labels, graph edges, and spatial relationships require either structured vector reconstruction or preservation of the original crop.

### Required improvement

For each diagram or uncertain visual region, store:

```json
{
  "type": "diagram",
  "bbox": [x, y, width, height],
  "sourceImage": "signed-region-url",
  "reconstruction": "svg-or-structured-data",
  "confidence": 0.82,
  "warnings": ["edge direction uncertain"]
}
```

If confidence is below the configured threshold, embed the original crop in the output PDF instead of inventing a potentially incorrect reconstruction.

## 4. Math is not guaranteed to remain mathematically faithful

The current output pipeline converts OCR Markdown into browser HTML/KaTeX for preview and printing. This can render equations attractively, but it is vulnerable to:

- incorrect OCR symbols before rendering;
- malformed LaTeX;
- line wrapping inside equations;
- equations split across pages;
- unsupported LaTeX commands;
- lost alignment or matrix structure;
- differences between KaTeX screen CSS and print CSS.

The current validation in `server/services/geminiPool.js` only checks whether `$$` delimiters are balanced. It does not verify that the equation matches the source image.

### Required improvement

For every math block:

1. retain the source crop;
2. retain raw LaTeX;
3. render it to SVG or a stable PDF-compatible representation;
4. run a second verification pass for symbols and operators;
5. flag uncertain symbols such as `-`, `=`, ``, `c`, `c3`, `1`, `l`, `0`, `O`, and superscripts;
6. prevent page splitting inside the equation block.

## 5. Tables and code need block-aware pagination

Tables and code are currently generated from Markdown. Browser print can split tables badly and can create awkward whitespace around code blocks.

The print CSS has `page-break-inside: avoid` for code and math, but there is no sufficiently robust table policy for:

- repeating table headers;
- preventing a single row from splitting;
- handling wide tables;
- preserving column widths;
- keeping captions with tables;
- keeping code indentation and long lines readable.

### Required CSS and renderer improvements

Use modern page-break rules:

```css
.table-wrapper {
  break-inside: auto;
  page-break-inside: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  display: table-header-group;
}

tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

.math-block,
.code-block,
.diagram-block,
.heading + p {
  break-inside: avoid;
}
```

For high-fidelity export, a dedicated PDF renderer is more predictable than `window.print()`.

## 6. The current browser print pipeline is nondeterministic

`window.print()` depends on:

- Chrome version;
- operating system fonts;
- font loading timing;
- screen versus print CSS;
- browser print engine behavior;
- user print settings;
- page scale settings;
- installed font availability.

This makes the output difficult to test and can explain differences between users or deployment environments.

### Better approach

Use one of these deterministic renderers:

1. **Playwright/Chromium on the server** with embedded fonts and `page.pdf()`.
2. **Typst** for structured academic documents and math-heavy output.
3. A dedicated PDF layout engine that receives a structured AST.

If browser printing remains temporarily, wait for all fonts and KaTeX rendering before printing:

```js
await document.fonts.ready;
await new Promise(requestAnimationFrame);
await new Promise(requestAnimationFrame);
```

Also specify:

```js
window.print();
```

only after measuring the actual rendered height and logging the print configuration. This is still less reliable than server-side rendering.

## Detailed comparison by quality dimension

| Dimension | Result | Assessment |
|---|---|---|
| Page size | Both are A4 | Good |
| Page count | 27 → 69 | Major problem |
| File size | 7.92 MB → 0.66 MB | Strong improvement |
| Searchability | Original image-only; output text/vector | Strong improvement |
| Original visual layout | Not preserved | Major limitation |
| Source page geometry | Not represented in OCR output | Major limitation |
| Diagrams | No images in output | High omission/reconstruction risk |
| Mathematical fidelity | Not verifiable from current container; syntax checks are insufficient | Needs verification layer |
| Tables | Reflowed Markdown tables | Needs page-aware rendering |
| Code | Reflowed text blocks | Needs exact indentation and line-wrap rules |
| Page breaks | Browser/forced separator dependent | Major problem |
| Fonts | Output embeds/references fonts; original has none | Good for digital output, must embed consistently |
| Accessibility | Output has selectable text potential but no complete semantic tagging | Partial improvement |
| Output reproducibility | Browser print dependent | Weak |

## What should be done to produce a proper PDF

There are two valid product modes. They should be separate options in the UI.

## Mode A: Faithful typed layout

Goal: preserve the original 27-page structure and approximate source positions while replacing handwriting with typed content.

### Implementation

1. Render each original page to a high-resolution image.
2. Detect text, math, table, code, and diagram regions with bounding boxes.
3. Send each page or region to OCR.
4. Return structured blocks with coordinates:

```json
{
  "page": 1,
  "width": 2480,
  "height": 3508,
  "blocks": [
    {
      "type": "heading",
      "bbox": [140, 180, 1900, 260],
      "text": "Module 5",
      "confidence": 0.98
    }
  ]
}
```

5. Create one output PDF page for each source page.
6. Position typed blocks using the original bounding boxes.
7. Preserve original diagrams as images unless they are confidently reconstructed.
8. Keep source and output as separate layers where possible.
9. Add a hidden/selectable text layer for search.

This mode should target approximately 27 output pages, not 69.

## Mode B: Clean reflowed academic document

Goal: create a professionally typeset document without preserving original page positions.

### Implementation

1. Convert OCR output to a structured AST.
2. Apply a consistent style guide.
3. Use compact but readable typography.
4. Avoid forced source-page breaks unless the user selects “preserve page breaks”.
5. Use deterministic PDF rendering.
6. Use page-aware table, math, code, and diagram components.
7. Display the final estimated page count before download.

For this mode, 69 pages may reduce after typography and spacing improvements, but the final number should be based on actual content, not forced separators and excessive margins.

## Code changes recommended

### 1. Stop using Markdown as the only internal representation

Change the Gemini response contract from:

```text
Return only clean Markdown
```

to schema-validated structured JSON containing:

- block type;
- text/LaTeX/code/table data;
- page number;
- bounding box;
- reading order;
- confidence;
- source-region IDs;
- warnings;
- unresolved regions.

Markdown should be generated later for editing/export.

### 2. Split rendering into a dedicated service

Create something like:

```text
server/services/documentAst.js
server/services/pdfRenderer.js
server/services/docxRenderer.js
server/services/markdownRenderer.js
server/services/verificationService.js
```

All output formats must consume the same AST.

### 3. Add an explicit page-break policy

Add user/configuration options:

```text
pageMode = preserve-source-pages | clean-reflow
preserveDiagrams = true
preserveSourceRegionsOnLowConfidence = true
compactSpacing = true
```

Do not unconditionally use `break-before: page` for every OCR page separator.

### 4. Fix the current print CSS

Reduce excessive vertical spacing. Current styling uses large margins and padding for headings, paragraphs, math, and cards. Use a print-only compact stylesheet rather than reusing screen presentation styles.

Recommended starting values:

```css
@page {
  size: A4;
  margin: 12mm 14mm;
}

#active-print-container {
  font-size: 10.5pt;
  line-height: 1.35;
}

#active-print-container p {
  margin: 0 0 0.45em;
}

#active-print-container h1 {
  margin: 0 0 0.8em;
}

#active-print-container h2 {
  margin: 0.8em 0 0.35em;
}

#active-print-container h3 {
  margin: 0.65em 0 0.25em;
}

#active-print-container .md-math-block {
  margin: 0.45em 0;
  padding: 0.35em;
}

#active-print-container .md-code-block {
  margin: 0.45em 0;
  padding: 0.5em;
  font-size: 8.5pt;
}
```

These values should be tuned against the actual benchmark PDF rather than applied blindly.

### 5. Remove duplicate parsers

The project has similar Markdown/DOCX parsing logic in:

- `server/services/docxExportService.js`;
- `src/services/export.js`;
- `src/components/MarkdownPreview.jsx`.

This creates drift between preview, DOCX, and PDF. Replace them with one shared AST parser/renderer contract.

### 6. Add PDF verification after generation

After creating the PDF, automatically verify:

- expected page count;
- non-empty content on every page;
- no unexpected blank pages;
- no clipped blocks;
- no math block split across pages;
- all source page IDs present;
- all unresolved regions carried into the output;
- selectable text exists where expected;
- artifact hash and byte size recorded.

For faithful mode, compare page count with source and fail or warn if the count differs beyond a configured threshold.

## Accuracy verification plan for this document

For this specific 27-page source, create a benchmark record containing:

- original page image hashes;
- expected page count = 27;
- page-level OCR text reference;
- math block count and LaTeX reference;
- table count and dimensions;
- diagram count and region boxes;
- code-block count;
- heading hierarchy;
- unresolved/uncertain region list.

Then calculate:

- page omission rate;
- duplicated page rate;
- word error rate;
- character error rate;
- math symbol accuracy;
- table cell accuracy;
- code exact-match rate;
- diagram entity/edge accuracy;
- output page expansion factor;
- percentage of content requiring human review.

The system should not mark this file “complete” if high-risk blocks remain unverified.

## Priority order

### P0: Fix before calling the PDF output production-ready

1. Decide whether the product is faithful-layout or clean-reflow.
2. Add structured OCR blocks with coordinates and confidence.
3. Implement a real server-side PDF renderer.
4. Add source-page and output-page verification.
5. Fix the 27-to-69 pagination expansion.
6. Preserve uncertain diagrams and handwritten visual regions.

### P1: Improve quality

1. Add second-model verification for math, tables, diagrams, and code.
2. Add exact table and code rendering.
3. Add deterministic font embedding.
4. Add `document.fonts.ready` and layout checks as a temporary browser-print safeguard.
5. Add side-by-side source/output review.

### P2: Improve performance and operations

1. Render and process pages through a bounded queue.
2. Store AST and artifacts separately.
3. Avoid returning large base64 PDFs in JSON.
4. Add page-level caching keyed by source hash and renderer version.
5. Add load tests using this 27-page document.

## Final conclusion

TypedDoc’s output has two meaningful successes: it converts the image-only source into a much smaller selectable text/vector PDF and keeps A4 geometry. However, the output is currently a heavily reflowed transcription rather than a faithful typed version of the original. The 69-page result compared with 27 source pages is the clearest evidence.

The biggest improvement is not simply changing font size or reducing margins. The core fix is to preserve structured page layout and source coordinates throughout OCR. Once the system has block types, bounding boxes, confidence, and source-region links, it can generate a proper faithful PDF, a clean reflow PDF, DOCX, Markdown, and searchable output without losing the relationship between the original and the transcription.
