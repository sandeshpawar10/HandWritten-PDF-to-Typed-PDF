import { runChunkedOCR } from '../services/chunkedOcrService.js';

export const handleChunkedOcr = async (req, res) => {
  console.log('Chunked OCR request received:', {
    hasDocument: !!req.body?.document,
    documentType: req.body?.document?.type,
    userId: req.user?.uid
  });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx/proxy buffering
  res.flushHeaders();

  try {
    const data = await runChunkedOCR(req.body, (progress) => {
      // Stream progress to client via SSE
      res.write(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`);
    });

    console.log('Chunked OCR processing successful:', {
      textLength: data.text?.length,
      hasPdf: !!data.formatted_pdf,
      hasDocx: !!data.formatted_docx,
      totalPages: data.total_pages,
      pagesProcessed: data.pages_processed,
      userId: req.user?.uid
    });

    // Send final result
    res.write(`data: ${JSON.stringify({ type: 'result', ...data })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Chunked OCR Error:', error);
    const statusCode = error.status || 500;
    const errorMessage = error.data?.error || error.message || 'Internal Server Error';

    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      error: errorMessage,
      status: statusCode,
      errorType: error.data?.type || error.type
    })}\n\n`);
    res.end();
  }
};
