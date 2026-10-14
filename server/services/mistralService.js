import dotenv from 'dotenv';
dotenv.config(); // Load .env from root

const MISTRAL_OCR_URL  = "https://api.mistral.ai/v1/ocr";
const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";

// Validate API key on startup (Issue #9)
function getApiKey() {
  const key = process.env.MISTRAL_API_KEY;
  if (!key || key === 'your_mistral_api_key_here') {
    throw new Error(
      "MISTRAL_API_KEY is not configured in .env file.\n" +
      "Get your API key from: https://console.mistral.ai/\n" +
      "Copy .env.example to .env and add your key."
    );
  }
  return key;
}

// Validate on module load (Issue #9)
try {
  getApiKey();
  console.log('✓ Mistral API key configured');
} catch (error) {
  console.error('✗ ' + error.message);
  process.exit(1);
}

export const runMistralOCR = async (body) => {
  // Issue #12: Input validation
  if (!body || typeof body !== 'object') {
    throw {
      status: 400,
      data: { error: 'Invalid request: body must be an object' }
    };
  }

  if (!body.model || typeof body.model !== 'string') {
    throw {
      status: 400,
      data: { error: 'Invalid request: model is required and must be a string' }
    };
  }

  if (!body.document || typeof body.document !== 'object') {
    throw {
      status: 400,
      data: { error: 'Invalid request: document is required and must be an object' }
    };
  }

  const docType = body.document?.type;
  if (!['document_url', 'image_url'].includes(docType)) {
    throw {
      status: 400,
      data: { error: 'Invalid document type. Must be "document_url" or "image_url"' }
    };
  }

  try {
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
      // Issue #8: Better error messages
      console.error(`Mistral OCR API Error ${res.status}:`, errorData);
      throw {
        status: res.status,
        data: errorData.error || errorData.message || errorData || { error: `API returned ${res.status}` }
      };
    }

    return res.json();
  } catch (error) {
    // Re-throw structured errors
    if (error.status) throw error;

    // Network errors
    console.error('Mistral OCR network error:', error);
    throw {
      status: 503,
      data: { error: 'Failed to connect to Mistral API. Please try again.' }
    };
  }
};

export const runMistralChat = async (body) => {
  // Issue #12: Input validation
  if (!body || typeof body !== 'object') {
    throw {
      status: 400,
      data: { error: 'Invalid request: body must be an object' }
    };
  }

  if (!body.model || typeof body.model !== 'string') {
    throw {
      status: 400,
      data: { error: 'Invalid request: model is required and must be a string' }
    };
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    throw {
      status: 400,
      data: { error: 'Invalid request: messages must be a non-empty array' }
    };
  }

  // Validate message structure
  for (let i = 0; i < body.messages.length; i++) {
    const msg = body.messages[i];
    if (!msg.role || !msg.content) {
      throw {
        status: 400,
        data: { error: `Invalid message at index ${i}: must have role and content` }
      };
    }
    if (!['system', 'user', 'assistant'].includes(msg.role)) {
      throw {
        status: 400,
        data: { error: `Invalid role "${msg.role}" at index ${i}. Must be system, user, or assistant` }
      };
    }
  }

  try {
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
      // Issue #8: Better error messages
      console.error(`Mistral Chat API Error ${res.status}:`, errorData);
      throw {
        status: res.status,
        data: errorData.error || errorData.message || errorData || { error: `API returned ${res.status}` }
      };
    }

    return res.json();
  } catch (error) {
    // Re-throw structured errors
    if (error.status) throw error;

    // Network errors
    console.error('Mistral Chat network error:', error);
    throw {
      status: 503,
      data: { error: 'Failed to connect to Mistral API. Please try again.' }
    };
  }
};
