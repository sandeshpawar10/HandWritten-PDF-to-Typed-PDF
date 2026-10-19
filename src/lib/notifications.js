/**
 * src/lib/notifications.js
 * Durable notification store for TypedDoc.
 * Persists OCR completions, server PDF exports, and verification alerts in localStorage.
 */

const BASE_STORAGE_KEY = 'typeddoc_notifications_v1';
const MAX_NOTIFICATIONS = 50;
const listeners = new Set();
let currentUserId = null;

export function setNotificationUserId(uid) {
  currentUserId = uid || null;
}

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  return null;
}

export function getStorageKey(userId) {
  const uid = userId || currentUserId;
  return uid ? `${BASE_STORAGE_KEY}_${uid}` : `${BASE_STORAGE_KEY}_guest`;
}


export function getStoredNotifications(userId) {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read notifications from localStorage:', e);
    return [];
  }
}

function saveNotifications(notifications, userId) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(getStorageKey(userId), JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
    notifyListeners(userId);
  } catch (e) {
    console.error('Failed to save notifications to localStorage:', e);
  }
}

function notifyListeners(userId) {
  const current = getStoredNotifications(userId);
  listeners.forEach(fn => fn(current));
}

export function subscribeNotifications(callback, userId) {
  listeners.add(callback);
  callback(getStoredNotifications(userId));
  return () => listeners.delete(callback);
}


/**
 * Add a durable notification event with deduplication.
 */
export function addNotification({ title, message, type = 'info', docId, link, userId }) {
  if (!title) return;
  const current = getStoredNotifications(userId);

  // Deduplicate recent identical events (<15 seconds)
  const now = Date.now();
  const isDuplicate = current.some(
    n => n.title === title && n.message === message && (now - (n.timestamp || 0)) < 15000
  );
  if (isDuplicate) return;

  const newEntry = {
    id: `notif_${now}_${Math.random().toString(36).substring(2, 7)}`,
    title,
    message: message || '',
    type, // 'success' | 'error' | 'warning' | 'info'
    docId: docId || null,
    link: link || null,
    read: false,
    timestamp: now
  };

  saveNotifications([newEntry, ...current], userId);
}

export function markNotificationAsRead(id, userId) {
  const current = getStoredNotifications(userId);
  const updated = current.map(n => n.id === id ? { ...n, read: true } : n);
  saveNotifications(updated, userId);
}

export function markAllNotificationsAsRead(userId) {
  const current = getStoredNotifications(userId);
  const updated = current.map(n => ({ ...n, read: true }));
  saveNotifications(updated, userId);
}

export function clearAllNotifications(userId) {
  saveNotifications([], userId);
}

