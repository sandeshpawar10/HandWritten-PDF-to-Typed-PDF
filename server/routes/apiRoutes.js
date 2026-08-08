import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimit.js';
import { handleOcr } from '../controllers/apiController.js';

const router = express.Router();

// Apply auth and rate limiting to all API routes
router.use(requireAuth);
router.use(rateLimiter);

router.post('/ocr', handleOcr);

export default router;
