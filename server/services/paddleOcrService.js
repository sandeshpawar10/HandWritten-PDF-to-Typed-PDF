import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine which Python command to use
const getPythonCommand = () => {
  // Try python3 first (most common on Linux/Mac)
  // Fall back to python (Windows or systems with python3 aliased)
  return process.platform === 'win32' ? 'python' : 'python3';
};

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
    const pythonCmd = getPythonCommand();

    console.log('Starting PaddleOCR process:', {
      script: pythonScript,
      command: pythonCmd,
      imageSize: base64Image.length,
      timestamp: new Date().toISOString()
    });

    // Spawn Python process with timeout
    const python = spawn(pythonCmd, [pythonScript], {
      timeout: 120000, // 2 minutes
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large responses
    });

    let stdout = '';
    let stderr = '';
    let processTimedOut = false;

    // Set a manual timeout
    const timeoutId = setTimeout(() => {
      processTimedOut = true;
      python.kill('SIGTERM');
      console.error('PaddleOCR process timed out after 2 minutes');
    }, 120000);

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
      clearTimeout(timeoutId);

      console.log('PaddleOCR process closed:', {
        code,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
        timedOut: processTimedOut
      });

      if (processTimedOut) {
        reject({
          status: 504,
          data: {
            error: 'OCR processing timed out. The image may be too large or complex. Please try a smaller image or split the document into multiple pages.',
            type: 'TIMEOUT'
          }
        });
        return;
      }

      if (code !== 0) {
        console.error('PaddleOCR Python script error:', {
          code,
          stderr: stderr.substring(0, 500), // Log first 500 chars
          stdout: stdout.substring(0, 500)
        });

        try {
          const errorData = JSON.parse(stderr);
          reject({
            status: 500,
            data: {
              error: `OCR processing failed: ${errorData.error || 'Unknown error'}`,
              type: errorData.type || 'PROCESSING_ERROR',
              details: errorData
            }
          });
        } catch {
          // If stderr is not JSON, provide helpful error message
          let errorMsg = 'OCR processing failed';

          if (stderr.includes('ModuleNotFoundError') || stderr.includes('No module named')) {
            errorMsg = 'PaddleOCR dependencies not installed on server. Please contact support.';
          } else if (stderr.includes('OutOfMemoryError') || stderr.includes('MemoryError')) {
            errorMsg = 'Server out of memory. Please try a smaller image or contact support.';
          } else if (stderr.toLowerCase().includes('paddlepaddle')) {
            errorMsg = 'PaddlePaddle runtime error. Please try again or contact support.';
          } else if (stderr) {
            // Include first line of stderr for debugging
            const firstLine = stderr.split('\n')[0];
            errorMsg = `OCR error: ${firstLine.substring(0, 100)}`;
          }

          reject({
            status: 500,
            data: {
              error: errorMsg,
              type: 'PYTHON_ERROR'
            }
          });
        }
        return;
      }

      try {
        if (!stdout || stdout.trim().length === 0) {
          reject({
            status: 500,
            data: {
              error: 'No output from OCR service',
              type: 'EMPTY_OUTPUT'
            }
          });
          return;
        }

        const result = JSON.parse(stdout);

        console.log('PaddleOCR success:', {
          pages: result.pages?.length,
          confidence: result.pages?.[0]?.confidence
        });

        resolve(result);
      } catch (error) {
        console.error('Failed to parse PaddleOCR output:', {
          error: error.message,
          stdoutPreview: stdout.substring(0, 200)
        });
        reject({
          status: 500,
          data: {
            error: 'Failed to parse OCR results. The service may be misconfigured.',
            type: 'PARSE_ERROR'
          }
        });
      }
    });

    // Handle spawn errors
    python.on('error', (error) => {
      clearTimeout(timeoutId);
      console.error('Failed to spawn Python process:', {
        error: error.message,
        code: error.code,
        command: pythonCmd
      });

      let errorMsg = 'OCR service unavailable';

      if (error.code === 'ENOENT') {
        errorMsg = 'Python is not installed or not found on the server. Please contact support.';
      } else {
        errorMsg = `Failed to start OCR service: ${error.message}`;
      }

      reject({
        status: 503,
        data: {
          error: errorMsg,
          type: 'SPAWN_ERROR',
          code: error.code
        }
      });
    });

    // Send input data to Python script
    try {
      const input = JSON.stringify({ image: base64Image });
      python.stdin.write(input);
      python.stdin.end();
    } catch (error) {
      clearTimeout(timeoutId);
      python.kill();
      reject({
        status: 500,
        data: {
          error: `Failed to send data to OCR service: ${error.message}`,
          type: 'STDIN_ERROR'
        }
      });
    }
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
