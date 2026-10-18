import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rateLimiter, ocrRateLimiter } from '../middleware/rateLimit.js';
import { handleOcr, handleClearCache, handlePoolStats } from '../controllers/apiController.js';
import { handleFormattedOcr } from '../controllers/formattedOcrController.js';
import { handleChunkedOcr } from '../controllers/chunkedOcrController.js';

const router = express.Router();

// Apply authentication to all API routes first so req.user is available for rate limiting
router.use(requireAuth);

// Apply general rate limiting
router.use(rateLimiter);

// OCR endpoints with stricter rate limiting
router.post('/ocr', ocrRateLimiter, handleOcr);
router.post('/ocr/formatted', ocrRateLimiter, handleFormattedOcr);
router.post('/ocr/chunked', ocrRateLimiter, handleChunkedOcr);
router.delete('/ocr/cache', handleClearCache);
router.get('/ocr/stats', handlePoolStats);

export default router;
