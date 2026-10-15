import { runPaddleOCR } from '../services/paddleOcrService.js';

export const handleOcr = async (req, res) => {
  try {
    const data = await runPaddleOCR(req.body);
    res.json(data);
  } catch (error) {
    console.error('OCR Proxy Error:', error);
    res.status(error.status || 500).json(error.data || { error: 'Internal Server Error' });
  }
};
