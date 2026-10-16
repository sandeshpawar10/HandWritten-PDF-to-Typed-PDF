import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Progress Bar Component for Chunked Processing
 * Shows real-time progress with page count and percentage
 */
export function ChunkedProgressBar({ progress }) {
  const { current = 0, total = 0, percent = 0, message = '' } = progress || {};

  return (
    <div className="w-full space-y-3">
      {/* Progress Bar */}
      <div className="relative w-full bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner">
        <div
          className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out flex items-center justify-center"
          style={{ width: `${Math.min(percent, 100)}%` }}
        >
          {percent > 10 && (
            <span className="text-xs font-bold text-white z-10">
              {percent}%
            </span>
          )}
        </div>

        {/* Animated stripes effect */}
        {percent < 100 && (
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
            style={{
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s infinite linear'
            }}
          />
        )}
      </div>

      {/* Status Text */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {percent < 100 ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="font-medium text-gray-700">
                {total > 0 ? (
                  <>Processing page <span className="text-blue-600 font-bold">{current}</span> of {total}</>
                ) : (
                  'Initializing...'
                )}
              </span>
            </>
          ) : (
            <span className="font-medium text-green-600">✓ Complete!</span>
          )}
        </div>

        {total > 0 && (
          <span className="text-xs text-gray-500 font-mono">
            {current}/{total} pages
          </span>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className="text-xs text-gray-600 italic bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
          {message}
        </div>
      )}
    </div>
  );
}

// Add shimmer animation to your global CSS or inline
const shimmerStyle = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

// Inject shimmer animation if not already present
if (typeof document !== 'undefined' && !document.getElementById('shimmer-animation')) {
  const style = document.createElement('style');
  style.id = 'shimmer-animation';
  style.textContent = shimmerStyle;
  document.head.appendChild(style);
}
