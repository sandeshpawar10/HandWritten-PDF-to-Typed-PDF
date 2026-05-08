import React, { useState, useEffect } from 'react';
import { Save, ArrowLeft, Loader2, Check, CheckCircle2, RotateCcw, BarChart3, Eye, Pencil, Download, FileText, FileType, FileDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Document, DocumentVersion } from '../types';
import { updateDocument, saveVersion } from '../services/documents';
import { exportToDocx, exportToPdf, exportToTxt } from '../services/export';
import { MarkdownPreview } from './MarkdownPreview';
import { cn } from '../lib/utils';

interface EditorProps {
  document: Document;
  onBack: () => void;
  versions: DocumentVersion[];
}

export function Editor({ document, onBack, versions }: EditorProps) {
  const [content, setContent] = useState(document.content);
  const [title, setTitle] = useState(document.title);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');

  useEffect(() => {
    setContent(document.content);
    setTitle(document.title);
    setIsDirty(false);
  }, [document]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true); setSaveError(null); setSaveSuccess(false);
    try {
      await updateDocument(document.id, { content, title });
      await saveVersion(document.id, document.userId, content, 'Manual save');
      setLastSaved(new Date());
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError('Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = (format: 'docx' | 'pdf' | 'txt') => {
    if (format === 'docx') exportToDocx(title, content);
    else if (format === 'pdf') {
      setMode('preview');
      setTimeout(() => {
        exportToPdf(title, content);
      }, 500);
    }
    else exportToTxt(title, content);
  };

  const stats = {
    words: content.trim() ? content.trim().split(/\s+/).length : 0,
    chars: content.length,
    readTime: Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200)),
    pages: (content.match(/^--- Page \d+ ---$/m) || []).length + 1,
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
                <motion.div key="preview" id="pdf-export-content" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="p-16 sm:p-24">
                  <div className="mb-12 pb-8 border-b border-slate-100">
                    <h1 className="text-6xl font-display font-black text-slate-900 leading-tight tracking-tighter-title uppercase">{title}</h1>
                  </div>
                  {content.trim() ? <MarkdownPreview content={content} /> : <div className="flex flex-col items-center justify-center py-32 opacity-20"><Sparkles className="w-12 h-12 mb-4" /><p className="font-display font-bold uppercase tracking-widest text-sm">Waiting for content...</p></div>}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Floating Control Panel (Right Sidebar) */}
      <aside className="w-80 p-6 flex-col overflow-y-auto shrink-0 hidden lg:flex relative z-10">
        <div className="space-y-6">
          
          <div className="glass-card p-6">
            <h4 className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] flex items-center gap-2 mb-6"><Download className="w-3.5 h-3.5 text-accent" /> Export Assets</h4>
            <div className="space-y-3">
              <button onClick={() => handleExport('docx')} className="btn-primary w-full py-3 h-auto text-xs">
                <FileType className="w-4 h-4 mr-2" /> Download DOCX
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleExport('pdf')} className="btn-glass py-3 flex items-center justify-center gap-2">
                  <FileDown className="w-3.5 h-3.5" /> PDF
                </button>
                <button onClick={() => handleExport('txt')} className="btn-glass py-3 flex items-center justify-center gap-2">
                  <FileText className="w-3.5 h-3.5" /> TXT
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

function AnimatedBadge({ isDirty, saveSuccess }: { isDirty: boolean; saveSuccess: boolean }) {
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
