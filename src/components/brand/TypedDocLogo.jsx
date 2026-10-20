import React from 'react';
import { TypedDocMark } from './TypedDocMark';

/**
 * TypedDocLogo
 * Component providing standard brand lockups:
 * - 'horizontal': Brand Mark + "TypedDoc" (with full 'D')
 * - 'wordmark': "TypedDoc" text styled with gradient
 * - 'mark': Standalone Brand Mark
 * - 'full': The brand logo graphic
 */
export function TypedDocLogo({
  variant = 'horizontal',
  className = '',
  markSize = 26,
  imageWidth = 240,
  glow = false,
  ...props
}) {
  if (variant === 'mark') {
    return <TypedDocMark size={markSize} glow={glow} className={className} {...props} />;
  }

  if (variant === 'full') {
    return (
      <div className={`relative inline-flex flex-col items-center select-none ${className}`} {...props}>
        <img
          src="/brand/brand-mark.png"
          alt="TypedDoc Logo"
          className="w-full h-auto object-contain drop-shadow-md"
          style={{ maxWidth: imageWidth }}
          loading="lazy"
        />
      </div>
    );
  }

  if (variant === 'wordmark') {
    return (
      <span
        className={`font-serif font-black text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#3D2E1C] via-[#5C3D24] to-[#8B5E3C] select-none ${className}`}
        aria-label="TypedDoc"
        {...props}
      >
        TypedDoc
      </span>
    );
  }

  // Default: 'horizontal' lockup with Brand Mark on the left and "TypedDoc" with 'D' on the right
  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
      aria-label="TypedDoc"
      {...props}
    >
      <TypedDocMark size={markSize} glow={glow} />
      <span className="font-serif font-black text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#3D2E1C] via-[#5C3D24] to-[#8B5E3C]">
        TypedDoc
      </span>
    </div>
  );
}

export default TypedDocLogo;
