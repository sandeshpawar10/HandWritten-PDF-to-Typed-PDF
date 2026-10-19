/**
 * server/controllers/renderController.js
 * Controller for on-demand server-side PDF and document rendering.
 */

import { createPdfBuffer } from '../services/pdfExportService.js';
import { verifyPdfBuffer } from '../services/pdfVerifier.js';

/**
 * Handle POST /api/v1/render/pdf
 * Generates an authoritative server-side PDF with embedded TypedDoc metadata.
 */
export async function handleRenderPdf(req, res) {
  try {
    const {
      title = 'TypedDoc Document',
      content,
      pageMode = 'clean-reflow',
      sourcePageCount = null
    } = req.body || {};

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request: markdown "content" string is required.',
        type: 'INVALID_REQUEST'
      });
    }

    const safeTitle = (title || 'TypedDoc Document').replace(/[/\\?%*:|"<>]/g, '_').trim();

    const pdfBuffer = await createPdfBuffer(title, content, {
      pageMode,
      sourcePageCount: typeof sourcePageCount === 'number' ? sourcePageCount : null,
      compactTypography: true
    });

    let pdfVerification = null;
    try {
      pdfVerification = await verifyPdfBuffer(pdfBuffer, {
        sourcePageCount,
        pageMode
      });
    } catch (vErr) {
      console.warn('PDF verification warning during render:', vErr.message);
    }

    // Binary download if requested
    const wantsBinary = req.headers.accept === 'application/pdf' || req.query.format === 'binary';
    if (wantsBinary) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('X-TypedDoc-Creator', 'TypedDoc Server PDF Engine');
      res.setHeader('X-TypedDoc-Producer', 'TypedDoc PDF Renderer');
      res.setHeader('X-TypedDoc-Page-Count', String(pdfBuffer.pageCount));
      return res.send(pdfBuffer);
    }

    // Default JSON response with base64 payload & telemetry
    return res.json({
      success: true,
      formattedPdf: pdfBuffer.toString('base64'),
      pdfSource: 'server-pdf',
      renderer: 'pdf-lib',
      pageMode: pdfBuffer.pageMode,
      pageCount: pdfBuffer.pageCount,
      sourcePageCount: pdfBuffer.sourcePageCount,
      expansionRatio: pdfBuffer.expansionRatio,
      verification: pdfVerification
    });
  } catch (error) {
    console.error('Render PDF Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to render PDF.',
      type: 'RENDER_ERROR'
    });
  }
}
