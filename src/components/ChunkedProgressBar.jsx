import { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Loader2, CheckCircle2, UploadCloud, Layers, Cpu, ShieldCheck, FileCheck } from 'lucide-react';
import { cn } from '../lib/utils';

const STAGES = [
  { id: 'upload', label: 'Upload', icon: UploadCloud },
  { id: 'render', label: 'Render', icon: Layers },
  { id: 'transcribe', label: 'Transcribe', icon: Cpu },
  { id: 'verify', label: 'Verify', icon: ShieldCheck },
  { id: 'format', label: 'Format', icon: FileCheck }
];

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
  const message = progress?.message || '';

  // Determine active stage
  let activeStageIndex = 0;
  if (safePercent >= 100) activeStageIndex = 4;
  else if (progress?.stage === 'formatting' || safePercent >= 90) activeStageIndex = 4;
  else if (progress?.stage === 'verifying' || safePercent >= 80) activeStageIndex = 3;
  else if (progress?.stage === 'transcribing' || safeCurrent > 0) activeStageIndex = 2;
  else if (progress?.stage === 'rendering' || safePercent > 0) activeStageIndex = 1;

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
      {/* 5-Stage Step Timeline */}
      <div className="grid grid-cols-5 gap-1 sm:gap-2">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isDone = idx < activeStageIndex || safePercent >= 100;
          const isCurrent = idx === activeStageIndex && safePercent < 100;
          return (
            <div
              key={stage.id}
              className={cn(
                "flex flex-col items-center p-1.5 sm:p-2 rounded-xl transition-all duration-300 text-center",
                isCurrent && "bg-blue-50 border border-blue-200 shadow-xs",
                isDone && "text-blue-700 bg-blue-50/50",
                !isDone && !isCurrent && "text-gray-400 opacity-60"
              )}
            >
              <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg mb-1">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-blue-600" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-blue-600 animate-spin" />
                ) : (
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold tracking-tight">
                {stage.label}
              </span>
            </div>
          );
        })}
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
          className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out flex items-center justify-center"
          style={{ width: `${safePercent}%` }}
        >
          {safePercent > 10 && (
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

      {/* Status & ETA */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
        <div className="flex items-center gap-2">
          {safePercent < 100 ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
              <span className="font-medium text-gray-700">
                {safeTotal > 0 ? (
                  safeCurrent > 0 ? (
                    <>Completed <span className="text-blue-600 font-bold">{safeCurrent}</span> of {safeTotal} pages</>
                  ) : (
                    <>Processing <span className="text-blue-600 font-bold">{safeTotal}</span> pages in parallel...</>
                  )
                ) : (
                  'Starting transcription...'
                )}
              </span>
            </>
          ) : (
            <span className="font-semibold text-green-600">✓ All pages completed!</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {estimatedRemainingSec !== null && estimatedRemainingSec > 0 && safePercent < 100 && (
            <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
              ~{estimatedRemainingSec}s remaining
            </span>
          )}
          {safeTotal > 0 && (
            <span className="text-[11px] text-gray-500 font-mono">
              {safeCurrent}/{safeTotal}
            </span>
          )}
        </div>
      </div>

      {/* Detail Message */}
      {message && (
        <div className={cn(
          "text-[11px] px-3 py-2 rounded-xl border transition-all duration-300 font-medium flex items-center gap-2 break-words leading-relaxed",
          message.includes('Resuming') || message.includes('limit') || message.includes('quota') || message.includes('busy')
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
    message: PropTypes.string
  })
};
