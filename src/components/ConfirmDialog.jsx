import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Issue #10: Professional confirmation dialog to replace browser confirm()
 */
export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'default' }) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#3D2E1C]/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-[#FFFBF5] border border-[#E8DFD0] rounded-3xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {variant === 'danger' && (
                    <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                  )}
                  <h3 className="text-lg font-serif font-black text-[#3D2E1C]">{title}</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-xl hover:bg-[#E8DFD0] transition-colors text-[#8C7B6B]"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm text-[#6B5D4F] leading-relaxed mb-6">{message}</p>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-[#E8DFD0] text-[#3D2E1C] font-medium hover:bg-[#F5F0E8] transition-colors"
                >
                  {cancelText}
                </button>
                <button
                  onClick={handleConfirm}
                  className={cn(
                    "flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors",
                    variant === 'danger'
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-[#8B5E3C] text-white hover:bg-[#7A5133]"
                  )}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
