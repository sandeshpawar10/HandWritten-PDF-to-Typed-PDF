import { runGoogleVisionOCR } from '../services/googleVisionService.js';
import { runMistralChat } from '../services/mistralService.js';

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

export const handleChat = async (req, res) => {
  try {
    // Still use Mistral for chat/formatting (can be replaced with OpenAI later)
    const data = await runMistralChat(req.body);
    res.json(data);
  } catch (error) {
    console.error('Chat Proxy Error:', error);
    res.status(error.status || 500).json(error.data || { error: 'Internal Server Error' });
  }
};
