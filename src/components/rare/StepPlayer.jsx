import PropTypes from 'prop-types';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { useTypedDocMotion } from '../../lib/motion';
import { cn } from '../../lib/utils';
import { DEFAULT_WORKFLOW_STEPS } from '../../lib/rareUiConstants';

export { DEFAULT_WORKFLOW_STEPS };

/**
 * Step Player component.
 * Visual representation of multi-stage progress driven strictly by server state.
 */
export function StepPlayer({
  steps = DEFAULT_WORKFLOW_STEPS,
  currentStep = 'ocr',
  activeStepIndex,
  isError = false,
  className
}) {
  const { reduce } = useTypedDocMotion();

  // Determine active index
  let activeIdx = typeof activeStepIndex === 'number'
    ? activeStepIndex
    : steps.findIndex(s => s.id === currentStep);
  if (activeIdx < 0) activeIdx = 0;

  return (
    <nav aria-label="Processing workflow stages" className={cn("w-full py-2", className)}>
      <ol className="flex items-center justify-between w-full relative">
        {steps.map((step, idx) => {
          const isCompleted = idx < activeIdx;
          const isCurrent = idx === activeIdx;
          const isPending = idx > activeIdx;

          return (
            <li
              key={step.id}
              className="flex-1 flex flex-col items-center relative group"
              aria-current={isCurrent ? 'step' : undefined}
            >
              {/* Connector line between steps */}
              {idx > 0 && (
                <div
                  className="absolute top-3.5 right-1/2 w-full h-[2px] -z-0"
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      "h-full w-full transition-colors duration-300",
                      isCompleted ? "bg-[#8B5E3C]" : isCurrent ? "bg-[#8B5E3C]/40" : "bg-[#E8DFD0]"
                    )}
                  />
                </div>
              )}

              {/* Node indicator */}
              <div
                className={cn(
                  "relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300 border-2 select-none shadow-xs",
                  isCompleted && "bg-[#8B5E3C] border-[#8B5E3C] text-white",
                  isCurrent && !isError && "bg-white border-[#8B5E3C] text-[#8B5E3C] ring-4 ring-[#8B5E3C]/15",
                  isCurrent && isError && "bg-red-500 border-red-500 text-white ring-4 ring-red-100",
                  isPending && "bg-[#FFFBF5] border-[#E8DFD0] text-[#8C7B6B]"
                )}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : isCurrent ? (
                  isError ? (
                    <AlertCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Loader2 className={cn("w-3.5 h-3.5", !reduce && "animate-spin")} />
                  )
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Step label */}
              <span
                className={cn(
                  "mt-2 text-[10px] sm:text-[11px] font-bold text-center leading-tight transition-colors px-1",
                  isCurrent && !isError && "text-[#8B5E3C]",
                  isCurrent && isError && "text-red-600",
                  isCompleted && "text-[#3D2E1C]",
                  isPending && "text-[#8C7B6B]/70"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

StepPlayer.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired
    })
  ),
  currentStep: PropTypes.string,
  activeStepIndex: PropTypes.number,
  isError: PropTypes.bool,
  className: PropTypes.string
};
