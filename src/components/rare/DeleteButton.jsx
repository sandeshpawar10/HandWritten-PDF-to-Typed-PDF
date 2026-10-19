import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Trash2, Check, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTypedDocMotion } from '../../lib/motion';
import { cn } from '../../lib/utils';

/**
 * Delete Button with two-step inline confirmation.
 * Prevents accidental deletions without disruptive modals.
 */
export function DeleteButton({
  onConfirm,
  onCancel,
  'aria-label': ariaLabel = 'Delete item',
  timeoutMs = 3500,
  className
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef(null);
  const { reduce, spring } = useTypedDocMotion();

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const handleClick = (e) => {
    e.stopPropagation();
    if (isLoading) return;

    if (!isConfirming) {
      setIsConfirming(true);
      clearTimer();
      timerRef.current = setTimeout(() => {
        setIsConfirming(false);
        onCancel?.();
      }, timeoutMs);
    } else {
      clearTimer();
      setIsLoading(true);
      Promise.resolve(onConfirm?.(e))
        .catch(() => {})
        .finally(() => {
          setIsLoading(false);
          setIsConfirming(false);
        });
    }
  };

  const handleCancel = (e) => {
    e.stopPropagation();
    clearTimer();
    setIsConfirming(false);
    onCancel?.();
  };

  return (
    <div className={cn("inline-flex items-center relative", className)} onClick={(e) => e.stopPropagation()}>
      <AnimatePresence mode="wait" initial={false}>
        {!isConfirming ? (
          <motion.button
            key="idle"
            type="button"
            whileHover={!reduce ? { scale: 1.08 } : undefined}
            whileTap={!reduce ? { scale: 0.94 } : undefined}
            onClick={handleClick}
            aria-label={ariaLabel}
            className="p-2 rounded-xl text-[#8C7B6B] hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors shadow-xs"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        ) : (
          <motion.div
            key="confirming"
            initial={!reduce ? { scale: 0.9, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            exit={!reduce ? { scale: 0.9, opacity: 0 } : false}
            transition={spring}
            className="flex items-center gap-1 p-1 rounded-xl bg-red-50 border border-red-200 shadow-sm"
          >
            <button
              type="button"
              disabled={isLoading}
              onClick={handleClick}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold shadow-xs transition-colors"
              aria-label={`Confirm ${ariaLabel}`}
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              <span>Confirm?</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleCancel}
              className="p-1 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
              aria-label="Cancel deletion"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

DeleteButton.propTypes = {
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  'aria-label': PropTypes.string,
  timeoutMs: PropTypes.number,
  className: PropTypes.string
};
