/**
 * server/services/pdfVerifier.js
 * Post-generation PDF verification gate.
 * Validates output page counts against source page budgets, detects excessive expansion,
 * checks page dimensions, and flags anomalies.
 */

import { PDFDocument } from 'pdf-lib';

/**
 * Verify a generated PDF buffer against source expectations and quality constraints.
 * 
 * @param {Buffer|Uint8Array} pdfBuffer - The PDF binary to inspect.
 * @param {Object} options - Verification options.
 * @param {number} [options.sourcePageCount] - Expected source document page count (N).
 * @param {'clean-reflow'|'faithful'|'preserve-source-pages'} [options.pageMode='clean-reflow'] - The generation mode used.
 * @param {number} [options.maxExpansionThreshold=1.35] - Max allowed expansion factor in reflow mode before alerting.
 * @returns {Promise<Object>} Detailed verification metrics and warnings.
 */
export async function verifyPdfBuffer(pdfBuffer, options = {}) {
  const {
    sourcePageCount = null,
    pageMode = 'clean-reflow',
    maxExpansionThreshold = 1.35
  } = options;

  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) && !(pdfBuffer instanceof Uint8Array)) {
    throw new Error('verifyPdfBuffer: Expected a valid Buffer or Uint8Array.');
  }

  const loadedDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const outputPageCount = loadedDoc.getPageCount();
  const pages = loadedDoc.getPages();

  const warnings = [];
  let expansionRatio = null;

  if (sourcePageCount && typeof sourcePageCount === 'number' && sourcePageCount > 0) {
    expansionRatio = Number((outputPageCount / sourcePageCount).toFixed(3));

    if (pageMode === 'clean-reflow') {
      if (expansionRatio > maxExpansionThreshold) {
        warnings.push(
          `Excessive pagination expansion: ${outputPageCount} output pages for ${sourcePageCount} source pages ` +
          `(${expansionRatio}x vs max allowed ${maxExpansionThreshold}x).`
        );
      }
    } else if (pageMode === 'faithful') {
      if (outputPageCount !== sourcePageCount) {
        warnings.push(
          `Faithful mode page budget mismatch: Expected exactly ${sourcePageCount} page(s), but got ${outputPageCount} page(s) ` +
          `(${expansionRatio}x).`
        );
      }
    }
  }

  // Check page dimension consistency
  const standardWidth = 595.28; // A4 standard pt
  const standardHeight = 841.89;
  for (let i = 0; i < pages.length; i++) {
    const { width, height } = pages[i].getSize();
    if (Math.abs(width - standardWidth) > 5 || Math.abs(height - standardHeight) > 5) {
      warnings.push(`Page ${i + 1} dimensions (${width.toFixed(1)}x${height.toFixed(1)}) deviate from A4 standard.`);
    }
  }

  const isValid = warnings.length === 0;
  const recommendations = [];

  if (!isValid) {
    if (pageMode === 'clean-reflow') {
      recommendations.push('Switch to soft page dividers or tighten line-height/margins to suppress overflow cascades.');
    } else if (pageMode === 'faithful') {
      recommendations.push('Adjust font scale or tighten math block vertical padding to fit within the 1:1 page budget.');
    }
  }

  return {
    isValid,
    status: isValid ? 'pass' : 'warning',
    pageCount: outputPageCount,
    sourcePageCount,
    expansionRatio,
    pageMode,
    byteSize: pdfBuffer.length,
    warnings,
    recommendations
  };
}
