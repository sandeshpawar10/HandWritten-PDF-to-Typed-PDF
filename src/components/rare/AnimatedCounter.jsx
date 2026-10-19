import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useSpring } from 'motion/react';
import { useTypedDocMotion } from '../../lib/motion';
import { cn } from '../../lib/utils';

/**
 * Animated Counter component.
 * Smooth spring-based transition for numerical values.
 */
export function AnimatedCounter({
  value = 0,
  prefix = '',
  suffix = '',
  className
}) {
  const { reduce } = useTypedDocMotion();
  const numericValue = typeof value === 'number' ? value : Number(value) || 0;

  const spring = useSpring(numericValue, {
    stiffness: 120,
    damping: 18,
    restDelta: 0.01
  });

  const [displayValue, setDisplayValue] = useState(numericValue);

  useEffect(() => {
    if (reduce) {
      setDisplayValue(numericValue);
      return;
    }
    spring.set(numericValue);
  }, [numericValue, spring, reduce]);

  useEffect(() => {
    if (reduce) return;
    const unsubscribe = spring.on('change', (latest) => {
      setDisplayValue(Math.round(latest));
    });
    return unsubscribe;
  }, [spring, reduce]);

  return (
    <span
      className={cn("inline-flex items-baseline font-mono font-bold tracking-tight", className)}
      aria-label={`${prefix}${numericValue.toLocaleString()}${suffix}`}
    >
      <span>{prefix}</span>
      <span>{displayValue.toLocaleString()}</span>
      <span>{suffix}</span>
    </span>
  );
}

AnimatedCounter.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  prefix: PropTypes.string,
  suffix: PropTypes.string,
  className: PropTypes.string
};
