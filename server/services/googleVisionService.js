import dotenv from 'dotenv';
dotenv.config(); // Load .env from root

const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

// Validate API key on startup
function getApiKey() {
  const key = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!key || key === 'your_google_api_key_here') {
    throw new Error(
      "GOOGLE_CLOUD_VISION_API_KEY is not configured.\n" +
      "Get your API key from: https://console.cloud.google.com/apis/credentials\n" +
      "Add your key to Render environment variables."
    );
  }
  return key;
}

// Validate on module load
try {
  getApiKey();
  console.log('✓ Google Cloud Vision API key configured');
} catch (error) {
  console.error('✗ ' + error.message);
  // Don't exit - allow Mistral to work as fallback
  console.warn('⚠️  Google Vision API not configured, will use Mistral if available');
}

/**
 * Run OCR using Google Cloud Vision API
 * @param {Object} body - Request body containing document data
 * @param {string} body.document.image_url - Base64 encoded image data (data:image/jpeg;base64,...)
 * @returns {Object} Response with OCR text
 */
export const runGoogleVisionOCR = async (body) => {
  // Input validation
  if (!body || typeof body !== 'object') {
    throw {
      status: 400,
      data: { error: 'Invalid request: body must be an object' }
    };
  }

  if (!body.document || typeof body.document !== 'object') {
    throw {
      status: 400,
      data: { error: 'Invalid request: document is required and must be an object' }
    };
  }

  // Extract base64 image data
  let base64Image = body.document.image_url || body.document.document_url;

  if (!base64Image) {
    throw {
      status: 400,
      data: { error: 'Invalid request: image_url or document_url is required' }
    };
  }

  // Remove data URL prefix if present (data:image/jpeg;base64,)
  if (base64Image.includes('base64,')) {
    base64Image = base64Image.split('base64,')[1];
  }

  try {
    // Prepare Google Vision API request
    const visionRequest = {
      requests: [
        {
          image: {
            content: base64Image
          },
          features: [
            {
              type: "DOCUMENT_TEXT_DETECTION", // Best for handwritten text
              maxResults: 1
            }
          ],
          imageContext: {
            languageHints: ["en"] // Add more languages as needed
          }
        }
      ]
    };

    const apiKey = getApiKey();
    const url = `${GOOGLE_VISION_URL}?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(visionRequest),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error(`Google Vision API Error ${res.status}:`, errorData);
      throw {
        status: res.status,
        data: errorData.error || errorData || { error: `API returned ${res.status}` }
      };
    }

    const data = await res.json();

    // Extract text from response
    const textAnnotations = data.responses?.[0]?.textAnnotations;
    const fullTextAnnotation = data.responses?.[0]?.fullTextAnnotation;

    if (!textAnnotations || textAnnotations.length === 0) {
      // No text detected
      return {
        pages: [
          {
            markdown: "",
            text: "No text detected in image"
          }
        ]
      };
    }

    // The first annotation contains the full detected text
    const detectedText = textAnnotations[0]?.description || "";

    // Format response to match expected structure
    return {
      pages: [
        {
          markdown: detectedText,
          text: detectedText,
          confidence: fullTextAnnotation?.pages?.[0]?.confidence || 0.9
        }
      ]
    };

  } catch (error) {
    // Re-throw structured errors
    if (error.status) throw error;

    // Network errors
    console.error('Google Vision API network error:', error);
    throw {
      status: 503,
      data: { error: 'Failed to connect to Google Vision API. Please try again.' }
    };
  }
};

/**
 * Process multi-page PDF using Google Vision
 * @param {Array} pages - Array of base64 encoded page images
 * @returns {Object} Combined OCR results
 */
export const runGoogleVisionMultiPage = async (pages) => {
  const results = [];

  for (let i = 0; i < pages.length; i++) {
    const pageResult = await runGoogleVisionOCR({
      document: {
        image_url: pages[i]
      }
    });

    results.push({
      page: i + 1,
      ...pageResult.pages[0]
    });
  }

  return {
    pages: results
  };
};
