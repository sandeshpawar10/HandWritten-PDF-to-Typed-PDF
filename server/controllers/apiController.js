import { runPaddleOCR } from '../services/paddleOcrService.js';

export const handleOcr = async (req, res) => {
  try {
    console.log('OCR request received:', {
      hasDocument: !!req.body?.document,
      documentType: req.body?.document?.type,
      userId: req.user?.uid
    });

    const data = await runPaddleOCR(req.body);

    console.log('OCR processing successful:', {
      pages: data.pages?.length,
      userId: req.user?.uid
    });

    res.json(data);
  } catch (error) {
    console.error('OCR Proxy Error:', {
      message: error.message || error,
      status: error.status,
      data: error.data,
      stack: error.stack,
      userId: req.user?.uid
    });

    // Return more specific error information
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
