import React from 'react';
import { TypedDocMark } from './TypedDocMark';

/**
 * TypedDocLogo
 * Component providing standard brand lockups:
 * - 'wordmark': "Typed" + Document Mark as 'D' + "oc"
 * - 'horizontal': Document Mark + "TypedDoc" text
 * - 'full': The complete transformation illustration with master asset
 */
export function TypedDocLogo({
  variant = 'wordmark',
  className = '',
  markSize = 28,
  imageWidth = 420,
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
          src="/brand/logo-full.jpg"
          alt="TypedDoc — Transform handwritten notes into beautiful typed documents"
          className="w-full h-auto object-contain drop-shadow-md rounded-2xl"
          style={{ maxWidth: imageWidth }}
          loading="lazy"
        />
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={`inline-flex items-center gap-2.5 select-none ${className}`} {...props}>
        <TypedDocMark size={markSize} glow={glow} />
        <span className="font-serif font-black text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#3D2E1C] via-[#5C3D24] to-[#8B5E3C]">
          TypedDoc
        </span>
      </div>
    );
  }

  // Default: 'wordmark' with stylized "D" document glyph
  return (
    <div
      className={`inline-flex items-baseline select-none ${className}`}
      aria-label="TypedDoc"
      {...props}
    >
      <span className="font-display font-black text-2xl tracking-tight text-[#3D2E1C]">
        Typed
      </span>
      <span className="inline-flex items-center self-center mx-0.5 translate-y-[2px]">
        <TypedDocMark size={markSize || 22} glow={glow} />
      </span>
      <span className="font-display font-black text-2xl tracking-tight text-[#3D2E1C]">
        oc
      </span>
    </div>
  );
}

export default TypedDocLogo;
