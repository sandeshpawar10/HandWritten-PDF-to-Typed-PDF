import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run OCR using PaddleOCR via Python subprocess
 * @param {Object} body - Request body containing document data
 * @param {string} body.document.image_url - Base64 encoded image data (data:image/jpeg;base64,...)
 * @returns {Object} Response with OCR text
 */
export const runPaddleOCR = async (body) => {
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

  return new Promise((resolve, reject) => {
    const pythonScript = join(__dirname, '..', 'ocr_paddle.py');

    // Spawn Python process
    const python = spawn('python3', [pythonScript]);

    let stdout = '';
    let stderr = '';

    // Collect stdout
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Collect stderr
    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle process completion
    python.on('close', (code) => {
      if (code !== 0) {
        console.error('PaddleOCR Python script error:', stderr);

        try {
          const errorData = JSON.parse(stderr);
          reject({
            status: 500,
            data: { error: `PaddleOCR failed: ${errorData.error}` }
          });
        } catch {
          reject({
            status: 500,
            data: { error: 'PaddleOCR failed with unknown error' }
          });
        }
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (error) {
        console.error('Failed to parse PaddleOCR output:', stdout);
        reject({
          status: 500,
          data: { error: 'Failed to parse OCR results' }
        });
      }
    });

    // Handle spawn errors
    python.on('error', (error) => {
      console.error('Failed to spawn Python process:', error);
      reject({
        status: 503,
        data: { error: 'PaddleOCR service unavailable. Python not installed.' }
      });
    });

    // Send input data to Python script
    const input = JSON.stringify({ image: base64Image });
    python.stdin.write(input);
    python.stdin.end();
  });
};

/**
 * Process multi-page PDF using PaddleOCR
 * @param {Array} pages - Array of base64 encoded page images
 * @returns {Object} Combined OCR results
 */
export const runPaddleOCRMultiPage = async (pages) => {
  const results = [];

  for (let i = 0; i < pages.length; i++) {
    const pageResult = await runPaddleOCR({
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
