import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { HelpCircle, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTypedDocMotion } from '../../lib/motion';
import { cn } from '../../lib/utils';
import { DEFAULT_FAQ_ITEMS } from '../../lib/rareUiConstants';

export { DEFAULT_FAQ_ITEMS };

export function FAQDrawer({ isOpen, onClose, className }) {
  const [openItem, setOpenItem] = useState(DEFAULT_FAQ_ITEMS[0]?.id || null);
  const { reduce, spring } = useTypedDocMotion();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#3D2E1C]/40 backdrop-blur-xs z-50"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <motion.aside
            initial={!reduce ? { x: '100%' } : false}
            animate={{ x: 0 }}
            exit={!reduce ? { x: '100%' } : false}
            transition={spring}
            role="dialog"
            aria-modal="true"
            aria-label="Frequently Asked Questions & Help"
            className={cn(
              "fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-[#FFFBF5] border-l border-[#E8DFD0] shadow-2xl z-50 flex flex-col font-sans",
              className
            )}
          >
            {/* Header */}
            <div className="p-5 border-b border-[#E8DFD0] flex items-center justify-between bg-white/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#8B5E3C]/10 border border-[#8B5E3C]/20 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-[#8B5E3C]" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-base text-[#3D2E1C]">Help & Documentation</h3>
                  <p className="text-[11px] text-[#8C7B6B]">Everything you need to know about TypedDoc</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close help drawer"
                className="p-2 rounded-xl text-[#8C7B6B] hover:text-[#3D2E1C] hover:bg-[#F5F0E8] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Accordion Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {DEFAULT_FAQ_ITEMS.map((item) => {
                const isExpanded = openItem === item.id;
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[#E8DFD0] bg-white overflow-hidden transition-shadow shadow-xs hover:shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenItem(isExpanded ? null : item.id)}
                      aria-expanded={isExpanded}
                      className="w-full p-4 text-left flex items-center justify-between gap-3 font-semibold text-[13px] text-[#3D2E1C] hover:text-[#8B5E3C] transition-colors"
                    >
                      <span>{item.question}</span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 shrink-0 text-[#8C7B6B] transition-transform duration-200",
                          isExpanded && "rotate-180 text-[#8B5E3C]"
                        )}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={!reduce ? { height: 0, opacity: 0 } : false}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={!reduce ? { height: 0, opacity: 0 } : false}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 pt-0 text-[12px] text-[#6B5D4F] leading-relaxed border-t border-[#E8DFD0]/40 mt-1">
                            {item.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E8DFD0] bg-white/60 text-center text-[11px] text-[#8C7B6B]">
              <p>TypedDoc AI Engine v2.0 • Academic OCR Architecture</p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

FAQDrawer.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  className: PropTypes.string
};
