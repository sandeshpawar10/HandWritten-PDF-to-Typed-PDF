import { test, describe } from 'node:test';
import assert from 'node:assert';
import { PDFDocument } from 'pdf-lib';
import { verifyPdfBuffer } from '../server/services/pdfVerifier.js';

describe('PDF Verifier Gate Tests', () => {
  async function createMockPdf(pageCount, width = 595.28, height = 841.89) {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      const page = doc.addPage([width, height]);
      page.drawText(`Sample content for page ${i + 1}`, { x: 50, y: 800, size: 12 });
    }
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  test('should pass verification when reflow page count is within budget', async () => {
    // 27 source pages producing 29 output pages (expansion ratio = 1.074x <= 1.35x)
    const pdfBuffer = await createMockPdf(29);
    const result = await verifyPdfBuffer(pdfBuffer, {
      sourcePageCount: 27,
      pageMode: 'clean-reflow',
      maxExpansionThreshold: 1.35
    });

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.status, 'pass');
    assert.strictEqual(result.pageCount, 29);
    assert.strictEqual(result.sourcePageCount, 27);
    assert.strictEqual(result.expansionRatio, 1.074);
    assert.strictEqual(result.warnings.length, 0);
  });

  test('should flag warning when reflow page count explodes beyond threshold', async () => {
    // 27 source pages exploding to 69 pages (expansion ratio = 2.556x > 1.35x)
    const pdfBuffer = await createMockPdf(69);
    const result = await verifyPdfBuffer(pdfBuffer, {
      sourcePageCount: 27,
      pageMode: 'clean-reflow',
      maxExpansionThreshold: 1.35
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.status, 'warning');
    assert.strictEqual(result.pageCount, 69);
    assert.strictEqual(result.expansionRatio, 2.556);
    assert.ok(result.warnings.length > 0);
    assert.ok(result.warnings[0].includes('Excessive pagination expansion'));
    assert.ok(result.recommendations.length > 0);
  });

  test('should verify dynamic page counts for any document length (e.g. 5 source pages)', async () => {
    // 5 source pages producing 6 output pages (1.20x)
    const pdfBuffer = await createMockPdf(6);
    const result = await verifyPdfBuffer(pdfBuffer, {
      sourcePageCount: 5,
      pageMode: 'clean-reflow',
      maxExpansionThreshold: 1.35
    });

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.expansionRatio, 1.2);
  });

  test('should enforce strict 1:1 page budget in faithful mode', async () => {
    // Exact match in faithful mode
    const exactBuffer = await createMockPdf(10);
    const passResult = await verifyPdfBuffer(exactBuffer, {
      sourcePageCount: 10,
      pageMode: 'faithful'
    });
    assert.strictEqual(passResult.isValid, true);

    // Mismatch in faithful mode
    const mismatchBuffer = await createMockPdf(12);
    const failResult = await verifyPdfBuffer(mismatchBuffer, {
      sourcePageCount: 10,
      pageMode: 'faithful'
    });
    assert.strictEqual(failResult.isValid, false);
    assert.ok(failResult.warnings.some(w => w.includes('Faithful mode page budget mismatch')));
  });

  test('should detect non-standard page dimensions', async () => {
    // Non-standard landscape/custom page
    const customBuffer = await createMockPdf(2, 400, 400);
    const result = await verifyPdfBuffer(customBuffer, {
      sourcePageCount: 2,
      pageMode: 'clean-reflow'
    });

    assert.strictEqual(result.isValid, false);
    assert.ok(result.warnings.some(w => w.includes('deviate from A4 standard')));
  });
});
