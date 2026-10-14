import { runGoogleVisionOCR } from '../services/googleVisionService.js';

export const handleOcr = async (req, res) => {
  try {
    // Use Google Vision API for OCR (better accuracy and free tier)
    const data = await runGoogleVisionOCR(req.body);
    res.json(data);
  } catch (error) {
    console.error('OCR Proxy Error:', error);
    res.status(error.status || 500).json(error.data || { error: 'Internal Server Error' });
  }
};
