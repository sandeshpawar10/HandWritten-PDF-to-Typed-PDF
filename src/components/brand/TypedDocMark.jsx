import React from 'react';

/**
 * TypedDocMark
 * The standalone folded document mark from the TypedDoc brand identity.
 * Features the signature amber folded page with crisp typed line indicators.
 */
export function TypedDocMark({
  className = 'w-6 h-6',
  size,
  variant = 'brand', // 'brand' | 'white' | 'dark' | 'monochrome'
  glow = false,
  ...props
}) {
  const dimensionProps = size ? { width: size, height: size } : {};

  // Gradient ID unique enough for multiple instances
  const gradId = React.useId();

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${glow ? 'drop-shadow-[0_4px_12px_rgba(196,133,60,0.35)]' : ''}`}
      style={size ? { width: size, height: size } : undefined}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...dimensionProps}
        {...props}
      >
        <defs>
          <linearGradient id={`${gradId}-amber`} x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E2A654" />
            <stop offset="50%" stopColor="#C4853C" />
            <stop offset="100%" stopColor="#9C5E24" />
          </linearGradient>

          <linearGradient id={`${gradId}-fold`} x1="20" y1="3" x2="26" y2="9" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFBF5" />
            <stop offset="100%" stopColor="#EAD8C3" />
          </linearGradient>

          <filter id={`${gradId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#3D2E1C" floodOpacity="0.22" />
          </filter>
        </defs>

        {/* Base document body with folded top-right corner */}
        <path
          d="M7 3 h13.5 l6.5 6.5 v17 c0 1.66-1.34 3-3 3 H7 c-1.66 0-3-1.34-3-3 V6 c0-1.66 1.34-3 3-3 z"
          fill={
            variant === 'white'
              ? '#FFFFFF'
              : variant === 'dark'
              ? '#3D2E1C'
              : variant === 'monochrome'
              ? 'currentColor'
              : `url(#${gradId}-amber)`
          }
          filter={`url(#${gradId}-shadow)`}
        />

        {/* Folded corner tab with soft back shadow */}
        <path
          d="M20.5 3 v4.5 c0 1.1.9 2 2 2 h4.5 L20.5 3 z"
          fill={`url(#${gradId}-fold)`}
          opacity="0.95"
        />

        {/* Document horizontal lines (typed text) */}
        <rect
          x="9"
          y="12"
          width="14"
          height="2.2"
          rx="1.1"
          fill={variant === 'white' ? '#8B5E3C' : '#FFFBF5'}
          opacity="0.95"
        />
        <rect
          x="9"
          y="16.5"
          width="14"
          height="2.2"
          rx="1.1"
          fill={variant === 'white' ? '#8B5E3C' : '#FFFBF5'}
          opacity="0.9"
        />
        <rect
          x="9"
          y="21"
          width="9.5"
          height="2.2"
          rx="1.1"
          fill={variant === 'white' ? '#8B5E3C' : '#FFFBF5'}
          opacity="0.9"
        />
      </svg>
    </div>
  );
}

export default TypedDocMark;
