import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  getDocs,
  FirestoreError
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

const COLLECTION_NAME = 'documents';

/**
 * Handle Firestore errors with user-friendly messages
 * Logs detailed debug information to console for developers
 */
function handleFirestoreError(error, operationType, path = null) {
  if (error instanceof FirestoreError && error.code === 'permission-denied') {
    const user = auth.currentUser;

    // Detailed error info for debugging (logged, not shown to user)
    const debugInfo = {
      error: error.message,
      operationType,
      path,
      timestamp: new Date().toISOString(),
      authInfo: {
        userId: user?.uid || 'anonymous',
        email: user?.email || 'unknown',
        emailVerified: user?.emailVerified || false,
        isAnonymous: user?.isAnonymous || false,
        providerInfo: user?.providerData.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName || '',
          email: p.email || '',
        })) || [],
      }
    };

    // Log detailed error for developers
    console.error('Firestore Permission Error:', debugInfo);

    // User-friendly error messages based on operation type
    let userMessage = 'You do not have permission to access this document.';

    if (operationType === 'create') {
      userMessage = 'Unable to create document. Please try signing out and back in.';
    } else if (operationType === 'update') {
      userMessage = 'Unable to save changes. You may not have permission to edit this document.';
    } else if (operationType === 'delete') {
      userMessage = 'Unable to delete document. You may not have permission to delete this document.';
    } else if (operationType === 'list') {
      userMessage = 'Unable to load your documents. Please check your internet connection and try signing in again.';
    }

    // Throw user-friendly error
    const friendlyError = new Error(userMessage);
    friendlyError.code = 'PERMISSION_DENIED';
    friendlyError.debugInfo = debugInfo; // Available for advanced error handlers
    throw friendlyError;
  }

  // Handle other Firestore errors
  if (error instanceof FirestoreError) {
    console.error(`Firestore Error (${error.code}):`, error.message);

    // User-friendly messages for common errors
    if (error.code === 'unavailable') {
      throw new Error('Database is temporarily unavailable. Please check your internet connection and try again.');
    } else if (error.code === 'not-found') {
      throw new Error('Document not found. It may have been deleted.');
    } else if (error.code === 'already-exists') {
      throw new Error('A document with this name already exists.');
    } else if (error.code === 'failed-precondition') {
      throw new Error('Database operation failed. Please try again.');
    }
  }

  // Re-throw unknown errors
  throw error;
}

export function subscribeToDocuments(userId, callback) {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(docs);
  }, (error) => {
    console.error("Firestore Subscribe Error:", error);
    try {
      handleFirestoreError(error, 'list', COLLECTION_NAME);
    } catch (e) {
      // Re-throw or handle as needed for the UI
    }
  });
}

export async function createDocument(userId, title, content, originalFileName) {
  return addDoc(collection(db, COLLECTION_NAME), {
    userId,
    title,
    content,
    originalFileName,
    status: 'completed',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateDocument(documentId, updates, saveHistory = true, note) {
  const docRef = doc(db, COLLECTION_NAME, documentId);
  
  if (saveHistory) {
    const currentDoc = docRef;
    // We'd ideally want to get current content before updating to save it as a version
    // But for simplicity in this flow, we'll assume the caller might handle versioning if needed
    // or we can implement it here.
  }

  return updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function saveVersion(documentId, userId, content, note) {
  return addDoc(collection(db, COLLECTION_NAME, documentId, 'versions'), {
    documentId,
    userId,
    content,
    note,
    createdAt: serverTimestamp()
  });
}

export function subscribeToVersions(documentId, userId, callback) {
  const q = query(
    collection(db, COLLECTION_NAME, documentId, 'versions'),
    where('userId', '==', userId), // Rule requires this filter for list
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const versions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(versions);
  }, (error) => {
    console.error("Firestore Version Subscribe Error:", error);
    try {
      handleFirestoreError(error, 'list', `${COLLECTION_NAME}/${documentId}/versions`);
    } catch (e) {
      // Re-throw or handle as needed for the UI
    }
  });
}

export async function deleteDocument(documentId) {
  return deleteDoc(doc(db, COLLECTION_NAME, documentId));
}
