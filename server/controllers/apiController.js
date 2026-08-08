import { runGeminiOCR } from '../services/geminiService.js';

export const handleOcr = async (req, res) => {
  try {
    const data = await runGeminiOCR(req.body);
    res.json(data);
  } catch (error) {
    console.error('Gemini OCR Proxy Error:', error);
    res.status(error.status || 500).json(error.data || { error: 'Internal Server Error', message: error.message });
  }
};
