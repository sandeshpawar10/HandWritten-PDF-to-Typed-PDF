import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createPdfBuffer, parseMarkdownToPdfBlocks } from '../server/services/pdfExportService.js';
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
});
