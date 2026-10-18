import { runGeminiOCR, clearOcrCache } from '../services/geminiOcrService.js';
import { getPoolTelemetry } from '../services/geminiPool.js';

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

export const handleClearCache = async (req, res) => {
  try {
    const result = clearOcrCache();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear cache', details: err.message });
  }
};

export const handlePoolStats = async (req, res) => {
  try {
    const stats = getPoolTelemetry();
    res.json({
      timestamp: new Date().toISOString(),
      slots: stats
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve telemetry', details: err.message });
  }
};
