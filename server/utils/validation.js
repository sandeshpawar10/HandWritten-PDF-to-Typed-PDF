/**
 * server/utils/validation.js
 * Centralized input validation, magic-byte inspection, and resource bounds.
 */

// Shared limits policy
export const LIMITS = {
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024, // 25 MB
  MAX_PAGE_COUNT: 100,
  MAX_IMAGE_WIDTH: 8000,
  MAX_IMAGE_HEIGHT: 8000,
  MAX_IMAGE_PIXELS: 8000 * 8000,
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]
};

/**
 * Validate magic bytes of a buffer against expected file types.
 * @param {Buffer} buffer 
 * @returns {{ isValid: boolean, detectedMime: string|null }}
 */
export function validateMagicBytes(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
    return { isValid: false, detectedMime: null };
  }

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { isValid: true, detectedMime: 'application/pdf' };
  }

  // JPEG: FF D8 FF
  if (
    buffer[0] === 0xFF &&
    buffer[1] === 0xD8 &&
    buffer[2] === 0xFF
  ) {
    return { isValid: true, detectedMime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { isValid: true, detectedMime: 'image/png' };
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { isValid: true, detectedMime: 'image/webp' };
  }

  return { isValid: false, detectedMime: null };
}

/**
 * Parse data-url or base64 string safely.
 * @param {string} rawData
 * @returns {{ mimeType: string, buffer: Buffer }}
 */
export function parseBase64Payload(rawData) {
  if (!rawData || typeof rawData !== 'string') {
    throw {
      status: 400,
      data: { error: 'Document data must be a non-empty string.', type: 'INVALID_PAYLOAD' }
    };
  }

  let mimeType = 'image/jpeg';
  let cleanData = rawData;

  if (rawData.startsWith('data:')) {
    const match = rawData.match(/^data:([^;]+);base64,/);
    if (match) {
      mimeType = match[1].toLowerCase();
      cleanData = rawData.split('base64,')[1];
    }
  }

  // Estimate decoded byte size before decoding to avoid memory bombs
  const estimatedBytes = Math.ceil((cleanData.length * 3) / 4);
  if (estimatedBytes > LIMITS.MAX_FILE_SIZE_BYTES) {
    throw {
      status: 413,
      data: {
        error: `Payload size exceeds maximum allowed limit of ${LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
        type: 'PAYLOAD_TOO_LARGE',
        maxBytes: LIMITS.MAX_FILE_SIZE_BYTES,
        actualBytes: estimatedBytes
      }
    };
  }

  const buffer = Buffer.from(cleanData, 'base64');
  if (buffer.length === 0) {
    throw {
      status: 400,
      data: { error: 'Payload decoded to an empty byte buffer.', type: 'EMPTY_FILE' }
    };
  }

  // Verify magic bytes
  const { isValid, detectedMime } = validateMagicBytes(buffer);
  if (!isValid || !LIMITS.ALLOWED_MIME_TYPES.includes(detectedMime)) {
    throw {
      status: 422,
      data: {
        error: `Invalid or unsupported file format. Detected: ${detectedMime || 'unknown'}. Allowed: ${LIMITS.ALLOWED_MIME_TYPES.join(', ')}`,
        type: 'UNSUPPORTED_MEDIA_TYPE'
      }
    };
  }

  return {
    mimeType: detectedMime || mimeType,
    buffer
  };
}
