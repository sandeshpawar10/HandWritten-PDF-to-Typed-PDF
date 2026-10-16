/**
 * Toast Notification System
 * Replaces browser alert() with professional toast notifications
 */
import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const toastStore = {
  listeners: [],
  toasts: [],

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  },

  notify() {
    this.listeners.forEach(listener => listener(this.toasts));
  },

  add(toast) {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { id, ...toast, createdAt: Date.now() };
    this.toasts = [...this.toasts, newToast];
    this.notify();

    // Auto-remove after duration
    if (toast.duration !== Infinity) {
      setTimeout(() => this.remove(id), toast.duration || 5000);
    }

    return id;
  },

  remove(id) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  }
};

// Toast API
export const toast = {
  success: (message, options = {}) =>
    toastStore.add({ type: 'success', message, ...options }),

  error: (message, options = {}) =>
    toastStore.add({ type: 'error', message, ...options }),

  warning: (message, options = {}) =>
    toastStore.add({ type: 'warning', message, ...options }),

  info: (message, options = {}) =>
    toastStore.add({ type: 'info', message, ...options }),

  dismiss: (id) => toastStore.remove(id)
};

// Toast Container Component
export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return toastStore.subscribe(setToasts);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[9999] pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={() => toastStore.remove(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  const config = {
    success: {
      icon: CheckCircle2,
      bgClass: 'bg-green-50 border-green-200',
      iconClass: 'text-green-500',
      textClass: 'text-green-800'
    },
    error: {
      icon: AlertCircle,
      bgClass: 'bg-red-50 border-red-200',
      iconClass: 'text-red-500',
      textClass: 'text-red-800'
    },
    warning: {
      icon: AlertTriangle,
      bgClass: 'bg-amber-50 border-amber-200',
      iconClass: 'text-amber-500',
      textClass: 'text-amber-800'
    },
    info: {
      icon: Info,
      bgClass: 'bg-blue-50 border-blue-200',
      iconClass: 'text-blue-500',
      textClass: 'text-blue-800'
    }
  };

  const { icon: Icon, bgClass, iconClass, textClass } = config[toast.type] || config.info;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`mb-3 pointer-events-auto w-96 max-w-full`}
    >
      <div className={`${bgClass} border rounded-2xl shadow-lg backdrop-blur-sm p-4 flex items-start gap-3`}>
        <Icon className={`w-5 h-5 ${iconClass} shrink-0 mt-0.5`} />
        <p className={`flex-1 text-sm font-medium ${textClass} leading-relaxed`}>
          {toast.message}
        </p>
        <button
          onClick={onDismiss}
          className={`${iconClass} hover:opacity-70 transition-opacity shrink-0`}
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
