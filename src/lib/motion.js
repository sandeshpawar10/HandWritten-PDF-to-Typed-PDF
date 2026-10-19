import { useState, useEffect } from 'react';

/**
 * Shared motion physics presets for TypedDoc.
 * Follows calm, academic animation guidelines.
 */
export const springGentle = { type: 'spring', stiffness: 260, damping: 26 };
export const springBouncy = { type: 'spring', stiffness: 350, damping: 20 };
export const springSnappy = { type: 'spring', stiffness: 420, damping: 30 };

/**
 * Shared motion policy hook.
 * Disables decorative animations when prefers-reduced-motion is active.
 */
export function useTypedDocMotion() {
  const [reduce, setReduce] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReduce(e.matches);

    mediaQuery.addEventListener?.('change', onChange);
    return () => mediaQuery.removeEventListener?.('change', onChange);
  }, []);

  return {
    reduce,
    duration: reduce ? 0 : 0.35,
    spring: reduce ? { duration: 0 } : springGentle,
    springBouncy: reduce ? { duration: 0 } : springBouncy,
    springSnappy: reduce ? { duration: 0 } : springSnappy,
    fade: reduce
      ? { duration: 0 }
      : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
  };
}
