/**
 * src/lib/notifications.js
 * Durable notification store for TypedDoc.
 * Persists OCR completions, server PDF exports, and verification alerts in localStorage.
 */

const STORAGE_KEY = 'typeddoc_notifications_v1';
const MAX_NOTIFICATIONS = 50;
const listeners = new Set();

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  return null;
}

export function getStoredNotifications() {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read notifications from localStorage:', e);
    return [];
  }
}

function saveNotifications(notifications) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
    notifyListeners();
  } catch (e) {
    console.error('Failed to save notifications to localStorage:', e);
  }
}

function notifyListeners() {
  const current = getStoredNotifications();
  listeners.forEach(fn => fn(current));
}

export function subscribeNotifications(callback) {
  listeners.add(callback);
  callback(getStoredNotifications());
  return () => listeners.delete(callback);
}

/**
 * Add a durable notification event with deduplication.
 */
export function addNotification({ title, message, type = 'info', docId, link }) {
  if (!title) return;
  const current = getStoredNotifications();

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

  saveNotifications([newEntry, ...current]);
}

export function markNotificationAsRead(id) {
  const current = getStoredNotifications();
  const updated = current.map(n => n.id === id ? { ...n, read: true } : n);
  saveNotifications(updated);
}

export function markAllNotificationsAsRead() {
  const current = getStoredNotifications();
  const updated = current.map(n => ({ ...n, read: true }));
  saveNotifications(updated);
}

export function clearAllNotifications() {
  saveNotifications([]);
}
