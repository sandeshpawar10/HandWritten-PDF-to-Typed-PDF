import express from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { rateLimiter, ocrRateLimiter } from '../middleware/rateLimit.js';
import { handleOcr, handleClearCache, handlePoolStats } from '../controllers/apiController.js';
import { handleFormattedOcr } from '../controllers/formattedOcrController.js';
import { handleChunkedOcr } from '../controllers/chunkedOcrController.js';
import { handleRenderPdf } from '../controllers/renderController.js';

const router = express.Router();

// PDF and document rendering endpoint (uses optionalAuth and rateLimiter so valid document exports never 401)
router.post('/render/pdf', optionalAuth, rateLimiter, handleRenderPdf);

// Apply strict authentication to all OCR endpoints so req.user is available
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
