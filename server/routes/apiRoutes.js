import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rateLimiter, ocrRateLimiter } from '../middleware/rateLimit.js';
import { handleOcr } from '../controllers/apiController.js';
import { handleFormattedOcr } from '../controllers/formattedOcrController.js';
import { handleChunkedOcr } from '../controllers/chunkedOcrController.js';

const router = express.Router();

// Apply general rate limiting
router.use(rateLimiter);

// Apply authentication to all API routes
router.use(requireAuth);

// OCR endpoints with stricter rate limiting
router.post('/ocr', ocrRateLimiter, handleOcr);
router.post('/ocr/formatted', ocrRateLimiter, handleFormattedOcr);
router.post('/ocr/chunked', ocrRateLimiter, handleChunkedOcr); // NEW: Chunked processing

export default router;
