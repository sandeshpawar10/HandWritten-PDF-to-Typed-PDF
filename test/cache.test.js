import { test, describe } from 'node:test';
import assert from 'node:assert';
import { computePageCacheKey, clearOcrCache } from '../server/services/geminiOcrService.js';

describe('OCR Cache Tests', () => {
  test('should generate deterministic SHA-256 cache keys', () => {
    const dummyBuffer = Buffer.from('sample pdf document content');
    const key1 = computePageCacheKey(dummyBuffer, 1, 'v2.1_academic_ast');
    const key2 = computePageCacheKey(dummyBuffer, 1, 'v2.1_academic_ast');
    const keyPage2 = computePageCacheKey(dummyBuffer, 2, 'v2.1_academic_ast');

    assert.strictEqual(typeof key1, 'string');
    assert.strictEqual(key1.length, 64); // SHA-256 hex string length
    assert.strictEqual(key1, key2);
    assert.notStrictEqual(key1, keyPage2);
  });

  test('should produce different keys for different prompt versions', () => {
    const dummyBuffer = Buffer.from('sample pdf document content');
    const keyV1 = computePageCacheKey(dummyBuffer, 1, 'v1.0');
    const keyV2 = computePageCacheKey(dummyBuffer, 1, 'v2.1_academic_ast');

    assert.notStrictEqual(keyV1, keyV2);
  });

  test('should execute clearOcrCache without errors', () => {
    const result = clearOcrCache();
    assert.strictEqual(result.success, true);
  });
});
