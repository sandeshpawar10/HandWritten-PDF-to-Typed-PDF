import React from 'react';

/**
 * TypedDocMark
 * The official transformation logo mark:
 * Handwritten parchment sheet -> curved amber arrow -> crisp typed document.
 */
export function TypedDocMark({
  className = 'w-6 h-6',
  size,
  glow = false,
  rounded = 'rounded-xl',
  ...props
}) {
  const dimensionProps = size ? { width: size, height: size } : {};

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden ${rounded} ${
        glow ? 'drop-shadow-[0_4px_12px_rgba(200,135,59,0.35)]' : ''
      }`}
      style={size ? { width: size, height: size } : undefined}
    >
      <img
        src="/brand/logo.jpg"
        alt="TypedDoc Logo"
        className={`object-cover w-full h-full ${rounded} ${className}`}
        {...dimensionProps}
        {...props}
      />
    </div>
  );
}

export default TypedDocMark;
