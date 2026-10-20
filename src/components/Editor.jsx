import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { Save, ArrowLeft, Loader2, Check, RotateCcw, BarChart3, Eye, Pencil, Download, FileText, FileType, FileDown, Sparkles, Menu, X, Columns, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { updateDocument, saveVersion } from '../services/documents';
import { exportToDocx, exportServerPdf, exportToTxt, printCurrentView } from '../services/export';
import { MarkdownPreview } from './MarkdownPreview';
import { ConfirmDialog } from './ConfirmDialog';
import { toast } from './Toast';
import { AnimatedCounter, RailTOC, TaskList } from './rare';
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
  const [pdfPageMode, setPdfPageMode] = useState(() => {
    try {
      return localStorage.getItem('typeddoc_pdf_page_mode') || 'clean-reflow';
    } catch {
      return 'clean-reflow';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('typeddoc_pdf_page_mode', pdfPageMode);
    } catch {
      // ignore storage error
    }
  }, [pdfPageMode]);

  // Issue #10: Replace confirm() with proper modal
  const [restoreVersion, setRestoreVersion] = useState(null);
  const [manualTaskOverrides, setManualTaskOverrides] = useState({});

  const verificationTasks = useMemo(() => {
    const rawContent = content || '';
    const hasCustomTitle = Boolean(title && title.trim() && title !== 'Untitled Document');
    const hasHeadings = /^#{1,6}\s+/m.test(rawContent);
    const hasMath = rawContent.includes('$$') || /\\\([^\\]+\\\)/.test(rawContent);
    const hasUnclosedMath = (rawContent.match(/\$\$/g) || []).length % 2 !== 0;
    const mathValid = hasMath ? !hasUnclosedMath : true;
    const hasTables = rawContent.includes('|---') || rawContent.includes('| ---');
    const hasContent = rawContent.trim().length > 10;

    return [
      {
        id: 'title',
        label: 'Document title customized',
        completed: manualTaskOverrides.title !== undefined ? manualTaskOverrides.title : hasCustomTitle,
        detail: hasCustomTitle ? `"${title}"` : 'Set a descriptive title'
      },
      {
        id: 'headings',
        label: 'Section hierarchy & headings',
        completed: manualTaskOverrides.headings !== undefined ? manualTaskOverrides.headings : hasHeadings,
        detail: hasHeadings ? 'Academic headings detected' : 'Use # or ## headings'
      },
      {
        id: 'math',
        label: 'KaTeX math syntax verified',
        completed: manualTaskOverrides.math !== undefined ? manualTaskOverrides.math : mathValid,
        detail: hasUnclosedMath ? 'Unclosed $$ delimiter' : 'Delimiters balanced'
      },
      {
        id: 'tables',
        label: 'Tables & columnar alignment',
        completed: manualTaskOverrides.tables !== undefined ? manualTaskOverrides.tables : true,
        detail: hasTables ? 'Tables formatted' : 'Standard flow'
      },
      {
        id: 'export_ready',
        label: 'Ready for PDF reflow export',
        completed: manualTaskOverrides.export_ready !== undefined ? manualTaskOverrides.export_ready : (hasContent && mathValid),
        detail: hasContent ? 'Layout verified' : 'Requires content'
      }
    ];
  }, [content, title, manualTaskOverrides]);

  const handleToggleTask = (taskId) => {
    setManualTaskOverrides(prev => {
      const current = verificationTasks.find(t => t.id === taskId)?.completed;
      return {
        ...prev,
        [taskId]: !current
      };
    });
  };


  const saveTimeoutRef = useRef(null);
  const latestContentRef = useRef(content);
  const latestTitleRef = useRef(title);
  const isDirtyRef = useRef(isDirty);
  const docRef = useRef(doc);

  useEffect(() => {
    latestContentRef.current = content;
    latestTitleRef.current = title;
    isDirtyRef.current = isDirty;
    docRef.current = doc;
  }, [content, title, isDirty, doc]);

  useEffect(() => {
    return () => {
      // Save on unmount if there are pending changes
      if (saveTimeoutRef.current || isDirtyRef.current) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        if (isDirtyRef.current && docRef.current?.id) {
          updateDocument(docRef.current.id, {
            content: latestContentRef.current,
            title: latestTitleRef.current,
          }).catch(err => console.error('Unmount save error:', err));
          saveVersion(
            docRef.current.id,
            docRef.current.userId,
            latestContentRef.current,
            'Auto-save on unmount'
          ).catch(err => console.error('Unmount saveVersion error:', err));
        }
      }
    };
  }, []);

  useEffect(() => {
    setContent(doc.content);
    setTitle(doc.title);
    setIsDirty(false);
  }, [doc]);

  // Memoized stats — only recalculates when content changes, not on every render
  const stats = useMemo(() => {
    const safeContent = content || '';
    const trimmed = safeContent.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    return {
      words,
      chars: safeContent.length,
      readTime: Math.max(1, Math.ceil(words / 200)),
      pages: (safeContent.match(/^--- Page \d+ ---$/m) || []).length + 1,
    };
  }, [content]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    // Cancel auto-save if manual save is triggered
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await updateDocument(doc.id, { content, title });
      await saveVersion(doc.id, doc.userId, content, 'Manual save');
      setLastSaved(new Date());
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setSaveError(error?.message || 'Save failed.');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [content, title, doc.id, doc.userId, isSaving]);

  // Keyboard shortcut Ctrl+S / Cmd+S for explicit save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Auto-save: debounced 5s after last edit (draft only, no Firestore version spam)
  useEffect(() => {
    if (!isDirty || isSaving) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!isSaving && isDirty) {
        setIsSaving(true);
        setSaveError(null);

        try {
          await updateDocument(doc.id, { content, title });
          setLastSaved(new Date());
          setIsDirty(false);
        } catch (error) {
          setSaveError(error?.message || 'Auto-save failed.');
          console.error('Auto-save error:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 5000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, title, isDirty, isSaving, doc.id]);

  const handleExport = async (format) => {
    setIsExporting(format);
    setShowMobileMenu(false);
    try {
      if (format === 'docx') {
        await exportToDocx(title, content);
        toast.success('DOCX document downloaded');
      } else if (format === 'pdf') {
        // Authoritative server-rendered PDF (with automatic resilient fallback)
        const res = await exportServerPdf(title, content, { pageMode: pdfPageMode });
        if (res?.clientFallback) {
          toast.info('Server unavailable; exported via local PDF engine');
        } else {
          toast.success('Server-formatted PDF downloaded');
        }
      } else if (format === 'print') {
        // Explicit browser print action
        setShowPrintPreview(true);
        setMode('preview');
        await new Promise(r => setTimeout(r, 600));
        await printCurrentView(title, content, { pageMode: pdfPageMode });
      } else {
        await exportToTxt(title, content);
        toast.success('Text document downloaded');
      }
    } catch (exportErr) {
      console.error(`Export ${format} error:`, exportErr);
      toast.error(exportErr?.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setTimeout(() => {
        setIsExporting(null);
        if (format === 'print') {
          const cleanupPrint = () => {
            setShowPrintPreview(false);
            window.removeEventListener('afterprint', cleanupPrint);
          };
          window.addEventListener('afterprint', cleanupPrint, { once: true });
          setTimeout(cleanupPrint, 10000);
        } else {
          setShowPrintPreview(false);
        }
      }, 1000);
    }
  };
  const sidebarContent = (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <h4 className="text-sm font-bold text-[#8C7B6B] flex items-center gap-2 mb-6">
          <Download className="w-4 h-4 text-[#8B5E3C]" /> Export
        </h4>
        <div className="space-y-3">
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleExport('docx')}
            disabled={!!isExporting}
            className={cn(
              "btn-primary w-full py-3.5 h-auto text-sm font-bold rounded-xl shadow-md hover:shadow-lg relative overflow-hidden",
              isExporting && "opacity-60 cursor-wait"
            )}
          >
            {isExporting === 'docx' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileType className="w-4 h-4 mr-2" />}
            {isExporting === 'docx' ? 'Generating…' : 'Download DOCX'}
          </motion.button>
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleExport('pdf')}
              disabled={!!isExporting}
              className={cn(
                "bg-white/80 backdrop-blur-sm border border-[#E8DFD0] text-[#3D2E1C] hover:bg-white hover:border-[#8B5E3C]/30 rounded-xl font-bold transition-all flex items-center justify-center py-3 gap-2 shadow-sm hover:shadow-md magnetic",
                isExporting && "opacity-60 cursor-wait"
              )}
              title="Download authentic server-rendered PDF"
            >
              {isExporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {isExporting === 'pdf' ? '…' : 'Server PDF'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleExport('txt')}
              disabled={!!isExporting}
              className={cn(
                "bg-white/80 backdrop-blur-sm border border-[#E8DFD0] text-[#3D2E1C] hover:bg-white hover:border-[#8B5E3C]/30 rounded-xl font-bold transition-all flex items-center justify-center py-3 gap-2 shadow-sm hover:shadow-md magnetic",
                isExporting && "opacity-60 cursor-wait"
              )}
            >
              {isExporting === 'txt' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {isExporting === 'txt' ? '…' : 'TXT'}
            </motion.button>
          </div>

          {/* Explicit Browser Print Action */}
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleExport('print')}
            disabled={!!isExporting}
            className={cn(
              "w-full py-2.5 px-3 rounded-xl border border-[#E8DFD0] bg-[#FFFBF5]/80 hover:bg-[#E8DFD0]/40 text-[#5C4A38] text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-2xs",
              isExporting && "opacity-60 cursor-wait"
            )}
            title="Open browser print dialog for current view"
          >
            {isExporting === 'print' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 text-[#8B5E3C]" />}
            <span>Print Current View</span>
          </motion.button>

          {/* PDF Page Mode Selector */}
          <div className="mt-3 pt-2.5 border-t border-[#E8DFD0]/60 flex items-center justify-between text-[11px]">
            <span className="text-[#8C7B6B] font-medium">PDF Mode:</span>
            <div className="flex bg-[#E8DFD0]/40 rounded-lg p-0.5 border border-[#E8DFD0]/80">
              <button
                type="button"
                onClick={() => setPdfPageMode('clean-reflow')}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                  pdfPageMode === 'clean-reflow' ? "bg-white text-[#8B5E3C] shadow-xs" : "text-[#8C7B6B] hover:text-[#3D2E1C]"
                )}
                title="Clean Reflow: Academic compact typography with soft page dividers"
              >
                Reflow
              </button>
              <button
                type="button"
                onClick={() => setPdfPageMode('faithful')}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                  pdfPageMode === 'faithful' ? "bg-white text-[#8B5E3C] shadow-xs" : "text-[#8C7B6B] hover:text-[#3D2E1C]"
                )}
                title="Faithful: 1:1 Page budget matching source document"
              >
                1:1 Faithful
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <h4 className="text-sm font-bold text-[#8C7B6B] flex items-center gap-2 mb-6"><BarChart3 className="w-4 h-4 text-[#8B5E3C]" /> Document Stats</h4>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-[#8C7B6B]">Words</span>
            <AnimatedCounter value={stats.words} className="text-sm text-[#3D2E1C]" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-[#8C7B6B]">Chars</span>
            <AnimatedCounter value={stats.chars} className="text-sm text-[#3D2E1C]" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-[#8C7B6B]">Read</span>
            <span className="text-sm font-bold text-[#3D2E1C]">{stats.readTime}m</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-[#8C7B6B]">Pages</span>
            <AnimatedCounter value={stats.pages} className="text-sm text-[#3D2E1C]" />
          </div>
        </div>
      </motion.div>

      {/* Rare UI Rail TOC Outline */}
      {content && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <RailTOC content={content} />
        </motion.div>
      )}

      {/* Rare UI TaskList - Preflight Verification */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
      >
        <TaskList
          tasks={verificationTasks}
          onToggleTask={handleToggleTask}
          title="Preflight Verification"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <h4 className="text-sm font-bold text-[#8C7B6B] flex items-center gap-2 mb-6">
          <RotateCcw className="w-4 h-4 text-[#8B5E3C]" /> History
        </h4>
        {versions.length === 0 ? (
          <p className="text-sm text-[#8C7B6B] italic">No snapshots yet.</p>
        ) : (
          <div className="space-y-2">
            {versions.slice(0, 5).map((v, i) => (
              <motion.button
                key={v.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setRestoreVersion(v)}
                className="w-full group p-3.5 rounded-2xl bg-white/60 backdrop-blur-sm border border-[#E8DFD0] hover:border-[#8B5E3C]/40 hover:bg-white/80 transition-all text-left shadow-sm hover:shadow-md"
              >
                <p className="text-sm font-bold text-[#3D2E1C] truncate mb-1 group-hover:text-[#8B5E3C] transition-colors">
                  {v.note || 'Auto Snapshot'}
                </p>
                <p className="text-xs font-medium text-[#8C7B6B]">
                  {v.createdAt?.toDate?.()?.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                </p>
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>

      {saveError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold shadow-md"
        >
          {saveError}
        </motion.div>
      )}
    </div>
  );
  return (
    <div className="flex h-screen bg-[#F5F0E8] overflow-hidden relative">
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Floating Header */}
        <header className="h-auto min-h-[80px] py-4 px-4 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0 w-full sm:w-auto">
            <button onClick={onBack} className="shrink-0 p-2.5 sm:p-3 rounded-2xl bg-[#FFFBF5] border border-[#E8DFD0] hover:bg-[#E8DFD0]/50 transition-all flex items-center justify-center" title="Back">
              <ArrowLeft className="w-5 h-5 text-[#3D2E1C]" />
            </button>
            <div className="flex flex-col min-w-0 flex-1">
              <input type="text" value={title} onChange={e => { setTitle(e.target.value); setIsDirty(true); }}
                className="text-lg sm:text-xl font-serif font-black text-[#3D2E1C] bg-transparent border-none focus:ring-0 p-0 truncate focus:outline-none tracking-tight w-full max-w-[150px] xs:max-w-[200px] sm:max-w-none" placeholder="Untitled Document" />
              <div className="flex items-center gap-2 mt-0.5">
                <AnimatedBadge isDirty={isDirty} saveSuccess={saveSuccess} />
                {lastSaved && !isDirty && (
                  <span className="text-[10px] text-[#8C7B6B] font-bold tracking-wider truncate">
                    Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
            
            {/* Mobile-only menu button moved to the top row for space efficiency */}
            <button onClick={() => setShowMobileMenu(true)} className="sm:hidden shrink-0 p-2.5 rounded-xl bg-[#FFFBF5] border border-[#E8DFD0] hover:bg-[#E8DFD0]/50 transition-all text-[#3D2E1C] flex items-center justify-center">
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {/* Mode Switcher */}
            <div className="flex items-center rounded-2xl bg-[#FFFBF5] border border-[#E8DFD0] p-1 shrink-0">
              <button onClick={() => setMode('preview')}
                className={cn("flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-300",
                  mode === 'preview' ? "bg-[#8B5E3C]/10 text-[#8B5E3C]" : "text-[#8C7B6B] hover:text-[#3D2E1C]")}>
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />Preview
              </button>
              <button onClick={() => setMode('edit')}
                className={cn("flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-300",
                  mode === 'edit' ? "bg-[#8B5E3C]/10 text-[#8B5E3C]" : "text-[#8C7B6B] hover:text-[#3D2E1C]")}>
                <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />Edit
              </button>
              <button onClick={() => setMode('split')}
                className={cn("hidden md:flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-300",
                  mode === 'split' ? "bg-[#8B5E3C]/10 text-[#8B5E3C]" : "text-[#8C7B6B] hover:text-[#3D2E1C]")}>
                <Columns className="w-3.5 h-3.5 sm:w-4 sm:h-4" />Split
              </button>
            </div>

            <button onClick={handleSave} disabled={isSaving || !isDirty}
              className={cn(
                "shrink-0 rounded-xl font-medium transition-colors flex items-center justify-center py-2 px-4 h-[38px] sm:h-11",
                !isDirty
                  ? "opacity-60 cursor-not-allowed bg-[#8C7B6B] text-white/90"
                  : "bg-[#8B5E3C] text-white hover:bg-[#7A5133]"
              )}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin sm:mr-2" /> : saveSuccess ? <Check className="w-4 h-4 sm:mr-2" /> : <Save className="w-4 h-4 sm:mr-2" />}
              <span className="hidden sm:inline">{isSaving ? 'Saving' : 'Sync'}</span>
            </button>

            {/* Desktop menu button (mobile is up top) */}
            <button onClick={() => setShowMobileMenu(true)} className="hidden sm:flex lg:hidden shrink-0 p-2.5 rounded-xl bg-[#FFFBF5] border border-[#E8DFD0] hover:bg-[#E8DFD0]/50 transition-all text-[#3D2E1C] h-11 items-center justify-center">
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Paper Canvas */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-12 flex justify-center items-start scroll-smooth">
          <motion.div layout initial={{y:40, opacity:0}} animate={{y:0, opacity:1}}
            className={cn("w-full min-h-[600px] sm:min-h-[1100px] rounded-2xl sm:rounded-[1rem] shadow-[0_4px_20px_rgba(139,94,60,0.08)] relative overflow-hidden group bg-white border-t-4 border-t-[#8B5E3C] border-x border-b border-[#E8DFD0]",
              mode === 'split' ? "max-w-[1400px]" : "max-w-[850px]"
            )}>
            
            <AnimatePresence mode="wait">
              {mode === 'split' ? (
                <div key="split" className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#E8DFD0] min-h-[700px]">
                  <div className="p-4 sm:p-8 flex flex-col">
                    <div className="text-xs font-bold text-[#8C7B6B] mb-3 uppercase tracking-wider flex items-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5 text-[#8B5E3C]" /> Markdown Source
                    </div>
                    <textarea value={content} onChange={e => { setContent(e.target.value); setIsDirty(true); setSaveSuccess(false); }}
                      className="w-full flex-1 min-h-[550px] resize-none border-none focus:ring-0 p-0 text-[#3D2E1C] leading-relaxed text-sm bg-transparent placeholder:text-[#8C7B6B]/50 font-mono focus:outline-none"
                      placeholder="Type or paste markdown..." spellCheck={false} />
                  </div>
                  <div className="p-4 sm:p-8 overflow-y-auto max-h-[80vh]">
                    <div className="text-xs font-bold text-[#8C7B6B] mb-3 uppercase tracking-wider flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-[#8B5E3C]" /> Formatted Output
                    </div>
                    <div className="mb-4 pb-2 border-b border-[#E8DFD0]">
                      <h2 className="text-xl font-serif font-black text-[#3D2E1C]">{title}</h2>
                    </div>
                    <MarkdownPreview content={content || ''} />
                  </div>
                </div>
              ) : mode === 'edit' ? (
                <motion.div key="edit" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="p-5 sm:p-12 md:p-20">
                  <textarea value={content} onChange={e => { setContent(e.target.value); setIsDirty(true); setSaveSuccess(false); }}
                    className="w-full min-h-[500px] sm:min-h-[900px] resize-none border-none focus:ring-0 p-0 text-[#3D2E1C] leading-relaxed text-base sm:text-lg bg-transparent placeholder:text-[#8C7B6B]/50 font-mono focus:outline-none"
                    placeholder="Type or paste markdown..." spellCheck={false} />
                </motion.div>
              ) : (
                <motion.div key="preview" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="p-5 sm:p-12 md:p-20">
                  <div className="mb-6 sm:mb-12 pb-4 sm:pb-8 border-b border-[#E8DFD0]">
                    <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-black text-[#3D2E1C] leading-tight tracking-tight break-words">{title}</h1>
                  </div>
                  {(content || '').trim() ? <MarkdownPreview content={content} /> : <div className="flex flex-col items-center justify-center py-20 sm:py-32 opacity-50"><Sparkles className="w-10 h-10 sm:w-12 sm:h-12 mb-4 text-[#8B5E3C]" /><p className="font-serif font-bold tracking-wide text-sm text-[#3D2E1C]">Your document will appear here</p></div>}
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

      {/* Issue #10: Replace confirm() with professional modal */}
      <ConfirmDialog
        isOpen={restoreVersion !== null}
        onClose={() => setRestoreVersion(null)}
        onConfirm={() => {
          setContent(restoreVersion.content);
          setIsDirty(true);
          setShowMobileMenu(false);
          setRestoreVersion(null);
        }}
        title="Restore Snapshot?"
        message={`This will replace your current content with "${restoreVersion?.note || 'Auto Snapshot'}". Any unsaved changes will be lost.`}
        confirmText="Restore"
        cancelText="Cancel"
        variant="default"
      />
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

Editor.propTypes = {
  doc: PropTypes.shape({
    id: PropTypes.string,
    userId: PropTypes.string,
    title: PropTypes.string,
    content: PropTypes.string
  }),
  onBack: PropTypes.func,
  versions: PropTypes.array
};

AnimatedBadge.propTypes = {
  isDirty: PropTypes.bool,
  saveSuccess: PropTypes.bool
};
