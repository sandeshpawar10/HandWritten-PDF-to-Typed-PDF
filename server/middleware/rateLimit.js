const windowSizeMs = 60 * 1000; // 1 minute
const maxRequests = 10; // 10 requests per minute per user
const requestCounts = new Map();

export const rateLimiter = (req, res, next) => {
  const userId = req.user?.uid;
  if (!userId) {
    return res.status(401).json({ error: 'User ID missing for rate limiting' });
  }

  const now = Date.now();
  const userRecord = requestCounts.get(userId) || { count: 0, startTime: now };

  // Reset if window has passed
  if (now - userRecord.startTime > windowSizeMs) {
    userRecord.count = 1;
    userRecord.startTime = now;
  } else {
    userRecord.count++;
  }

  requestCounts.set(userId, userRecord);

  if (userRecord.count > maxRequests) {
    return res.status(429).json({ error: 'Too Many Requests. Please wait a minute before trying again.' });
  }

  next();
};
