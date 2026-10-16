import { runGeminiOCR } from '../services/geminiOcrService.js';

export const handleOcr = async (req, res) => {
  try {
    console.log('Gemini OCR request received:', {
      hasDocument: !!req.body?.document,
      documentType: req.body?.document?.type,
      userId: req.user?.uid
    });

    const data = await runGeminiOCR(req.body);

    console.log('Gemini OCR processing successful:', {
      totalPages: data.total_pages,
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
      type: error.data?.type || error.type,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV !== 'production' && {
        details: error.data,
      })
    });
  }
};
