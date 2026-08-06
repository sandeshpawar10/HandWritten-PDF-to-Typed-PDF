import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Save, ArrowLeft, Loader2, Check, RotateCcw, BarChart3, Eye, Pencil, Download, FileText, FileType, FileDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { updateDocument, saveVersion } from '../services/documents';
import { exportToDocx, exportToPdf, exportToTxt } from '../services/export';
import { MarkdownPreview } from './MarkdownPreview';
import { cn } from '../lib/utils';

export function Editor({ doc, onBack, versions }) {
  const [content, setContent] = useState(doc.content);
  const [title, setTitle] = useState(doc.title);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [mode, setMode] = useState('preview');
  const [isExporting, setIsExporting] = useState(null); // tracks which format is exporting
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Auto-save timer ref
  const autoSaveTimer = useRef(null);

  useEffect(() => {
    setContent(doc.content);
    setTitle(doc.title);
    setIsDirty(false);
  }, [doc]);

  // Memoized stats — only recalculates when content changes, not on every render
  const stats = useMemo(() => {
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    return {
      words,
      chars: content.length,
      readTime: Math.max(1, Math.ceil(words / 200)),
      pages: (content.match(/^--- Page \d+ ---$/m) || []).length + 1,
    };
  }, [content]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true); setSaveError(null); setSaveSuccess(false);
    try {
      await updateDocument(doc.id, { content, title });
      await saveVersion(doc.id, doc.userId, content, 'Manual save');
      setLastSaved(new Date());
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError('Save failed.');
    } finally {
      setIsSaving(false);
    }
  }, [content, title, doc.id, doc.userId, isSaving]);

  // Auto-save: debounced 5s after last edit
  useEffect(() => {
    if (!isDirty) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSave();
    }, 5000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [content, title, isDirty, handleSave]);

  const handleExport = async (format) => {
    setIsExporting(format);
    try {
      if (format === 'docx') {
        await exportToDocx(title, content);
      } else if (format === 'pdf') {
        // Lazy-render the print container, then export
        setShowPrintPreview(true);
        setMode('preview');
        // Wait for React to render the MarkdownPreview inside the print container
        await new Promise(r => setTimeout(r, 800));
        await exportToPdf(title, content);
      } else {
        await exportToTxt(title, content);
      }
    } finally {
      setTimeout(() => {
        setIsExporting(null);
        // Keep print preview for a bit in case the print dialog is still open
        setTimeout(() => setShowPrintPreview(false), 3000);
      }, 1000);
    }
  };

  return (
    <div className="flex h-screen bg-bg overflow-hidden relative">
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Floating Header */}
        <header className="h-20 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6 min-w-0">
            <button onClick={onBack} className="p-3 rounded-2xl glass hover:bg-white/5 transition-all" title="Back">
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
            <div className="flex flex-col min-w-0">
              <input type="text" value={title} onChange={e => { setTitle(e.target.value); setIsDirty(true); }}
                className="text-lg font-display font-black text-white bg-transparent border-none focus:ring-0 p-0 truncate focus:outline-none uppercase tracking-tight" placeholder="Untitled Document" />
              <div className="flex items-center gap-2 mt-1">
                <AnimatedBadge isDirty={isDirty} saveSuccess={saveSuccess} />
                {lastSaved && !isDirty && (
                  <span className="text-[10px] text-text-dim font-bold tracking-wider">
                    LAST SYNCED {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Mode Switcher */}
            <div className="flex items-center rounded-2xl glass p-1">
              <button onClick={() => setMode('preview')}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold transition-all duration-300",
                  mode === 'preview' ? "bg-accent/10 text-accent" : "text-text-dim hover:text-white")}>
                <Eye className="w-3.5 h-3.5" />Preview
              </button>
              <button onClick={() => setMode('edit')}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold transition-all duration-300",
                  mode === 'edit' ? "bg-accent/10 text-accent" : "text-text-dim hover:text-white")}>
                <Pencil className="w-3.5 h-3.5" />Edit
              </button>
            </div>

            <button onClick={handleSave} disabled={isSaving || !isDirty}
              className={cn("btn-primary py-2.5 px-5 h-11", !isDirty && "opacity-50 grayscale cursor-not-allowed")}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : saveSuccess ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              <span>{isSaving ? 'Saving' : 'Sync'}</span>
            </button>
          </div>
        </header>

        {/* Paper Canvas */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-12 flex justify-center items-start scroll-smooth">
          <motion.div layout initial={{y:40, opacity:0}} animate={{y:0, opacity:1}}
            className="w-full max-w-[850px] min-h-[1100px] rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative overflow-hidden group bg-[#fafaf9] border border-white/5">
            
            {/* Visual Accents */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-accent via-accent2 to-accent3" />
            <div className="absolute top-10 right-12 opacity-10 group-hover:opacity-30 transition-opacity font-display font-black text-xs tracking-[0.4em] select-none text-slate-900">TYPED · PRISM</div>
            
            <AnimatePresence mode="wait">
              {mode === 'edit' ? (
                <motion.div key="edit" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="p-16 sm:p-24">
                  <textarea value={content} onChange={e => { setContent(e.target.value); setIsDirty(true); setSaveSuccess(false); }}
                    className="w-full min-h-[900px] resize-none border-none focus:ring-0 p-0 text-slate-800 leading-relaxed text-lg bg-transparent placeholder:text-slate-300 font-mono focus:outline-none"
                    placeholder="Type or paste markdown..." spellCheck={false} />
                </motion.div>
              ) : (
                <motion.div key="preview" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="p-16 sm:p-24">
                  <div className="mb-12 pb-8 border-b border-slate-100">
                    <h1 className="text-6xl font-display font-black text-slate-900 leading-tight tracking-tighter-title uppercase">{title}</h1>
                  </div>
                  {content.trim() ? <MarkdownPreview content={content} /> : <div className="flex flex-col items-center justify-center py-32 opacity-20"><Sparkles className="w-12 h-12 mb-4" /><p className="font-display font-bold uppercase tracking-widest text-sm">Waiting for content...</p></div>}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Lazy Print-Only Container — only rendered when exporting PDF */}
            {showPrintPreview && (
              <div id="pdf-export-content" className="hidden print:block absolute inset-0 bg-white p-[20mm] z-[-1] pointer-events-none opacity-0 print:opacity-100 print:z-[9999] print:relative print:p-0">
                <div className="mb-12 pb-8 border-b border-slate-900">
                  <h1 className="text-4xl font-display font-black text-slate-900 leading-tight uppercase">{title}</h1>
                </div>
                <MarkdownPreview content={content} />
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Floating Control Panel (Right Sidebar) */}
      <aside className="w-80 p-6 flex-col overflow-y-auto shrink-0 hidden lg:flex relative z-10">
        <div className="space-y-6">
          
          <div className="glass-card p-6">
            <h4 className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] flex items-center gap-2 mb-6"><Download className="w-3.5 h-3.5 text-accent" /> Export Assets</h4>
            <div className="space-y-3">
              <button onClick={() => handleExport('docx')} disabled={!!isExporting} className={cn("btn-primary w-full py-3 h-auto text-xs", isExporting && "opacity-60 cursor-wait")}>
                {isExporting === 'docx' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileType className="w-4 h-4 mr-2" />}
                {isExporting === 'docx' ? 'Generating…' : 'Download DOCX'}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleExport('pdf')} disabled={!!isExporting} className={cn("btn-glass py-3 flex items-center justify-center gap-2", isExporting && "opacity-60 cursor-wait")}>
                  {isExporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                  {isExporting === 'pdf' ? '…' : 'PDF'}
                </button>
                <button onClick={() => handleExport('txt')} disabled={!!isExporting} className={cn("btn-glass py-3 flex items-center justify-center gap-2", isExporting && "opacity-60 cursor-wait")}>
                  {isExporting === 'txt' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  {isExporting === 'txt' ? '…' : 'TXT'}
                </button>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h4 className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] flex items-center gap-2 mb-6"><BarChart3 className="w-3.5 h-3.5 text-accent" /> Asset Stats</h4>
            <div className="space-y-4">
              {[{label:'Words',value:stats.words.toLocaleString()},{label:'Chars',value:stats.chars.toLocaleString()},{label:'Read',value:`${stats.readTime}m`},{label:'Pages',value:stats.pages}].map(({label,value}) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-text-dim">{label}</span>
                  <span className="text-[11px] font-black text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h4 className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] flex items-center gap-2 mb-6"><RotateCcw className="w-3.5 h-3.5 text-accent" /> Version History</h4>
            {versions.length === 0 ? <p className="text-[10px] text-text-dim italic">No snapshots yet.</p> : (
              <div className="space-y-2">{versions.slice(0, 5).map(v => (
                <button key={v.id} onClick={() => { if(confirm('Restore this snapshot?')) { setContent(v.content); setIsDirty(true); }}}
                  className="w-full group p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-accent/30 transition-all text-left">
                  <p className="text-[11px] font-bold text-white truncate mb-1 group-hover:text-accent transition-colors">{v.note || 'Auto Snapshot'}</p>
                  <p className="text-[9px] font-bold text-text-dim uppercase">{v.createdAt?.toDate?.()?.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</p>
                </button>
              ))}</div>
            )}
          </div>

          {saveError && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-bold">
              {saveError}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function AnimatedBadge({ isDirty, saveSuccess }) {
  if (!isDirty && !saveSuccess) return null;
  return (
    <motion.div initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}}
      className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black tracking-widest uppercase",
        isDirty ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-accent3/10 text-accent3 border border-accent3/20")}>
      <div className={cn("w-1 h-1 rounded-full", isDirty ? "bg-amber-500 animate-pulse" : "bg-accent3")} />
      {isDirty ? 'UNSYNCED' : 'SECURE'}
    </motion.div>
  );
}
