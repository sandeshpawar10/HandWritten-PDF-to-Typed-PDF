import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Progress Bar Component for Chunked Processing
 * Shows real-time progress with page count and percentage
 */
export function ChunkedProgressBar({ progress }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('shimmer-animation')) {
      const style = document.createElement('style');
      style.id = 'shimmer-animation';
      style.textContent = `
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const safePercent = Number.isFinite(progress?.percent)
    ? Math.min(Math.max(Math.round(progress.percent), 0), 100)
    : 0;
  const safeCurrent = Number.isFinite(progress?.current) ? progress.current : 0;
  const safeTotal = Number.isFinite(progress?.total) ? progress.total : 0;
  const message = progress?.message || '';

  return (
    <div className="w-full space-y-3">
      {/* Progress Bar */}
      <div className="relative w-full bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner">
        <div
          className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out flex items-center justify-center"
          style={{ width: `${safePercent}%` }}
        >
          {safePercent > 10 && (
            <span className="text-xs font-bold text-white z-10">
              {safePercent}%
            </span>
          )}
        </div>

        {/* Animated stripes effect */}
        {safePercent < 100 && (
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
          {safePercent < 100 ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="font-medium text-gray-700">
                {safeTotal > 0 ? (
                  <>Processing page <span className="text-blue-600 font-bold">{safeCurrent}</span> of {safeTotal}</>
                ) : (
                  'Initializing...'
                )}
              </span>
            </>
          ) : (
            <span className="font-medium text-green-600">✓ Complete!</span>
          )}
        </div>

        {safeTotal > 0 && (
          <span className="text-xs text-gray-500 font-mono">
            {safeCurrent}/{safeTotal} pages
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
