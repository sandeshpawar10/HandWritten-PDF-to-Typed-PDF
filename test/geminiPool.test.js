import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getPool, maskKey, MODEL_TIERS } from '../server/services/geminiPool.js';

describe('Gemini Pool & Scheduler Tests', () => {
  const dummyKeys = ['AIzaSyDummyKeyNumberOne1111', 'AIzaSyDummyKeyNumberTwo2222'];

  test('should mask API keys properly for logs', () => {
    assert.strictEqual(maskKey('AIzaSyDummyKeyNumberOne1111'), '***1111');
    assert.strictEqual(maskKey(''), '****');
    assert.strictEqual(maskKey(null), '****');
  });

  test('should initialize KeyPool with correct slots', () => {
    const pool = getPool(dummyKeys);
    assert.ok(pool);
    assert.strictEqual(pool.slots.length, 2);
    assert.strictEqual(pool.slots[0].masked, '***1111');
    assert.strictEqual(pool.slots[1].masked, '***2222');
  });

  test('should acquire and release slots with in-flight tracking', async () => {
    const pool = getPool(dummyKeys);
    const slot1 = await pool.acquire('gemini-3.8-flash');
    assert.ok(slot1);
    assert.strictEqual(slot1.inFlight, 1);

    pool.release(slot1, 500, true);
    assert.strictEqual(slot1.inFlight, 0);
    assert.strictEqual(slot1.stats.succeeded, 1);
  });

  test('should track blocks independently per model without wiping other models', () => {
    const pool = getPool(dummyKeys);
    const slot = pool.slots[0];
    const modelA = 'gemini-3.8-flash';
    const modelB = 'gemini-3.5-flash';

    pool.block(slot, modelA, 10000, '429 rate limit');

    const now = Date.now();
    assert.strictEqual(pool.isKeyBlockedForModel(slot, modelA, now), true);
    // Crucial requirement from audit: key blocked on modelA MUST NOT block modelB!
    assert.strictEqual(pool.isKeyBlockedForModel(slot, modelB, now), false);
  });

  test('should export pool telemetry stats', () => {
    const pool = getPool(dummyKeys);
    const telemetry = pool.getTelemetry();
    assert.ok(Array.isArray(telemetry));
    assert.strictEqual(telemetry.length, 2);
    assert.ok('slotId' in telemetry[0]);
    assert.ok('dispatched' in telemetry[0]);
    assert.ok('avgLatencyMs' in telemetry[0]);
  });

  test('should have configured model tiers', () => {
    assert.ok(MODEL_TIERS.primary);
    assert.ok(MODEL_TIERS.fast);
    assert.ok(MODEL_TIERS.verify);
    assert.ok(MODEL_TIERS.fallback);
  });
});
