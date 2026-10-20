import { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { StepPlayer, InlineAIStatus } from './rare';
import { cn } from '../lib/utils';

export function ChunkedProgressBar({ progress }) {
  const [estimatedRemainingSec, setEstimatedRemainingSec] = useState(null);
  const startTimeRef = useRef(Date.now());
  const lastCurrentRef = useRef(0);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('shimmer-animation')) {
      const style = document.createElement('style');
      style.id = 'shimmer-animation';
      style.textContent = `
        @media (prefers-reduced-motion: no-preference) {
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .animate-shimmer {
            animation: shimmer 2s infinite linear;
          }
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
  const inFlight = Number.isFinite(progress?.inFlight) ? progress.inFlight : 0;
  const message = progress?.message || '';

  // Ensure bar is visibly active when workers are running, even before 1st page completes
  const visualPercent = (safePercent === 0 && (inFlight > 0 || progress?.stage === 'transcribing' || progress?.stage === 'rendering'))
    ? 6
    : safePercent;

  // Determine active stage for StepPlayer
  let activeStageIndex = 0;
  let aiState = 'queued';
  if (safePercent >= 100) {
    activeStageIndex = 5;
    aiState = 'done';
  } else if (progress?.stage === 'formatting' || safePercent >= 90) {
    activeStageIndex = 4;
    aiState = 'formatting';
  } else if (progress?.stage === 'verifying' || safePercent >= 80) {
    activeStageIndex = 3;
    aiState = 'verifying';
  } else if (progress?.stage === 'transcribing' || inFlight > 0 || safeCurrent > 0) {
    activeStageIndex = 2;
    aiState = 'ocr';
  } else if (progress?.stage === 'rendering' || visualPercent > 0) {
    activeStageIndex = 1;
    aiState = 'reading';
  }

  // Dynamic ETA calculation
  useEffect(() => {
    if (safeCurrent > 0 && safeCurrent !== lastCurrentRef.current && safeTotal > safeCurrent) {
      lastCurrentRef.current = safeCurrent;
      const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
      const secPerPage = elapsedSec / safeCurrent;
      const remainingPages = safeTotal - safeCurrent;
      const est = Math.ceil(secPerPage * remainingPages);
      setEstimatedRemainingSec(est);
    } else if (safePercent >= 100) {
      setEstimatedRemainingSec(0);
    }
  }, [safeCurrent, safeTotal, safePercent]);

  return (
    <div className="w-full space-y-4" aria-live="polite">
      {/* Rare UI Step Player Timeline */}
      <div className="px-1 py-1 rounded-2xl bg-white/60 border border-[#E8DFD0]/60">
        <StepPlayer
          activeStepIndex={activeStageIndex}
          isError={progress?.status === 'error'}
        />
      </div>

      {/* Progress Bar */}
      <div
        className="relative w-full bg-gray-200 rounded-full h-5 overflow-hidden shadow-inner"
        role="progressbar"
        aria-valuenow={safePercent}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 transition-[width] duration-300 ease-out flex items-center justify-center",
            visualPercent === 6 && "animate-pulse"
          )}
          style={{ width: `${visualPercent}%` }}
        >
          {visualPercent > 10 && (
            <span className="text-[11px] font-bold text-white z-10">
              {safePercent}%
            </span>
          )}
        </div>

        {safePercent < 100 && (
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer"
            style={{ backgroundSize: '200% 100%' }}
          />
        )}
      </div>

      {/* Rare UI Inline AI Status & Progress */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <InlineAIStatus
          state={aiState}
          detail={
            safeTotal > 0
              ? (inFlight > 0
                  ? `${safeCurrent}/${safeTotal} pages (${inFlight} active)`
                  : `${safeCurrent}/${safeTotal} pages`)
              : undefined
          }
          timer={estimatedRemainingSec !== null && estimatedRemainingSec > 0 && safePercent < 100 ? estimatedRemainingSec : undefined}
        />

        <div className="flex items-center gap-2">
          {inFlight > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-[10px] font-bold tracking-tight animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
              {inFlight} active in parallel
            </span>
          )}
          {safeTotal > 0 && (
            <span className="text-[11px] text-[#8C7B6B] font-mono font-semibold">
              {safeCurrent}/{safeTotal}
            </span>
          )}
        </div>
      </div>

      {/* Detail Message */}
      {message && (
        <div className={cn(
          "text-[11px] px-3 py-2 rounded-xl border transition-all duration-300 font-medium flex items-center gap-2 break-words leading-relaxed",
          message.includes('Resuming') || message.includes('limit') || message.includes('quota') || message.includes('busy') || message.includes('high demand')
            ? "bg-amber-50 text-amber-900 border-amber-300 shadow-sm"
            : "text-gray-600 bg-gray-50 border-gray-200"
        )}>
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}

ChunkedProgressBar.propTypes = {
  progress: PropTypes.shape({
    percent: PropTypes.number,
    current: PropTypes.number,
    total: PropTypes.number,
    stage: PropTypes.string,
    message: PropTypes.string,
    inFlight: PropTypes.number,
    activePages: PropTypes.arrayOf(PropTypes.number)
  })
};
