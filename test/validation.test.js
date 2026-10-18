import { test, describe } from 'node:test';
import assert from 'node:assert';
import { validateMagicBytes, parseBase64Payload, LIMITS } from '../server/utils/validation.js';

describe('Validation Utility Tests', () => {
  test('should validate PDF magic bytes correctly (%PDF)', () => {
    const pdfBuffer = Buffer.from('%PDF-1.7 header content here');
    const result = validateMagicBytes(pdfBuffer);
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.detectedMime, 'application/pdf');
  });

  test('should validate JPEG magic bytes correctly (FF D8 FF)', () => {
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    const result = validateMagicBytes(jpegBuffer);
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.detectedMime, 'image/jpeg');
  });

  test('should validate PNG magic bytes correctly (89 50 4E 47)', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const result = validateMagicBytes(pngBuffer);
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.detectedMime, 'image/png');
  });

  test('should reject invalid or corrupt bytes', () => {
    const corruptBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    const result = validateMagicBytes(corruptBuffer);
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.detectedMime, null);
  });

  test('should parse valid base64 data-URL with PDF', () => {
    const rawPdf = Buffer.from('%PDF-1.4 test content');
    const dataUrl = `data:application/pdf;base64,${rawPdf.toString('base64')}`;
    const parsed = parseBase64Payload(dataUrl);

    assert.strictEqual(parsed.mimeType, 'application/pdf');
    assert.strictEqual(parsed.buffer.subarray(0, 4).toString(), '%PDF');
  });

  test('should throw 413 error if payload exceeds MAX_FILE_SIZE_BYTES', () => {
    // Simulate exceeding limit by mocking a small limit test
    const largeLength = LIMITS.MAX_FILE_SIZE_BYTES + 1024;
    const fakeBase64 = 'A'.repeat(Math.ceil((largeLength * 4) / 3));

    assert.throws(
      () => parseBase64Payload(`data:application/pdf;base64,${fakeBase64}`),
      (err) => err.status === 413 && err.data?.type === 'PAYLOAD_TOO_LARGE'
    );
  });

  test('should throw 422 for unsupported media format', () => {
    const textBuffer = Buffer.from('This is a plain text file not a PDF or image');
    const dataUrl = `data:text/plain;base64,${textBuffer.toString('base64')}`;

    assert.throws(
      () => parseBase64Payload(dataUrl),
      (err) => err.status === 422 && err.data?.type === 'UNSUPPORTED_MEDIA_TYPE'
    );
  });
});
