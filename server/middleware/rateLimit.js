// Rate limiting configuration
// Large documents require multiple API calls for chunked processing:
// - 1 OCR request
// - 10+ post-processing requests (2 pages per chunk for a 20-page document)
// Setting limit to 50 allows legitimate document processing without blocking
const WINDOW_SIZE_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 50; // Allows multi-page document processing (OCR + chunked post-processing)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Clean up old entries every 5 minutes

const requestCounts = new Map();

// Issue #6: Periodic cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [userId, record] of requestCounts.entries()) {
    // Remove entries older than 2 windows
    if (now - record.startTime > WINDOW_SIZE_MS * 2) {
      requestCounts.delete(userId);
    }
  }
}, CLEANUP_INTERVAL_MS);

export const rateLimiter = (req, res, next) => {
  const userId = req.user?.uid;
  if (!userId) {
    return res.status(401).json({ error: 'User ID missing for rate limiting' });
  }

  const now = Date.now();
  const userRecord = requestCounts.get(userId) || { count: 0, startTime: now };

  // Reset if window has passed
  if (now - userRecord.startTime > WINDOW_SIZE_MS) {
    userRecord.count = 1;
    userRecord.startTime = now;
  } else {
    userRecord.count++;
  }

  requestCounts.set(userId, userRecord);

  if (userRecord.count > MAX_REQUESTS) {
    const resetTime = Math.ceil((userRecord.startTime + WINDOW_SIZE_MS - now) / 1000);
    return res.status(429).json({
      error: 'Too Many Requests. Please wait before trying again.',
      retryAfter: resetTime,
      limit: MAX_REQUESTS,
      remaining: 0
    });
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS - userRecord.count);
  res.setHeader('X-RateLimit-Reset', new Date(userRecord.startTime + WINDOW_SIZE_MS).toISOString());

  next();
};
