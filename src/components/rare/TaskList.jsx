import PropTypes from 'prop-types';
import { Check, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Task List component.
 * Used for OCR verification checklists, equation reviews, and preflight checks.
 */
export function TaskList({
  tasks = [],
  onToggleTask,
  title = 'Verification Checklist',
  className
}) {
  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  if (!tasks.length) return null;

  return (
    <div className={cn("p-4 rounded-2xl bg-[#FFFBF5] border border-[#E8DFD0] shadow-xs text-xs font-sans", className)}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#E8DFD0]">
        <div className="flex items-center gap-2">
          {allCompleted ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600" />
          )}
          <span className="font-bold text-[#3D2E1C]">{title}</span>
        </div>
        <span className={cn(
          "font-mono text-[10px] font-bold px-2 py-0.5 rounded-full",
          allCompleted ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
        )}>
          {completedCount}/{totalCount} resolved
        </span>
      </div>

      {/* Task Items */}
      <ul className="space-y-1.5 pt-1" role="list">
        {tasks.map((task) => {
          const isDone = Boolean(task.completed);
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onToggleTask?.(task.id)}
                className={cn(
                  "w-full text-left p-2 rounded-xl transition-all flex items-start gap-2.5 group border",
                  isDone
                    ? "bg-white/40 border-[#E8DFD0]/40 text-[#8C7B6B]"
                    : "bg-white border-[#E8DFD0] text-[#3D2E1C] hover:border-[#8B5E3C]/30 shadow-2xs"
                )}
                role="checkbox"
                aria-checked={isDone}
              >
                <div
                  className={cn(
                    "w-4 h-4 mt-0.5 rounded-md flex items-center justify-center shrink-0 border transition-colors",
                    isDone
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "border-[#D4C9B8] group-hover:border-[#8B5E3C] bg-white"
                  )}
                >
                  {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                </div>

                <div className="flex-1 min-w-0">
                  <span className={cn("leading-relaxed block", isDone && "line-through opacity-70")}>
                    {task.label}
                  </span>
                  {task.detail && (
                    <span className="text-[10px] text-[#8C7B6B] block mt-0.5 font-mono">
                      {task.detail}
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

TaskList.propTypes = {
  tasks: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      completed: PropTypes.bool,
      detail: PropTypes.string
    })
  ).isRequired,
  onToggleTask: PropTypes.func,
  title: PropTypes.string,
  className: PropTypes.string
};
