import React from 'react';

/**
 * TypedDocMark
 * The standalone folded document brand logo.
 * Features the signature golden-amber sheet (#C8873B) with folded top-right corner
 * and three crisp white rounded bars.
 */
export function TypedDocMark({
  className = 'w-6 h-6',
  size,
  variant = 'brand', // 'brand' | 'white' | 'dark' | 'monochrome'
  glow = false,
  asImage = false,
  ...props
}) {
  const dimensionProps = size ? { width: size, height: size } : {};

  if (asImage) {
    return (
      <img
        src="/brand/brand-mark.png"
        alt="TypedDoc Logo"
        className={`object-contain shrink-0 select-none ${glow ? 'drop-shadow-[0_4px_12px_rgba(200,135,59,0.4)]' : ''} ${className}`}
        style={size ? { width: size, height: size } : undefined}
        {...props}
      />
    );
  }

  const gradId = React.useId();

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${glow ? 'drop-shadow-[0_4px_12px_rgba(200,135,59,0.35)]' : ''}`}
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
          <linearGradient id={`${gradId}-amber`} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D49347" />
            <stop offset="100%" stopColor="#BF7E32" />
          </linearGradient>
        </defs>

        {/* Base document body with rounded corners and folded corner cutout */}
        <path
          d="M7 2.5 h12 l7.5 7.5 v15 c0 2.5-2 4.5-4.5 4.5 H7 c-2.5 0-4.5-2-4.5-4.5 V7 c0-2.5 2-4.5 4.5-4.5 z"
          fill={
            variant === 'white'
              ? '#FFFFFF'
              : variant === 'dark'
              ? '#3D2E1C'
              : variant === 'monochrome'
              ? 'currentColor'
              : `url(#${gradId}-amber)`
          }
        />

        {/* Top-right folded flap */}
        <path
          d="M19 2.5 v5 c0 1.4 1.1 2.5 2.5 2.5 h5 L19 2.5 z"
          fill={variant === 'white' ? '#F5E6D3' : '#FFFFFF'}
          opacity="0.98"
        />

        {/* Three white rounded text bars */}
        {/* Line 1: Wide */}
        <rect
          x="8.5"
          y="13.5"
          width="13.5"
          height="2.7"
          rx="1.35"
          fill={variant === 'white' ? '#8B5E3C' : '#FFFFFF'}
        />
        {/* Line 2: Wide */}
        <rect
          x="8.5"
          y="18.2"
          width="13.5"
          height="2.7"
          rx="1.35"
          fill={variant === 'white' ? '#8B5E3C' : '#FFFFFF'}
        />
        {/* Line 3: Short (left-aligned) */}
        <rect
          x="8.5"
          y="22.9"
          width="7.5"
          height="2.7"
          rx="1.35"
          fill={variant === 'white' ? '#8B5E3C' : '#FFFFFF'}
        />
      </svg>
    </div>
  );
}

export default TypedDocMark;
