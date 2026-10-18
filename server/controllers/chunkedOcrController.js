import { runGeminiOCR } from '../services/geminiOcrService.js';

export const handleChunkedOcr = async (req, res) => {
  console.log('Gemini OCR request received:', {
    hasDocument: !!req.body?.document,
    documentType: req.body?.document?.type,
    userId: req.user?.uid
  });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx/proxy buffering
  res.setHeader('Content-Encoding', 'none'); // Explicitly prevent compression
  res.flushHeaders();

  const sendSse = (data) => {
    if (!clientDisconnected && !res.writableEnded) {
      res.write(data);
      if (typeof res.flush === 'function') {
        res.flush();
      }
    }
  };

  // Keep-alive heartbeat every 10s to prevent proxy/Render idle timeouts
  const heartbeat = setInterval(() => {
    sendSse(': heartbeat\n\n');
  }, 10000);

  // Track client disconnection
  let clientDisconnected = false;
  req.on('close', () => {
    clientDisconnected = true;
    clearInterval(heartbeat);
  });

  try {
    const data = await runGeminiOCR(req.body, (progress) => {
      // Stream progress to client via SSE
      sendSse(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`);
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
    sendSse(`data: ${JSON.stringify({ type: 'result', ...data })}\n\n`);
    if (!res.writableEnded) {
      res.end();
    }
  } catch (error) {
    console.error('Chunked OCR Error:', error);
    const statusCode = error.status || 500;
    const errorMessage = error.data?.error || error.message || 'Internal Server Error';

    sendSse(`data: ${JSON.stringify({ 
      type: 'error', 
      error: errorMessage,
      status: statusCode,
      errorType: error.data?.type || error.type
    })}\n\n`);
    if (!res.writableEnded) {
      res.end();
    }
  } finally {
    clearInterval(heartbeat);
  }
};
