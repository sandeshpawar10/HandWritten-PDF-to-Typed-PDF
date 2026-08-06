import dotenv from 'dotenv';
dotenv.config(); // Load .env from root

const MISTRAL_OCR_URL  = "https://api.mistral.ai/v1/ocr";
const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";

function getApiKey() {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new Error("Server configuration error: MISTRAL_API_KEY is missing in .env");
  return key;
}

export const runMistralOCR = async (body) => {
  const res = await fetch(MISTRAL_OCR_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw { status: res.status, data: errorData };
  }

  return res.json();
};

export const runMistralChat = async (body) => {
  const res = await fetch(MISTRAL_CHAT_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw { status: res.status, data: errorData };
  }

  return res.json();
};
