import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { TypedDocMark } from './TypedDocMark';
import { OPENING_SEEN_KEY, OPENING_ANIMATION_CONFIG } from '../../lib/brandConstants';

export { OPENING_SEEN_KEY };

/**
 * TypedDocOpeningAnimation
 * A 5-beat opening brand narrative that tells the story of TypedDoc:
 * Handwritten Paper -> Handwriting Reveal -> Transformation Arrow -> Crisp Typed Document -> Wordmark
 *
 * Implements:
 * - Session storage gating (runs once per browser session)
 * - Accessibility (respects prefers-reduced-motion, Skip button, Escape key)
 * - Screen reader status announcements
 */
export function TypedDocOpeningAnimation({ onComplete }) {
  const shouldReduceMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(true);

  const handleFinish = useCallback(() => {
    setIsVisible(false);
    try {
      sessionStorage.setItem(OPENING_SEEN_KEY, '1');
    } catch {
      // Ignore sessionStorage errors (e.g. strict privacy mode)
    }
    // Give time for exit fade transition before calling parent onComplete
    setTimeout(() => {
      onComplete?.();
    }, OPENING_ANIMATION_CONFIG.exitTransitionMs);
  }, [onComplete]);

  // Handle keyboard Escape to skip
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleFinish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFinish]);

  // Automatic timer logic
  useEffect(() => {
    if (shouldReduceMotion) {
      // Reduced motion: short static display
      const timer = setTimeout(handleFinish, OPENING_ANIMATION_CONFIG.reducedMotionDurationMs);
      return () => clearTimeout(timer);
    }

    // Standard 5-beat timeline duration
    const timer = setTimeout(handleFinish, OPENING_ANIMATION_CONFIG.standardDurationMs);
    return () => clearTimeout(timer);
  }, [handleFinish, shouldReduceMotion]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="typeddoc-splash"
          role="status"
          aria-label="TypedDoc is loading"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, rgba(196, 133, 60, 0.14), transparent 42%), linear-gradient(135deg, #F5F0E8 0%, #FFFBF5 55%, #E8DFD0 100%)'
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.15 : 0.4, ease: 'easeInOut' }}
        >
          {/* Skip button for keyboard & quick navigation */}
          <button
            onClick={handleFinish}
            className="absolute top-6 right-6 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#8C7B6B] hover:text-[#3D2E1C] bg-white/70 hover:bg-white border border-[#E8DFD0] shadow-sm backdrop-blur-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#C4853C] focus:ring-offset-2 z-20 cursor-pointer"
          >
            Skip intro <span className="opacity-50 text-[10px] ml-1">(Esc)</span>
          </button>

          {/* Central Scene */}
          <div className="relative flex flex-col items-center justify-center p-8 max-w-lg w-full">
            {shouldReduceMotion ? (
              // Reduced motion: Clean, static brand lockup
              <div className="flex flex-col items-center gap-4">
                <TypedDocMark size={64} glow />
                <div className="flex items-baseline font-display font-black text-4xl text-[#3D2E1C] tracking-tight">
                  <span>Typed</span>
                  <span className="mx-1 translate-y-1">
                    <TypedDocMark size={32} />
                  </span>
                  <span>oc</span>
                </div>
                <p className="text-sm font-medium text-[#8C7B6B]">
                  Handwritten to Typed Documents
                </p>
              </div>
            ) : (
              // Full 5-Beat Transformation Sequence
              <div className="flex flex-col items-center">
                <div className="relative w-80 h-52 sm:w-96 sm:h-56 flex items-center justify-center">
                  
                  {/* Beat 1 & 2: Handwritten Sheet (Left) */}
                  <motion.div
                    className="absolute left-4 sm:left-6 top-3 w-32 sm:w-36 h-44 sm:h-48 rounded-xl bg-[#F6EEDF] border border-[#DECFB5] shadow-lg p-3.5 flex flex-col justify-between overflow-hidden"
                    initial={{ opacity: 0, y: 24, rotate: -6, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, rotate: -2, scale: 1 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      boxShadow: '0 12px 28px -6px rgba(61,46,28,0.18), 0 4px 10px rgba(61,46,28,0.08)'
                    }}
                  >
                    {/* Handwritten scribbles / cursive text simulation */}
                    <div className="space-y-2 mt-1">
                      {[
                        'M2 6 Q 14 2, 28 7 T 56 6 T 84 5',
                        'M2 5 Q 20 8, 40 4 T 75 7 T 95 5',
                        'M2 6 Q 16 3, 35 6 T 65 4 T 88 7',
                        'M2 5 Q 24 7, 50 4 T 70 6',
                        'M2 6 Q 18 3, 40 7 T 80 5 T 92 6',
                        'M2 5 Q 30 7, 60 5'
                      ].map((pathData, idx) => (
                        <motion.svg
                          key={idx}
                          viewBox="0 0 100 12"
                          className="w-full h-3 overflow-visible"
                          initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
                          animate={{ opacity: 0.75, clipPath: 'inset(0 0% 0 0)' }}
                          transition={{
                            delay: 0.28 + idx * 0.08,
                            duration: 0.32,
                            ease: 'easeOut'
                          }}
                        >
                          <path
                            d={pathData}
                            fill="none"
                            stroke="#3D2E1C"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </motion.svg>
                      ))}
                    </div>

                    <div className="text-[9px] font-mono tracking-widest text-[#9C8A76] uppercase text-right">
                      Notes
                    </div>
                  </motion.div>

                  {/* Beat 3: Transformation Arrow (Sweeps across) */}
                  <motion.div
                    className="absolute z-20 pointer-events-none"
                    style={{ left: '33%', bottom: '15%' }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.65, duration: 0.45 }}
                  >
                    <svg width="120" height="90" viewBox="0 0 120 90" fill="none">
                      <defs>
                        <linearGradient id="arrow-grad" x1="10" y1="75" x2="110" y2="25" gradientUnits="userSpaceOnUse">
                          <stop offset="0%" stopColor="#E2A654" />
                          <stop offset="100%" stopColor="#C4853C" />
                        </linearGradient>
                        <filter id="arrow-glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#C4853C" floodOpacity="0.45" />
                        </filter>
                      </defs>

                      {/* Curved arrow path */}
                      <motion.path
                        d="M 12 75 C 10 50, 45 40, 85 45 L 82 35 L 108 50 L 82 65 L 85 55 C 50 50, 22 60, 20 78 Z"
                        fill="url(#arrow-grad)"
                        filter="url(#arrow-glow)"
                        initial={{ opacity: 0, scale: 0.85, x: -10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        transition={{ delay: 0.65, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                      />
                    </svg>
                  </motion.div>

                  {/* Beat 4: Crisp Typed Document (Right) */}
                  <motion.div
                    className="absolute right-4 sm:right-6 top-1 z-10 w-36 sm:w-40 h-48 sm:h-52 rounded-2xl bg-white border border-[#E8DFD0] shadow-xl p-4 flex flex-col justify-between"
                    initial={{ opacity: 0, x: 25, scale: 0.94 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ delay: 0.95, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      boxShadow: '0 16px 36px -8px rgba(61,46,28,0.22), 0 4px 12px rgba(61,46,28,0.06)'
                    }}
                  >
                    {/* Top folded corner simulation */}
                    <div className="absolute top-0 right-0 w-6 h-6 overflow-hidden rounded-tr-2xl">
                      <div className="absolute -top-6 -right-6 w-12 h-12 bg-[#F5F0E8] border-b border-l border-[#DECBB4] rotate-45 shadow-xs" />
                    </div>

                    {/* Document content */}
                    <div>
                      {/* Amber header highlight */}
                      <motion.div
                        className="h-3 w-20 rounded-md bg-gradient-to-r from-[#D99A4A] to-[#C4853C] mb-3.5"
                        initial={{ scaleX: 0, originX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 1.15, duration: 0.3 }}
                      />

                      {/* Staggered crisp text lines */}
                      <div className="space-y-2">
                        <motion.div
                          className="h-2 w-full rounded bg-[#5C4B3C]"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 0.9, y: 0 }}
                          transition={{ delay: 1.25, duration: 0.25 }}
                        />
                        <motion.div
                          className="h-2 w-11/12 rounded bg-[#8C7B6B]"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 0.85, y: 0 }}
                          transition={{ delay: 1.33, duration: 0.25 }}
                        />
                        <motion.div
                          className="h-2 w-4/5 rounded bg-[#8C7B6B]"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 0.85, y: 0 }}
                          transition={{ delay: 1.41, duration: 0.25 }}
                        />
                        <motion.div
                          className="h-2 w-3/4 rounded bg-[#3D2E1C]"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 0.9, y: 0 }}
                          transition={{ delay: 1.49, duration: 0.25 }}
                        />
                        <motion.div
                          className="h-2 w-1/2 rounded bg-[#8C7B6B]"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 0.8, y: 0 }}
                          transition={{ delay: 1.57, duration: 0.25 }}
                        />
                      </div>
                    </div>

                    {/* Sparkles / Sunburst around the typed document */}
                    <motion.div
                      className="absolute -top-3 -right-3 text-[#D99A4A]"
                      initial={{ scale: 0, rotate: -20, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{ delay: 1.2, duration: 0.4 }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2 L14 8 L20 10 L14 12 L12 18 L10 12 L4 10 L10 8 Z" fill="#D99A4A" />
                      </svg>
                    </motion.div>
                    <motion.div
                      className="absolute top-1/2 -right-4 text-[#C4853C]"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 1.2, 1], opacity: 1 }}
                      transition={{ delay: 1.35, duration: 0.35 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="3" fill="#C4853C" />
                      </svg>
                    </motion.div>

                    <div className="text-[9px] font-bold text-[#8B5E3C] tracking-wide">
                      TypedDoc
                    </div>
                  </motion.div>
                </div>

                {/* Beat 5: Wordmark assembles below */}
                <motion.div
                  className="mt-6 flex items-baseline font-display font-black text-3xl sm:text-4xl text-[#3D2E1C] tracking-tight"
                  initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 1.45, duration: 0.45, ease: 'easeOut' }}
                >
                  <span>Typed</span>
                  <motion.span
                    className="inline-flex items-center self-center mx-1 translate-y-1"
                    initial={{ scale: 0.8, rotate: -15 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 1.55, duration: 0.35, type: 'spring', bounce: 0.4 }}
                  >
                    <TypedDocMark size={32} glow />
                  </motion.span>
                  <span>oc</span>
                </motion.div>

                {/* Subtitle crossfade */}
                <motion.p
                  className="mt-2 text-xs sm:text-sm font-medium text-[#8C7B6B]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.7, duration: 0.4 }}
                >
                  From handwriting to beautiful typed documents
                </motion.p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default TypedDocOpeningAnimation;
