import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Bookmark } from 'lucide-react';
import { cn } from '../../lib/utils';
import { extractHeadingsFromMarkdown } from '../../lib/rareUiConstants';

export { extractHeadingsFromMarkdown };

/**
 * Rail TOC component.
 * Provides scroll-linked in-document table of contents navigation.
 */
export function RailTOC({
  headings: explicitHeadings,
  content,
  containerRef,
  onSelect,
  className
}) {
  const headings = useMemo(() => {
    if (Array.isArray(explicitHeadings) && explicitHeadings.length > 0) {
      return explicitHeadings;
    }
    return extractHeadingsFromMarkdown(content);
  }, [explicitHeadings, content]);

  const [activeId, setActiveId] = useState('');

  // Scroll spy effect
  useEffect(() => {
    if (!headings.length) return;

    const handleScroll = () => {
      const container = containerRef?.current || window;
      const scrollY = container === window ? window.scrollY : container.scrollTop;

      // Find heading closest to top
      for (let i = headings.length - 1; i >= 0; i--) {
        const item = headings[i];
        const elem = document.getElementById(item.id);
        if (elem) {
          const offsetTop = elem.offsetTop;
          if (scrollY >= offsetTop - 120) {
            setActiveId(item.id);
            return;
          }
        }
      }
      if (headings[0]) setActiveId(headings[0].id);
    };

    const target = containerRef?.current || window;
    target.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => target.removeEventListener('scroll', handleScroll);
  }, [headings, containerRef]);

  const scrollToHeading = (id) => {
    setActiveId(id);
    onSelect?.(id);
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!headings.length) return null;

  return (
    <nav
      aria-label="Document outline"
      className={cn(
        "p-4 rounded-2xl bg-[#FFFBF5]/90 border border-[#E8DFD0] backdrop-blur-sm shadow-sm text-xs font-sans",
        className
      )}
    >
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#E8DFD0] text-[#8B5E3C] font-bold">
        <Bookmark className="w-4 h-4" />
        <span className="uppercase tracking-wider text-[10px]">Contents</span>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-[#8B5E3C]/10 font-mono">
          {headings.length}
        </span>
      </div>

      <ul className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
        {headings.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li
              key={item.id}
              style={{ paddingLeft: `${Math.min(item.depth, 3) * 12}px` }}
            >
              <button
                type="button"
                onClick={() => scrollToHeading(item.id)}
                className={cn(
                  "w-full text-left py-1.5 px-2 rounded-lg transition-all flex items-center gap-1.5 group",
                  isActive
                    ? "bg-[#8B5E3C]/10 text-[#8B5E3C] font-bold shadow-2xs"
                    : "text-[#8C7B6B] hover:text-[#3D2E1C] hover:bg-[#F5F0E8]"
                )}
                aria-current={isActive ? 'true' : undefined}
              >
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0 transition-colors",
                    isActive ? "bg-[#8B5E3C]" : "bg-[#D4C9B8] group-hover:bg-[#8C7B6B]"
                  )}
                />
                <span className="truncate leading-tight">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

RailTOC.propTypes = {
  headings: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      depth: PropTypes.number
    })
  ),
  content: PropTypes.string,
  containerRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })]),
  onSelect: PropTypes.func,
  className: PropTypes.string
};
