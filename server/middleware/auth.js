import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Get Firebase project ID from environment or use default
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-a82b5";

// Initialize Firebase Admin with service account if available
// Falls back to public key verification if service account not provided
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log('✓ Firebase Admin initialized with service account');
  } catch (error) {
    console.error('✗ Failed to parse FIREBASE_SERVICE_ACCOUNT:', error.message);
    console.log('  Falling back to public key verification');
    initializeApp({
      projectId: FIREBASE_PROJECT_ID
    });
  }
} else {
  console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT not set. Using public key verification (may have intermittent failures).');
  console.warn(`    Using Firebase Project ID: ${FIREBASE_PROJECT_ID}`);
  initializeApp({
    projectId: FIREBASE_PROJECT_ID
  });
}

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Empty bearer token' });
  }
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken; // Make user info available to controllers
    next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
