import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin with service account if available
// Falls back to public key verification if service account not provided
let app;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    app = initializeApp({
      credential: cert(serviceAccount)
    });
    console.log('✓ Firebase Admin initialized with service account');
  } catch (error) {
    console.error('✗ Failed to parse FIREBASE_SERVICE_ACCOUNT:', error.message);
    console.log('  Falling back to public key verification');
    app = initializeApp({
      projectId: "ai-studio-applet-webapp-a82b5"
    });
  }
} else {
  console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT not set. Using public key verification (may have intermittent failures).');
  app = initializeApp({
    projectId: "ai-studio-applet-webapp-a82b5"
  });
}

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken; // Make user info available to controllers
    next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
