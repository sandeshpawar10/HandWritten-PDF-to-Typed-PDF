import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Save, ArrowLeft, Loader2, Check, RotateCcw, BarChart3, Eye, Pencil, Download, FileText, FileType, FileDown, Sparkles, Menu, X } from 'lucide-react';
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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
    setShowMobileMenu(false);
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
  const sidebarContent = (
    <div className="space-y-6">
      <div className="bg-[#FFFBF5] border border-[#E8DFD0] rounded-2xl shadow-sm p-6">
        <h4 className="text-sm font-bold text-[#8C7B6B] flex items-center gap-2 mb-6"><Download className="w-4 h-4 text-[#8B5E3C]" /> Export</h4>
        <div className="space-y-3">
          <button onClick={() => handleExport('docx')} disabled={!!isExporting} className={cn("bg-[#8B5E3C] text-white hover:bg-[#7A5133] rounded-xl font-medium transition-colors flex items-center justify-center w-full py-3 h-auto text-sm", isExporting && "opacity-60 cursor-wait")}>
            {isExporting === 'docx' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileType className="w-4 h-4 mr-2" />}
            {isExporting === 'docx' ? 'Generating…' : 'Download DOCX'}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleExport('pdf')} disabled={!!isExporting} className={cn("bg-[#FFFBF5] border border-[#E8DFD0] text-[#3D2E1C] hover:bg-[#F5F0E8] rounded-xl font-medium transition-colors flex items-center justify-center py-3 gap-2", isExporting && "opacity-60 cursor-wait")}>
              {isExporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {isExporting === 'pdf' ? '…' : 'PDF'}
            </button>
            <button onClick={() => handleExport('txt')} disabled={!!isExporting} className={cn("bg-[#FFFBF5] border border-[#E8DFD0] text-[#3D2E1C] hover:bg-[#F5F0E8] rounded-xl font-medium transition-colors flex items-center justify-center py-3 gap-2", isExporting && "opacity-60 cursor-wait")}>
              {isExporting === 'txt' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {isExporting === 'txt' ? '…' : 'TXT'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#FFFBF5] border border-[#E8DFD0] rounded-2xl shadow-sm p-6">
        <h4 className="text-sm font-bold text-[#8C7B6B] flex items-center gap-2 mb-6"><BarChart3 className="w-4 h-4 text-[#8B5E3C]" /> Document Stats</h4>
        <div className="space-y-4">
          {[{label:'Words',value:stats.words.toLocaleString()},{label:'Chars',value:stats.chars.toLocaleString()},{label:'Read',value:`${stats.readTime}m`},{label:'Pages',value:stats.pages}].map(({label,value}) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-sm font-medium text-[#8C7B6B]">{label}</span>
              <span className="text-sm font-bold text-[#3D2E1C]">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#FFFBF5] border border-[#E8DFD0] rounded-2xl shadow-sm p-6">
        <h4 className="text-sm font-bold text-[#8C7B6B] flex items-center gap-2 mb-6"><RotateCcw className="w-4 h-4 text-[#8B5E3C]" /> History</h4>
        {versions.length === 0 ? <p className="text-sm text-[#8C7B6B] italic">No snapshots yet.</p> : (
          <div className="space-y-2">{versions.slice(0, 5).map(v => (
            <button key={v.id} onClick={() => { if(confirm('Restore this snapshot?')) { setContent(v.content); setIsDirty(true); setShowMobileMenu(false); }}}
              className="w-full group p-3 rounded-2xl bg-[#FFFBF5] border border-[#E8DFD0] hover:border-[#8B5E3C]/30 transition-all text-left">
              <p className="text-sm font-bold text-[#3D2E1C] truncate mb-1 group-hover:text-[#8B5E3C] transition-colors">{v.note || 'Auto Snapshot'}</p>
              <p className="text-xs font-medium text-[#8C7B6B]">{v.createdAt?.toDate?.()?.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</p>
            </button>
          ))}</div>
        )}
      </div>

      {saveError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold">
          {saveError}
        </div>
      )}
    </div>
  );
  return (
    <div className="flex h-screen bg-[#F5F0E8] overflow-hidden relative">
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Floating Header */}
        <header className="h-20 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6 min-w-0">
            <button onClick={onBack} className="p-3 rounded-2xl bg-[#FFFBF5] border border-[#E8DFD0] hover:bg-[#E8DFD0]/50 transition-all" title="Back">
              <ArrowLeft className="w-4 h-4 text-[#3D2E1C]" />
            </button>
            <div className="flex flex-col min-w-0">
              <input type="text" value={title} onChange={e => { setTitle(e.target.value); setIsDirty(true); }}
                className="text-lg font-serif font-black text-[#3D2E1C] bg-transparent border-none focus:ring-0 p-0 truncate focus:outline-none tracking-tight" placeholder="Untitled Document" />
              <div className="flex items-center gap-2 mt-1">
                <AnimatedBadge isDirty={isDirty} saveSuccess={saveSuccess} />
                {lastSaved && !isDirty && (
                  <span className="text-[10px] text-[#8C7B6B] font-bold tracking-wider">
                    Last synced {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Mode Switcher */}
            <div className="flex items-center rounded-2xl bg-[#FFFBF5] border border-[#E8DFD0] p-1">
              <button onClick={() => setMode('preview')}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold transition-all duration-300",
                  mode === 'preview' ? "bg-[#8B5E3C]/10 text-[#8B5E3C]" : "text-[#8C7B6B] hover:text-[#3D2E1C]")}>
                <Eye className="w-3.5 h-3.5" />Preview
              </button>
              <button onClick={() => setMode('edit')}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold transition-all duration-300",
                  mode === 'edit' ? "bg-[#8B5E3C]/10 text-[#8B5E3C]" : "text-[#8C7B6B] hover:text-[#3D2E1C]")}>
                <Pencil className="w-3.5 h-3.5" />Edit
              </button>
            </div>

            <button onClick={handleSave} disabled={isSaving || !isDirty}
              className={cn("bg-[#8B5E3C] text-white hover:bg-[#7A5133] rounded-xl font-medium transition-colors flex items-center justify-center py-2.5 px-4 sm:px-5 h-11", !isDirty && "opacity-50 grayscale cursor-not-allowed")}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin sm:mr-2" /> : saveSuccess ? <Check className="w-4 h-4 sm:mr-2" /> : <Save className="w-4 h-4 sm:mr-2" />}
              <span className="hidden sm:inline">{isSaving ? 'Saving' : 'Sync'}</span>
            </button>

            <button onClick={() => setShowMobileMenu(true)} className="lg:hidden p-3 rounded-xl bg-[#FFFBF5] border border-[#E8DFD0] hover:bg-[#E8DFD0]/50 transition-all text-[#3D2E1C] h-11 flex items-center justify-center">
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Paper Canvas */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-12 flex justify-center items-start scroll-smooth">
          <motion.div layout initial={{y:40, opacity:0}} animate={{y:0, opacity:1}}
            className="w-full max-w-[850px] min-h-[1100px] rounded-[1rem] shadow-[0_4px_20px_rgba(139,94,60,0.08)] relative overflow-hidden group bg-white border-t-4 border-t-[#8B5E3C] border-x border-b border-[#E8DFD0]">
            
            <AnimatePresence mode="wait">
              {mode === 'edit' ? (
                <motion.div key="edit" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="p-16 sm:p-24">
                  <textarea value={content} onChange={e => { setContent(e.target.value); setIsDirty(true); setSaveSuccess(false); }}
                    className="w-full min-h-[900px] resize-none border-none focus:ring-0 p-0 text-[#3D2E1C] leading-relaxed text-lg bg-transparent placeholder:text-[#8C7B6B]/50 font-mono focus:outline-none"
                    placeholder="Type or paste markdown..." spellCheck={false} />
                </motion.div>
              ) : (
                <motion.div key="preview" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="p-16 sm:p-24">
                  <div className="mb-12 pb-8 border-b border-[#E8DFD0]">
                    <h1 className="text-6xl font-serif font-black text-[#3D2E1C] leading-tight tracking-tighter-title">{title}</h1>
                  </div>
                  {content.trim() ? <MarkdownPreview content={content} /> : <div className="flex flex-col items-center justify-center py-32 opacity-50"><Sparkles className="w-12 h-12 mb-4 text-[#8B5E3C]" /><p className="font-serif font-bold tracking-wide text-sm text-[#3D2E1C]">Your document will appear here</p></div>}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Lazy Print-Only Container — only rendered when exporting PDF */}
            {showPrintPreview && (
              <div id="pdf-export-content" className="hidden print:block absolute inset-0 bg-white p-[20mm] z-[-1] pointer-events-none opacity-0 print:opacity-100 print:z-[9999] print:relative print:p-0">
                <div className="mb-12 pb-8 border-b border-[#3D2E1C]">
                  <h1 className="text-4xl font-serif font-black text-[#3D2E1C] leading-tight">{title}</h1>
                </div>
                <MarkdownPreview content={content} />
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Floating Control Panel (Right Sidebar) */}
      <aside className="w-80 p-6 flex-col overflow-y-auto shrink-0 hidden lg:flex relative z-10">
        {sidebarContent}
      </aside>
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {showMobileMenu && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} 
              className="fixed inset-0 bg-[#3D2E1C]/40 backdrop-blur-sm z-40 lg:hidden print:hidden" 
              onClick={() => setShowMobileMenu(false)} />
            <motion.aside initial={{x:300}} animate={{x:0}} exit={{x:300}} transition={{type:'spring', damping:30, stiffness:300}} 
              className="fixed right-0 top-0 bottom-0 w-80 bg-[#F5F0E8] border-l border-[#E8DFD0] z-50 lg:hidden shadow-xl p-6 flex flex-col overflow-y-auto print:hidden">
              
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif font-black text-lg text-[#3D2E1C]">Document Options</h3>
                <button onClick={() => setShowMobileMenu(false)} className="p-2 rounded-xl bg-white border border-[#E8DFD0] shadow-sm text-[#3D2E1C]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnimatedBadge({ isDirty, saveSuccess }) {
  if (!isDirty && !saveSuccess) return null;
  return (
    <motion.div initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}}
      className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium tracking-wide",
        isDirty ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-[#5B8C5A]/10 text-[#5B8C5A] border border-[#5B8C5A]/20")}>
      <div className={cn("w-1.5 h-1.5 rounded-full", isDirty ? "bg-amber-500 animate-pulse" : "bg-[#5B8C5A]")} />
      {isDirty ? 'Unsaved' : 'Saved'}
    </motion.div>
  );
}
