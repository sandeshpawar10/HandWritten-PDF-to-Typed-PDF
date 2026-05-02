import React, { useState, useEffect } from 'react';
import { Save, ArrowLeft, Loader2, Check, CheckCircle2, RotateCcw, BarChart3, Eye, Pencil, Download, FileText, FileType, FileDown } from 'lucide-react';
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
      setSaveError('Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = (format: 'docx' | 'pdf' | 'txt') => {
    if (format === 'docx') exportToDocx(title, content);
    else if (format === 'pdf') exportToPdf(title, content);
    else exportToTxt(title, content);
  };

  const stats = {
    words: content.trim() ? content.trim().split(/\s+/).length : 0,
    chars: content.length,
    readTime: Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200)),
    pages: (content.match(/^--- Page \d+ ---$/m) || []).length + 1,
  };

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <header className="h-14 border-b border-border px-4 sm:px-6 flex items-center justify-between bg-surface/50 backdrop-blur shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="p-2 rounded-xl hover:bg-surface text-text-dim hover:text-text-main transition-all" title="Back">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <input type="text" value={title} onChange={e => { setTitle(e.target.value); setIsDirty(true); }}
              className="text-sm font-semibold text-text-main bg-transparent border-none focus:ring-0 p-0 min-w-0 flex-1 focus:outline-none" placeholder="Untitled Document" />
            <AnimatedBadge isDirty={isDirty} saveSuccess={saveSuccess} />
          </div>
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex items-center rounded-xl bg-surface border border-border p-0.5">
              <button onClick={() => setMode('preview')}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200",
                  mode === 'preview' ? "bg-accent/15 text-accent border border-accent/25" : "text-text-dim hover:text-text-main")}>
                <Eye className="w-3 h-3" /><span className="hidden sm:inline">Preview</span>
              </button>
              <button onClick={() => setMode('edit')}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200",
                  mode === 'edit' ? "bg-accent/15 text-accent border border-accent/25" : "text-text-dim hover:text-text-main")}>
                <Pencil className="w-3 h-3" /><span className="hidden sm:inline">Edit</span>
              </button>
            </div>
            {lastSaved && !isDirty && (
              <span className="text-[11px] text-text-dim font-mono hidden lg:block">
                Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button onClick={handleSave} disabled={isSaving || !isDirty}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
                isDirty ? "text-bg" : "text-text-dim bg-surface border border-border opacity-50 cursor-not-allowed")}
              style={isDirty ? {background:'linear-gradient(135deg,#6ee7f7,#a78bfa)'} : {}}>
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save'}</span>
            </button>
          </div>
        </header>

        {/* Document area */}
        <div className="flex-1 overflow-y-auto bg-[#0a0a0f] p-4 sm:p-8 flex justify-center">
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}}
            className="w-full max-w-[780px] min-h-[1056px] rounded-2xl shadow-2xl shadow-black/80 relative" style={{background:'#fafaf9'}}>
            <div className="absolute top-6 right-8 text-[10px] text-gray-300 font-mono select-none">TYPED DOCUMENT</div>
            <div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl" style={{background:'linear-gradient(90deg,#6ee7f7,#a78bfa,#34d399)'}} />
            <AnimatePresence mode="wait">
              {mode === 'edit' ? (
                <motion.div key="edit" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="p-10 sm:p-16">
                  <textarea value={content} onChange={e => { setContent(e.target.value); setIsDirty(true); setSaveSuccess(false); }}
                    className="w-full min-h-[900px] resize-none border-none focus:ring-0 p-0 text-gray-800 leading-8 text-base bg-transparent placeholder:text-gray-300 font-mono focus:outline-none"
                    placeholder="Your transcribed Markdown text..." spellCheck={false} />
                </motion.div>
              ) : (
                <motion.div key="preview" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="p-10 sm:p-16">
                  {content.trim() ? <MarkdownPreview content={content} /> : <p className="text-gray-400 italic text-center py-20">No content yet.</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Right sidebar */}
      <aside className="w-64 bg-sidebar border-l border-border flex-col overflow-y-auto shrink-0 hidden md:flex">
        <div className="p-5 space-y-8">
          <div className="space-y-3">
            <h4 className="text-[11px] font-mono font-semibold text-text-dim uppercase tracking-widest flex items-center gap-2"><Download className="w-3.5 h-3.5" /> Export</h4>
            <div className="space-y-2">
              <button onClick={() => handleExport('docx')} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-bg transition-all hover:opacity-90" style={{background:'linear-gradient(135deg,#6ee7f7,#a78bfa)'}}>
                <FileType className="w-3.5 h-3.5" /> Download DOCX
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleExport('pdf')} className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold text-text-mid bg-surface border border-border hover:border-accent/30 hover:text-accent transition-all uppercase">
                  <FileDown className="w-3 h-3" /> PDF
                </button>
                <button onClick={() => handleExport('txt')} className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold text-text-mid bg-surface border border-border hover:border-accent/30 hover:text-accent transition-all uppercase">
                  <FileText className="w-3 h-3" /> TXT
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-[11px] font-mono font-semibold text-text-dim uppercase tracking-widest flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5" /> Stats</h4>
            <div className="space-y-0 rounded-xl bg-surface border border-border overflow-hidden">
              {[{label:'Words',value:stats.words.toLocaleString()},{label:'Characters',value:stats.chars.toLocaleString()},{label:'Read time',value:`${stats.readTime} min`},{label:'Pages',value:stats.pages}].map(({label,value}) => (
                <div key={label} className="flex justify-between items-center py-2.5 px-3 border-b border-border last:border-0">
                  <span className="text-[11px] text-text-dim">{label}</span>
                  <span className="text-[11px] font-mono font-semibold text-text-main">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-[11px] font-mono font-semibold text-text-dim uppercase tracking-widest flex items-center gap-2"><RotateCcw className="w-3.5 h-3.5" /> History</h4>
            {versions.length === 0 ? <p className="text-[11px] text-text-dim italic">No saved versions yet.</p> : (
              <div className="space-y-1">{versions.slice(0, 8).map(v => (
                <button key={v.id} onClick={() => { if(confirm('Restore this version?')) { setContent(v.content); setIsDirty(true); }}}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] text-text-dim hover:text-text-main hover:bg-surface border border-transparent hover:border-border transition-all text-left group">
                  <span className="truncate">{v.note || 'Manual edit'}</span>
                  <span className="font-mono text-[10px] opacity-60 group-hover:opacity-100 shrink-0 ml-2">{v.createdAt?.toDate?.()?.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) || '—'}</span>
                </button>
              ))}</div>
            )}
          </div>
          {lastSaved && !isDirty && (
            <motion.div initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-accent3/10 border border-accent3/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent3 shrink-0" /><span className="text-[11px] font-medium text-accent3">Synced to cloud</span>
            </motion.div>
          )}
          {saveError && (<div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20"><p className="text-[11px] text-red-400">{saveError}</p></div>)}
        </div>
      </aside>
    </div>
  );
}

function AnimatedBadge({ isDirty, saveSuccess }: { isDirty: boolean; saveSuccess: boolean }) {
  if (!isDirty && !saveSuccess) return null;
  return (
    <motion.span initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} exit={{opacity:0}}
      className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0",
        isDirty ? "bg-amber-400/10 text-amber-400 border border-amber-400/20" : "bg-accent3/10 text-accent3 border border-accent3/20")}>
      {isDirty ? 'Unsaved' : '✓ Saved'}
    </motion.span>
  );
}
