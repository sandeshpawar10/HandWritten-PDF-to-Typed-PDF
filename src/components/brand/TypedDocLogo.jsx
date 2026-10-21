import React from 'react';
import { TypedDocMark } from './TypedDocMark';

/**
 * TypedDocLogo
 * Component providing standard brand lockups with the transformation logo:
 * - 'horizontal': Transformation Logo Mark + "TypedDoc"
 * - 'wordmark': "TypedDoc" text styled with editorial gradient
 * - 'mark': Standalone Transformation Logo Mark
 * - 'full': Full-size transformation graphic
 */
export function TypedDocLogo({
  variant = 'horizontal',
  className = '',
  markSize = 28,
  imageWidth = 260,
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
          src="/brand/logo.jpg"
          alt="TypedDoc Logo"
          className="w-full h-auto object-cover rounded-2xl drop-shadow-md"
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

  // Default: 'horizontal' lockup with Brand Mark on the left and "TypedDoc" on the right
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
