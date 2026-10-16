import rateLimit from 'express-rate-limit';

// Rate limiting configuration
// Prevents API abuse and protects against DoS attacks
export const rateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 10, // 10 requests per minute per IP
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers

  // Custom key generator (can be extended to use user ID instead of IP)
  keyGenerator: (req) => {
    // Prefer user ID for authenticated requests
    return req.user?.uid || req.ip;
  },

  // Skip rate limiting for health checks
  skip: (req) => {
    return req.path === '/health' || req.path === '/api/health';
  },

  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please slow down.',
      retryAfter: Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)
    });
  }
});

// Stricter rate limiter for OCR endpoints (expensive operations)
export const ocrRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minute window
  max: 5, // 5 OCR requests per 5 minutes
  message: {
    error: 'OCR rate limit exceeded',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    return req.user?.uid || req.ip;
  },

  handler: (req, res) => {
    res.status(429).json({
      error: 'OCR rate limit exceeded',
      message: 'You have exceeded the OCR processing limit. Please wait before trying again.',
      retryAfter: Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000),
      limit: 5,
      window: '5 minutes'
    });
  }
});
