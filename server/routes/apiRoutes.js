import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rateLimiter, ocrRateLimiter } from '../middleware/rateLimit.js';
import { handleOcr } from '../controllers/apiController.js';
import { handleFormattedOcr } from '../controllers/formattedOcrController.js';

const router = express.Router();

// Apply authentication to all API routes
router.use(requireAuth);

// Apply general rate limiting
router.use(rateLimiter);

// OCR endpoints with stricter rate limiting
router.post('/ocr', ocrRateLimiter, handleOcr);
router.post('/ocr/formatted', ocrRateLimiter, handleFormattedOcr);

export default router;
