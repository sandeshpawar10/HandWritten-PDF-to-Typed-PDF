import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getPythonCommand = () => {
  return process.platform === 'win32' ? 'python' : 'python3';
};

/**
 * Run chunked OCR processing with progress callbacks
 * @param {Object} body - Request body with document data
 * @param {Function} onProgress - Progress callback function
 * @returns {Object} Response with formatted PDF and DOCX
 */
export const runChunkedOCR = async (body, onProgress) => {
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
    const pythonScript = join(__dirname, '..', 'ocr_paddle_chunked.py');
    const pythonCmd = getPythonCommand();

    console.log('Starting chunked OCR process:', {
      script: pythonScript,
      command: pythonCmd,
      imageSize: base64Image.length,
      timestamp: new Date().toISOString()
    });

    const python = spawn(pythonCmd, [pythonScript], {
      timeout: 600000, // 10 minutes for large PDFs
      maxBuffer: 100 * 1024 * 1024 // 100MB buffer
    });

    let stdout = '';
    let stderr = '';
    let processTimedOut = false;

    const timeoutId = setTimeout(() => {
      processTimedOut = true;
      python.kill('SIGTERM');
      console.error('Chunked OCR process timed out after 10 minutes');
    }, 600000);

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;

      // Parse progress updates from stderr
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const progress = JSON.parse(line);

          if (progress.type === 'progress') {
            // Call progress callback with update
            onProgress?.({
              current: progress.current_page,
              total: progress.total_pages,
              percent: progress.percent,
              message: progress.message
            });

            console.log(`Progress: ${progress.current_page}/${progress.total_pages} (${progress.percent}%)`);
          }
        } catch {
          // Not a JSON progress update, it's probably download progress or other stderr
          // Ignore download progress bars and PaddleOCR initialization messages
          if (!line.includes('download') && !line.includes('iB/s') && !line.includes('%|')) {
            // Log non-progress stderr for debugging
            // console.log('Python stderr:', line);
          }
        }
      }
    });

    python.on('close', (code) => {
      clearTimeout(timeoutId);

      console.log('Chunked OCR process closed:', {
        code,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
        timedOut: processTimedOut
      });

      if (processTimedOut) {
        reject({
          status: 504,
          data: {
            error: 'Processing timed out after 10 minutes. Please split your document into smaller files.',
            type: 'TIMEOUT'
          }
        });
        return;
      }

      if (code !== 0) {
        console.error('Chunked OCR error:', {
          code,
          stderr: stderr.substring(0, 1000),
          stdout: stdout.substring(0, 1000)
        });

        // Try to extract only JSON errors from stderr (ignore download progress)
        let errorData = null;
        try {
          const stderrLines = stderr.split('\n').filter(l => l.trim());
          // Find the last line that looks like JSON and is not a progress update
          for (let i = stderrLines.length - 1; i >= 0; i--) {
            const line = stderrLines[i];
            if (line.startsWith('{') && !line.includes('"type": "progress"')) {
              errorData = JSON.parse(line);
              break;
            }
          }
        } catch {
          // Could not parse JSON error
        }

        if (errorData) {
          reject({
            status: 500,
            data: {
              error: `Processing failed: ${errorData.error || 'Unknown error'}`,
              type: errorData.type || 'PROCESSING_ERROR',
              details: errorData
            }
          });
        } else {
          let errorMsg = 'Document processing failed';

          if (stderr.includes('ModuleNotFoundError')) {
            errorMsg = 'Required Python packages not installed. Please contact support.';
          } else if (stderr.includes('OutOfMemoryError') || stderr.includes('MemoryError')) {
            errorMsg = 'Server out of memory. Please try a smaller document.';
          } else if (stderr.includes('download') && stderr.includes('tar')) {
            errorMsg = 'OCR models are being downloaded. Please try again in 1-2 minutes.';
          } else if (stderr) {
            // Find the actual error line (not progress bars)
            const errorLines = stderr.split('\n').filter(l =>
              l.trim() &&
              !l.includes('download') &&
              !l.includes('iB/s') &&
              !l.includes('%|') &&
              !l.startsWith('{')
            );
            if (errorLines.length > 0) {
              const firstError = errorLines[errorLines.length - 1];
              errorMsg = `Processing error: ${firstError.substring(0, 100)}`;
            }
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
              error: 'No output from processing service',
              type: 'EMPTY_OUTPUT'
            }
          });
          return;
        }

        const result = JSON.parse(stdout);

        console.log('Chunked OCR success:', {
          textLength: result.text?.length,
          hasPdf: !!result.formatted_pdf,
          hasDocx: !!result.formatted_docx,
          totalPages: result.total_pages,
          pagesProcessed: result.pages_processed
        });

        resolve(result);
      } catch (error) {
        console.error('Failed to parse chunked OCR output:', {
          error: error.message,
          stdoutPreview: stdout.substring(0, 200)
        });
        reject({
          status: 500,
          data: {
            error: 'Failed to parse processing results.',
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

      let errorMsg = 'Processing service unavailable';

      if (error.code === 'ENOENT') {
        errorMsg = 'Python is not installed on the server. Please contact support.';
      } else {
        errorMsg = `Failed to start processing service: ${error.message}`;
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
          error: `Failed to send data to processing service: ${error.message}`,
          type: 'STDIN_ERROR'
        }
      });
    }
  });
};
