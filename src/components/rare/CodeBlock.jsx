import { useState } from 'react';
import PropTypes from 'prop-types';
import { Copy, Check, Terminal } from 'lucide-react';
import { toast } from '../Toast';
import { cn } from '../../lib/utils';

/**
 * Code Block component with line numbers, language tag, and copy button.
 */
export function CodeBlock({
  code = '',
  language = 'text',
  filename,
  highlightLines = [],
  maxHeight = '420px',
  className
}) {
  const [copied, setCopied] = useState(false);

  const lines = code ? code.split('\n') : [''];

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
      toast.error('Could not copy code');
    }
  };

  return (
    <div className={cn("my-4 rounded-2xl overflow-hidden border border-[#3D2E1C]/20 bg-[#1E1A17] text-[#F5F0E8] shadow-md font-mono text-[12px]", className)}>
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#28221D] border-b border-[#3D2E1C]/30 text-[11px] text-[#A69788]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#C4853C]" />
          {filename ? (
            <span className="font-bold text-[#E8DFD0]">{filename}</span>
          ) : (
            <span className="uppercase tracking-wider font-semibold text-[10px]">{language || 'code'}</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code snippet"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-bold">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Area with Line Numbers */}
      <div
        className="overflow-auto p-4 flex leading-relaxed select-text"
        style={{ maxHeight }}
      >
        {/* Line Numbers Column */}
        <div className="select-none text-right pr-4 text-[#66584C] font-mono border-r border-[#3D2E1C]/40">
          {lines.map((_, i) => (
            <div key={i} className="leading-6 text-[11px]">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code Content Column */}
        <pre className="pl-4 flex-1 m-0 overflow-visible font-mono leading-6">
          <code>
            {lines.map((line, i) => {
              const isHighlighted = highlightLines.includes(i + 1);
              return (
                <div
                  key={i}
                  className={cn(
                    "whitespace-pre",
                    isHighlighted && "bg-[#8B5E3C]/30 -mx-4 px-4 rounded-xs border-l-2 border-[#C4853C]"
                  )}
                >
                  {line || ' '}
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}

CodeBlock.propTypes = {
  code: PropTypes.string.isRequired,
  language: PropTypes.string,
  filename: PropTypes.string,
  highlightLines: PropTypes.arrayOf(PropTypes.number),
  maxHeight: PropTypes.string,
  className: PropTypes.string
};
