import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createPdfBuffer, parseMarkdownToPdfBlocks, exportPdfWithStats } from '../server/services/pdfExportService.js';
import { PDFDocument } from 'pdf-lib';

describe('Server-Side PDF Export Service Tests', () => {
  const sampleMarkdown = `
# Lecture 4: Dynamic Programming & Recurrences

## 1. Bellman Equation
$$
V(s) = \\max_{a} \\left( R(s, a) + \\gamma \\sum_{s'} P(s' | s, a) V(s') \\right)
$$

### Code Implementation
\`\`\`python
def fib(n, memo={}):
    if n in memo: return memo[n]
    if n <= 1: return n
    memo[n] = fib(n-1, memo) + fib(n-2, memo)
    return memo[n]
\`\`\`

### Complexity Comparison
| Algorithm | Time Complexity | Space Complexity |
|---|---|---|
| Naive Recursive | O(2^n) | O(n) |
| Memoized Top-Down | O(n) | O(n) |
| Tabulation Bottom-Up | O(n) | O(1) |

> Note: Dynamic programming applies when problems exhibit optimal substructure and overlapping subproblems.

- Point A: Memorize base cases
- Point B: Solve iteratively

![System Architecture Diagram](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

[DIAGRAM_METADATA: {"type": "flowchart", "title": "State Flow", "confidence": 0.95}]

--- Page 2 ---

## 2. Long Multipage Table
| Step | State | Action | Value |
|---|---|---|---|
| 1 | S0 | Init | 0.0 |
| 2 | S1 | Step | 1.0 |
`;

  test('should parse markdown into structured PDF blocks', () => {
    const blocks = parseMarkdownToPdfBlocks(sampleMarkdown);
    assert.ok(Array.isArray(blocks));
    assert.ok(blocks.some(b => b.type === 'heading' && b.text.includes('Lecture 4')));
    assert.ok(blocks.some(b => b.type === 'math'));
    assert.ok(blocks.some(b => b.type === 'code'));
    assert.ok(blocks.some(b => b.type === 'table'));
    assert.ok(blocks.some(b => b.type === 'blockquote'));
    assert.ok(blocks.some(b => b.type === 'list-item'));
    assert.ok(blocks.some(b => b.type === 'image'));
    assert.ok(blocks.some(b => b.type === 'page-break'));
    assert.ok(blocks.some(b => b.type === 'diagram-meta'));
  });

  test('should generate a valid PDF buffer from markdown', async () => {
    const pdfBuffer = await createPdfBuffer('Dynamic Programming Notes', sampleMarkdown);
    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 0);

    // Verify it starts with standard %PDF magic header
    const header = pdfBuffer.subarray(0, 4).toString();
    assert.strictEqual(header, '%PDF');

    // Verify it can be loaded by pdf-lib without error
    const loadedDoc = await PDFDocument.load(pdfBuffer);
    assert.ok(loadedDoc.getPageCount() >= 1);
  });

  test('should attach telemetry and metadata to buffer', async () => {
    const result = await exportPdfWithStats('Test Telemetry', sampleMarkdown, {
      pageMode: 'clean-reflow',
      sourcePageCount: 2
    });

    assert.ok(Buffer.isBuffer(result.buffer));
    assert.strictEqual(result.pageMode, 'clean-reflow');
    assert.strictEqual(result.sourcePageCount, 2);
    assert.ok(typeof result.pageCount === 'number');
    assert.ok(typeof result.expansionRatio === 'number');
  });

  test('should use soft page dividers in clean-reflow mode', async () => {
    // Two short pages separated by --- Page 2 ---
    const content = `
# Section 1
Brief intro on page 1.

--- Page 2 ---

# Section 2
Brief content on page 2.
`;
    // In clean-reflow mode, both short sections fit comfortably on 1 page with soft divider
    const reflowBuffer = await createPdfBuffer('Combined Document', content, {
      pageMode: 'clean-reflow'
    });
    assert.strictEqual(reflowBuffer.pageCount, 1);

    // In preserve-source-pages mode, it forces 2 pages
    const forcedBuffer = await createPdfBuffer('Separated Document', content, {
      pageMode: 'preserve-source-pages'
    });
    assert.strictEqual(forcedBuffer.pageCount, 2);
  });
});
