import { runChunkedOCR } from '../services/chunkedOcrService.js';

export const handleChunkedOcr = async (req, res) => {
  try {
    console.log('Chunked OCR request received:', {
      hasDocument: !!req.body?.document,
      documentType: req.body?.document?.type,
      userId: req.user?.uid
    });

    const data = await runChunkedOCR(req.body, (progress) => {
      // Progress updates are logged but not sent to client yet
      // In future, this could be used with SSE or WebSocket
      console.log('Progress update:', progress);
    });

    console.log('Chunked OCR processing successful:', {
      textLength: data.text?.length,
      hasPdf: !!data.formatted_pdf,
      hasDocx: !!data.formatted_docx,
      totalPages: data.total_pages,
      pagesProcessed: data.pages_processed,
      userId: req.user?.uid
    });

    res.json(data);
  } catch (error) {
    console.error('Chunked OCR Error:', {
      message: error.message || error,
      status: error.status,
      data: error.data,
      stack: error.stack,
      userId: req.user?.uid
    });

    const statusCode = error.status || 500;
    const errorMessage = error.data?.error || error.message || 'Internal Server Error';

    res.status(statusCode).json({
      error: errorMessage,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV !== 'production' && {
        details: error.data,
        type: error.type
      })
    });
  }
};
