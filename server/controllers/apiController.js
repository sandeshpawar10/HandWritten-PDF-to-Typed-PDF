import { runMistralOCR, runMistralChat } from '../services/mistralService.js';

export const handleOcr = async (req, res) => {
  try {
    const data = await runMistralOCR(req.body);
    res.json(data);
  } catch (error) {
    console.error('OCR Proxy Error:', error);
    res.status(error.status || 500).json(error.data || { error: 'Internal Server Error' });
  }
};

export const handleChat = async (req, res) => {
  try {
    const data = await runMistralChat(req.body);
    res.json(data);
  } catch (error) {
    console.error('Chat Proxy Error:', error);
    res.status(error.status || 500).json(error.data || { error: 'Internal Server Error' });
  }
};
