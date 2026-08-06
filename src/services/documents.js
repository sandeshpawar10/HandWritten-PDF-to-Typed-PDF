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
 * According to system instructions, when a Firestore operation fails due to "Missing or insufficient permissions,"
 * we must throw a JSON string of FirestoreErrorInfo.
 */
function handleFirestoreError(error, operationType, path = null) {
  if (error instanceof FirestoreError && error.code === 'permission-denied') {
    const user = auth.currentUser;
    const errorInfo = {
      error: error.message,
      operationType,
      path,
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
    throw new Error(JSON.stringify(errorInfo));
  }
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
