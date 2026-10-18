import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createPdfBuffer } from '../server/services/pdfExportService.js';
import { verifyPdfBuffer } from '../server/services/pdfVerifier.js';

describe('Document Pagination & Reflow Benchmark Tests', () => {
  /**
   * Helper to generate realistic simulated academic lecture notes
   * with headings, formulas, tables, and page markers.
   */
  function generateAcademicDocument(pageCount) {
    const pages = [];
    for (let p = 1; p <= pageCount; p++) {
      pages.push(`--- Page ${p} ---
# Module 5 - Section ${p}: Advanced Data Structures & Analysis

## ${p}.1 Theoretical Foundations
In this section we analyze recurrence relations, memory complexity, and cache coherence for distributed systems.
Every algorithm in this family satisfies the master theorem condition with strict asymptotic bounds.

$$
T(n) = 2 T\\left(\\frac{n}{2}\\right) + \\Theta(n)
$$

### Asymptotic Analysis Table
| Operation | Average Case | Worst Case | Memory |
|---|---|---|---|
| Search | O(log n) | O(n) | O(1) |
| Insertion | O(log n) | O(log n) | O(n) |
| Deletion | O(log n) | O(n) | O(1) |

> Note: When implementing lock-free data structures, ensure atomic compare-and-swap operations are bounded.

- Invariant 1: Root node must remain balanced.
- Invariant 2: Black-height condition is invariant across all rotations.
`);
    }
    return pages.join('\n\n');
  }

  test('DMS Module 5 (27 source pages): reflow mode prevents 2.5x explosion', async () => {
    const sourcePages = 27;
    const documentMarkdown = generateAcademicDocument(sourcePages);

    // Generate in clean-reflow mode
    const pdfBuffer = await createPdfBuffer('DMS Module 5 Lecture Notes', documentMarkdown, {
      pageMode: 'clean-reflow',
      sourcePageCount: sourcePages
    });

    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.pageCount > 0);

    // Verify page count: previously 27 pages became 69 pages (2.56x)
    // With clean reflow and soft dividers, 27 pages should reflow tightly into <= 32 pages (< 1.2x)
    assert.ok(
      pdfBuffer.pageCount <= 32,
      `Expected output pages <= 32, but got ${pdfBuffer.pageCount} (ratio: ${pdfBuffer.expansionRatio}x)`
    );

    // Run verification gate
    const verification = await verifyPdfBuffer(pdfBuffer, {
      sourcePageCount: sourcePages,
      pageMode: 'clean-reflow'
    });

    assert.strictEqual(verification.isValid, true);
    assert.strictEqual(verification.status, 'pass');
    assert.ok(verification.expansionRatio <= 1.35);
  });

  test('5-page document: page count scales dynamically with content density', async () => {
    const sourcePages = 5;
    const documentMarkdown = generateAcademicDocument(sourcePages);

    const pdfBuffer = await createPdfBuffer('Short Document Notes', documentMarkdown, {
      pageMode: 'clean-reflow',
      sourcePageCount: sourcePages
    });

    assert.ok(pdfBuffer.pageCount > 0);
    // 5 pages should not explode into 15+ pages; should fit in <= 7 pages
    assert.ok(
      pdfBuffer.pageCount <= 7,
      `Expected output pages <= 7 for 5-page document, but got ${pdfBuffer.pageCount}`
    );

    const verification = await verifyPdfBuffer(pdfBuffer, {
      sourcePageCount: sourcePages,
      pageMode: 'clean-reflow'
    });

    assert.strictEqual(verification.isValid, true);
  });

  test('faithful mode preserves 1:1 page correspondence', async () => {
    const sourcePages = 4;
    // Short content per page that fits within each page
    const content = [
      '--- Page 1 ---\n# Page One\nContent for page 1.',
      '--- Page 2 ---\n# Page Two\nContent for page 2.',
      '--- Page 3 ---\n# Page Three\nContent for page 3.',
      '--- Page 4 ---\n# Page Four\nContent for page 4.'
    ].join('\n\n');

    const pdfBuffer = await createPdfBuffer('Faithful 1:1 Document', content, {
      pageMode: 'faithful',
      sourcePageCount: sourcePages
    });

    assert.strictEqual(pdfBuffer.pageCount, 4);

    const verification = await verifyPdfBuffer(pdfBuffer, {
      sourcePageCount: sourcePages,
      pageMode: 'faithful'
    });

    assert.strictEqual(verification.isValid, true);
    assert.strictEqual(verification.expansionRatio, 1.0);
  });
});
