import PropTypes from 'prop-types';
import {
  Clock, FileText, ScanText, ShieldCheck, FileOutput,
  CheckCircle2, AlertTriangle, Loader2
} from 'lucide-react';
import { useTypedDocMotion } from '../../lib/motion';
import { cn } from '../../lib/utils';
import { DEFAULT_AI_STATES as BASE_AI_STATES } from '../../lib/rareUiConstants';

const STATE_ICONS = {
  queued: Clock,
  reading: FileText,
  ocr: ScanText,
  transcribing: ScanText,
  verifying: ShieldCheck,
  formatting: FileOutput,
  done: CheckCircle2,
  completed: CheckCircle2,
  error: AlertTriangle,
  failed: AlertTriangle
};

export const DEFAULT_AI_STATES = Object.fromEntries(
  Object.entries(BASE_AI_STATES).map(([k, v]) => [k, { ...v, icon: STATE_ICONS[k] || Loader2 }])
);

/**
 * Format seconds into mm:ss or seconds label.
 */
function formatTimer(seconds) {
  if (typeof seconds !== 'number' || seconds <= 0) return null;
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s < 10 ? '0' : ''}${s}s`;
}

/**
 * Inline AI Status component.
 * Provides trustworthy, authoritative stage indicators for OCR and document generation.
 */
export function InlineAIStatus({
  state = 'queued',
  detail,
  timer,
  states = DEFAULT_AI_STATES,
  className
}) {
  const { reduce } = useTypedDocMotion();
  const normalizedKey = String(state || 'queued').toLowerCase();
  const currentConfig = states[normalizedKey] || DEFAULT_AI_STATES[normalizedKey] || DEFAULT_AI_STATES.queued;

  const Icon = currentConfig.icon || Loader2;
  const isSpinning = !reduce && (currentConfig.spin || ['reading', 'ocr', 'transcribing', 'verifying', 'formatting'].includes(normalizedKey));

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-colors shadow-xs select-none",
        currentConfig.bg || "bg-[#FFFBF5]",
        currentConfig.color || "text-[#3D2E1C]",
        currentConfig.border || "border-[#E8DFD0]",
        className
      )}
    >
      <span className="flex items-center justify-center shrink-0">
        <Icon className={cn("w-3.5 h-3.5", isSpinning && "animate-spin")} />
      </span>

      <span className="font-bold tracking-tight">
        {currentConfig.label}
      </span>

      {detail && (
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-white/70 border border-current/20 opacity-90">
          {detail}
        </span>
      )}

      {timer !== undefined && timer !== null && timer > 0 && (
        <span className="font-mono text-[10px] opacity-75">
          ({formatTimer(timer)})
        </span>
      )}
    </div>
  );
}

InlineAIStatus.propTypes = {
  state: PropTypes.string,
  detail: PropTypes.string,
  timer: PropTypes.number,
  states: PropTypes.object,
  className: PropTypes.string
};
