import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getPythonCommand = () => {
  return process.platform === 'win32' ? 'python' : 'python3';
};

/**
 * Run OCR with formatted document generation (PDF + DOCX)
 * @param {Object} body - Request body with document data
 * @returns {Object} Response with formatted PDF and DOCX
 */
export const runFormattedOCR = async (body) => {
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
      data: { error: 'Invalid request: document is required' }
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

  // Remove data URL prefix
  if (base64Image.includes('base64,')) {
    base64Image = base64Image.split('base64,')[1];
  }

  return new Promise((resolve, reject) => {
    const pythonScript = join(__dirname, '..', 'ocr_paddle_formatted.py');
    const pythonCmd = getPythonCommand();

    console.log('Starting formatted OCR process:', {
      script: pythonScript,
      command: pythonCmd,
      imageSize: base64Image.length,
      timestamp: new Date().toISOString()
    });

    const python = spawn(pythonCmd, [pythonScript], {
      timeout: 300000 // 5 minutes
    });

    python.stdin.on('error', (err) => {
      console.error('Python stdin error (handled):', err.message);
    });

    let stdout = '';
    let stderr = '';
    let processTimedOut = false;

    const timeoutId = setTimeout(() => {
      processTimedOut = true;
      python.kill('SIGTERM');
      console.error('Formatted OCR process timed out');
    }, 300000);

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      clearTimeout(timeoutId);

      console.log('Formatted OCR process closed:', {
        code,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
        timedOut: processTimedOut
      });

      if (processTimedOut) {
        reject({
          status: 504,
          data: {
            error: 'Document formatting timed out. Please try a smaller document.',
            type: 'TIMEOUT'
          }
        });
        return;
      }

      if (code !== 0) {
        console.error('Formatted OCR error:', {
          code,
          stderr: stderr.substring(0, 500),
          stdout: stdout.substring(0, 500)
        });

        try {
          const errorData = JSON.parse(stderr);
          reject({
            status: 500,
            data: {
              error: `Document formatting failed: ${errorData.error || 'Unknown error'}`,
              type: errorData.type || 'PROCESSING_ERROR',
              details: errorData
            }
          });
        } catch {
          let errorMsg = 'Document formatting failed';

          if (stderr.includes('ModuleNotFoundError')) {
            errorMsg = 'Required Python packages not installed. Please contact support.';
          } else if (stderr.includes('OutOfMemoryError') || stderr.includes('MemoryError')) {
            errorMsg = 'Server out of memory. Please try a smaller document.';
          } else if (stderr) {
            const firstLine = stderr.split('\n')[0];
            errorMsg = `Formatting error: ${firstLine.substring(0, 100)}`;
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
              error: 'No output from formatting service',
              type: 'EMPTY_OUTPUT'
            }
          });
          return;
        }

        const result = JSON.parse(stdout);

        console.log('Formatted OCR success:', {
          textLength: result.text?.length,
          hasPdf: !!result.formatted_pdf,
          hasDocx: !!result.formatted_docx,
          pageCount: result.page_count
        });

        resolve(result);
      } catch (error) {
        console.error('Failed to parse formatted OCR output:', {
          error: error.message,
          stdoutPreview: stdout.substring(0, 200)
        });
        reject({
          status: 500,
          data: {
            error: 'Failed to parse formatting results.',
            type: 'PARSE_ERROR'
          }
        });
      }
    });

    python.on('error', (error) => {
      clearTimeout(timeoutId);
      console.error('Failed to spawn Python process:', {
        error: error.message,
        code: error.code,
        command: pythonCmd
      });

      let errorMsg = 'Formatting service unavailable';

      if (error.code === 'ENOENT') {
        errorMsg = 'Python is not installed on the server. Please contact support.';
      } else {
        errorMsg = `Failed to start formatting service: ${error.message}`;
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

    // Send input to Python
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
          error: `Failed to send data to formatting service: ${error.message}`,
          type: 'STDIN_ERROR'
        }
      });
    }
  });
};
