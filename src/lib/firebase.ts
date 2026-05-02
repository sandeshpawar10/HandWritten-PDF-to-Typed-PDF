import { initializeApp } from 'firebase/app';
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Prompt user to select account each time
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const signInWithGoogle = async () => {
  try {
    // Try popup first — works when domain is authorized and popups aren't blocked
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error: any) {
    const code = error?.code || '';
    
    // These errors mean popup was blocked or domain isn't authorized — fall back to redirect
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/unauthorized-domain' ||
      code === 'auth/cancelled-popup-request'
    ) {
      console.warn(`Popup auth failed (${code}), trying redirect...`);
      return signInWithRedirect(auth, googleProvider);
    }

    // User closed popup voluntarily — not an error
    if (code === 'auth/popup-closed-by-user') {
      return null;
    }
    
    // Anything else — rethrow
    throw error;
  }
};

// Handle the redirect result when the page loads after a redirect sign-in
getRedirectResult(auth)
  .then((result) => {
    if (result) {
      console.log('Signed in via redirect:', result.user.displayName);
    }
  })
  .catch((error) => {
    if (error?.code === 'auth/unauthorized-domain') {
      const hostname = window.location.hostname;
      console.error(
        `⚠️ Firebase Auth Error: "${hostname}" is not an authorized domain.\n\n` +
        `To fix this:\n` +
        `1. Go to https://console.firebase.google.com/\n` +
        `2. Select project "${firebaseConfig.projectId}"\n` +
        `3. Navigate to Authentication → Settings → Authorized domains\n` +
        `4. Add "${hostname}"\n`
      );
    }
  });

export const logOut = () => signOut(auth);

// Test Firestore connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
