import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  Plus, LogOut, Search, Files, Sparkles, User, ArrowRight,
  AlertTriangle, X, Menu, Table2, Zap, Shield,
  LayoutDashboard, BookOpen, HelpCircle
} from 'lucide-react';
import { auth, signInWithGoogle, logOut } from './lib/firebase';
import { subscribeToDocuments, createDocument, subscribeToVersions } from './services/documents';
import { convertWithFallback } from './services/chunkedOcr';
import { FileUpload } from './components/FileUpload';
import { DocumentList } from './components/DocumentList';
import { Editor } from './components/Editor';
import { OfflineBanner } from './components/OfflineBanner';
import { ToastContainer, toast } from './components/Toast';
import { NotificationBell, FAQDrawer, AnimatedCounter } from './components/rare';
import { setNotificationUserId } from './lib/notifications';

// Lazy-load FormattedDocumentViewer to keep initial bundle size lean
const FormattedDocumentViewer = lazy(() => import('./components/FormattedDocumentViewer'));

import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { TypedDocOpeningAnimation, OPENING_SEEN_KEY } from './components/brand/TypedDocOpeningAnimation';
import { TypedDocMark } from './components/brand/TypedDocMark';
import { TypedDocLogo } from './components/brand/TypedDocLogo';

// Issue #18: Extract magic numbers to named constants
const SEARCH_DEBOUNCE_MS = 300;
const JOB_DELAY_MS = 2000; // Delay between processing multiple files
const SEARCH_MIN_LENGTH = 3; // Minimum search query length for content search

export default function App() {
  const [user, loading, authErrorFromHook] = useAuthState(auth);
  const [showOpening, setShowOpening] = useState(() => {
    try {
      return !sessionStorage.getItem(OPENING_SEEN_KEY);
    } catch {
      return false;
    }
  });
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [versions, setVersions] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [view, setView] = useState('list');
  const [globalError, setGlobalError] = useState(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [formattedDocument, setFormattedDocument] = useState(null);
  const [processingProgress, setProcessingProgress] = useState(null);
  const [showFaq, setShowFaq] = useState(false);

  const displayedAuthError = authError || authErrorFromHook?.message;

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/unauthorized-domain') {
        setAuthError(`Domain not authorized. Please add ${window.location.hostname} to Firebase console.`);
      } else if (code === 'auth/popup-closed-by-user') {
        // ignore
      } else {
        setAuthError(err?.message || 'Sign-in failed.');
      }
    }
  };

  useEffect(() => {
    setNotificationUserId(user?.uid || null);
    if (user) {
      setDocsLoading(true);
      const unsubscribe = subscribeToDocuments(
        user.uid,
        (docs) => {
          setDocuments(docs);
          setDocsLoading(false);
        },
        (err) => {
          console.error('Failed to load documents:', err);
          setDocsLoading(false);
        }
      );
      return unsubscribe;
    } else {
      setDocuments([]);
      setDocsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (selectedDoc && user) {
      const unsubscribe = subscribeToVersions(selectedDoc.id, user.uid, setVersions);
      return unsubscribe;
    }
  }, [selectedDoc, user]);

  const abortControllersRef = useRef({});

  const processJob = async (job) => {
    const controller = new AbortController();
    abortControllersRef.current[job.id] = controller;

    setJobs(prev => prev.map(j => j.id === job.id ? {
      ...j,
      status: 'converting',
      error: undefined,
      progressMessage: 'Starting conversion...'
    } : j));

    try {
      const result = await convertWithFallback(job.file, (progress) => {
        if (controller.signal.aborted) return;
        setProcessingProgress({
          jobId: job.id,
          ...progress
        });
        setJobs(prev => prev.map(j => j.id === job.id ? {
          ...j,
          status: 'converting',
          progressMessage: progress.message
        } : j));
      }, controller.signal);

      if (controller.signal.aborted) return;

      setProcessingProgress(prev => prev?.jobId === job.id ? { ...prev, percent: 100, message: 'Complete!' } : null);
      setTimeout(() => setProcessingProgress(prev => prev?.jobId === job.id ? null : prev), 1500);

      if (!result.text || result.text.trim().length === 0) throw new Error('No text extracted.');

      const title = job.file.name.replace(/\.[^/.]+$/, "");
      await createDocument(user.uid, title, result.text, job.file.name);

      setJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        status: 'completed',
        content: result.text,
        formattedPdf: result.formattedPdf,
        formattedDocx: result.formattedDocx,
        totalPages: result.totalPages,
        pagesProcessed: result.pagesProcessed,
        clientSide: result.clientSide,
        pdfSource: result.pdfSource || (result.formattedPdf ? 'server-pdf' : 'unavailable'),
        error: undefined,
        progressMessage: undefined
      } : j));

      if (result.formattedPdf || result.formattedDocx) {
        setFormattedDocument({
          pdf: result.formattedPdf,
          docx: result.formattedDocx,
          filename: job.file.name,
          content: result.text
        });
      }

      if (result.clientSide) {
        toast.info('OCR completed in browser mode. Server-formatted PDF is unavailable. Please retry with a stable connection.');
      } else {
        toast.success(`✨ Document formatted successfully! (${result.pagesProcessed || 1} pages processed)`);
      }

    } catch (err) {
      if (controller.signal.aborted || err?.name === 'AbortError') {
        console.log(`Job ${job.id} was aborted by user.`);
        return;
      }
      console.error(`Job ${job.id} failed:`, err);
      setProcessingProgress(prev => prev?.jobId === job.id ? null : prev);
      const errorMessage = err?.message || 'Processing failed. Please try again.';
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed', error: errorMessage } : j));
      toast.error(errorMessage);
    } finally {
      delete abortControllersRef.current[job.id];
    }
  };

  const handleFilesAdded = async (files) => {
    setGlobalError(null);
    const newJobs = files.map(file => ({
      file,
      id: Math.random().toString(36).substring(2, 11),
      status: 'pending'
    }));
    setJobs(prev => [...prev, ...newJobs]);
    setView('upload');
    setMobileSidebar(false);

    for (let idx = 0; idx < newJobs.length; idx++) {
      const job = newJobs[idx];
      if (idx > 0) await new Promise(r => setTimeout(r, JOB_DELAY_MS));
      await processJob(job);
    }
  };

  const handleRemoveJob = (jobId) => {
    if (abortControllersRef.current[jobId]) {
      try {
        abortControllersRef.current[jobId].abort();
      } catch {
        // ignore
      }
      delete abortControllersRef.current[jobId];
    }
    setJobs(prev => prev.filter(j => j.id !== jobId));
    setProcessingProgress(prev => prev?.jobId === jobId ? null : prev);
    toast.info('Item removed');
  };

  const handleRetryJob = async (jobId) => {
    const jobToRetry = jobs.find(j => j.id === jobId);
    if (!jobToRetry) return;

    if (abortControllersRef.current[jobId]) {
      try {
        abortControllersRef.current[jobId].abort();
      } catch {
        // ignore
      }
      delete abortControllersRef.current[jobId];
    }

    await processJob(jobToRetry);
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Memoized filtered documents to prevent unnecessary re-renders
  const filteredDocuments = useMemo(() => {
    if (!debouncedSearch) return documents;

    const query = debouncedSearch.toLowerCase();
    return documents.filter(doc => {
      // Always search titles
      if (doc.title.toLowerCase().includes(query)) return true;

      // Only search content for longer queries (expensive operation)
      if (query.length > SEARCH_MIN_LENGTH) {
        return doc.content.toLowerCase().includes(query);
      }

      return false;
    });
  }, [documents, debouncedSearch]);

  if (showOpening) {
    return <TypedDocOpeningAnimation onComplete={() => setShowOpening(false)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8] relative overflow-hidden select-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F5F0E8] to-[#E8DFD0] pointer-events-none" />
        <div className="flex flex-col items-center gap-5 relative z-10 p-6 max-w-sm w-full text-center">
          {/* Brand Logo with gentle breathing motion */}
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="relative flex items-center justify-center mb-1"
          >
            <div className="w-20 h-20 rounded-3xl bg-white/80 backdrop-blur-sm border border-[#E8DFD0] shadow-xl flex items-center justify-center p-3.5">
              <img
                src="/brand/brand-mark.png"
                alt="TypedDoc Logo"
                className="w-12 h-12 object-contain drop-shadow-sm"
              />
            </div>
            <div className="absolute -inset-3 bg-[#C8873B]/15 rounded-3xl blur-xl -z-10 animate-pulse" />
          </motion.div>

          <div className="space-y-1">
            <span className="font-serif font-black text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#3D2E1C] via-[#5C3D24] to-[#8B5E3C]">
              TypedDoc
            </span>
            <p className="text-[#8C7B6B] text-xs font-medium tracking-wide">
              Loading workspace...
            </p>
          </div>

          {/* Downside Slider */}
          <div className="w-56 h-1.5 bg-[#E8DFD0] rounded-full overflow-hidden relative shadow-inner mt-2">
            <motion.div
              className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-[#C8873B] via-[#E2A654] to-[#C8873B]"
              initial={{ left: '-40%', width: '40%' }}
              animate={{ left: '100%', width: '40%' }}
              transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex flex-col relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="nebula-bg" />

        {/* Floating orbs for depth */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-20 left-10 w-72 h-72 bg-[#8B5E3C]/5 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ y: [0, 40, 0], x: [0, -30, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-20 right-10 w-96 h-96 bg-[#C4853C]/5 rounded-full blur-3xl"
          />
        </div>

        <header className="relative z-10 px-8 h-24 flex items-center justify-between backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-11 h-11 rounded-2xl bg-white/80 backdrop-blur-sm border border-[#E8DFD0] flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 magnetic p-2">
              <img src="/brand/brand-mark.png" alt="TypedDoc Logo" className="w-6 h-6 object-contain" />
            </div>
            <span className="font-serif font-black text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#3D2E1C] to-[#8B5E3C]">
              TypedDoc
            </span>
          </motion.div>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={handleSignIn}
            className="px-5 py-2.5 rounded-xl bg-white/80 backdrop-blur-sm border border-[#E8DFD0] text-[#3D2E1C] font-bold text-sm hover:bg-white hover:shadow-lg transition-all flex items-center gap-2 magnetic hover:scale-105"
          >
            Sign in <ArrowRight className="w-3.5 h-3.5" />
          </motion.button>
        </header>

        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-5xl"
          >
            {/* Hero heading with staggered animation */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="text-5xl sm:text-6xl md:text-8xl font-serif font-black leading-[1.1] tracking-tight mb-8 text-[#3D2E1C]"
            >
              Transform Your{' '}
              <span className="relative inline-block">
                <span className="prism-text">Handwritten</span>
                <motion.div
                  animate={{ scale: [1, 1.02, 1], opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute -inset-2 bg-gradient-to-r from-[#8B5E3C]/20 to-[#C4853C]/20 blur-2xl -z-10 rounded-3xl"
                />
              </span>
              <br className="hidden md:block" /> Notes
            </motion.h1>

            {/* Brand Logo Showcase */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="my-10 max-w-xs mx-auto p-6 rounded-3xl bg-white/80 backdrop-blur-md border border-[#E8DFD0] shadow-xl hover:shadow-2xl transition-all flex flex-col items-center gap-3 select-none"
            >
              <img
                src="/brand/brand-mark.png"
                alt="TypedDoc Logo"
                className="w-24 h-auto sm:w-28 object-contain drop-shadow-md hover:scale-105 transition-transform"
                width={112}
                height={140}
              />
              <span className="font-serif font-black text-xl bg-clip-text text-transparent bg-gradient-to-r from-[#3D2E1C] to-[#8B5E3C]">
                TypedDoc
              </span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-lg sm:text-xl text-[#6B5D4F] max-w-2xl mx-auto mb-14 leading-relaxed font-medium"
            >
              Upload your handwritten PDFs and get beautifully typed documents in seconds with AI-powered OCR.
            </motion.p>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSignIn}
              className="btn-primary px-8 py-4 rounded-2xl text-lg group relative overflow-hidden shimmer"
            >
              <span className="relative z-10 flex items-center">
                <User className="w-5 h-5 mr-3" />
                Get Started with Google
                <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
              </span>
            </motion.button>

            {/* Brand Transformation Showcase */}


            {/* Feature badges with staggered animation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="flex flex-wrap items-center justify-center gap-3 mt-20"
            >
              {[
                { icon: Sparkles, label: 'Math Equations' },
                { icon: Table2, label: 'Complex Tables' },
                { icon: Zap, label: 'Batch Processing' },
                { icon: Shield, label: 'Cloud Sync' }
              ].map((f, i) => (
                <motion.span
                  key={f.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + i * 0.1 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  className="px-4 py-2.5 rounded-2xl text-[12px] font-bold text-[#8B5E3C] bg-white/80 backdrop-blur-sm border border-[#E8DFD0]/50 shadow-md hover:shadow-lg hover:border-[#8B5E3C]/30 transition-all cursor-default flex items-center gap-2"
                >
                  <f.icon className="w-3.5 h-3.5" />
                  {f.label}
                </motion.span>
              ))}
            </motion.div>
          </motion.div>
        </main>

        {displayedAuthError && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-700 text-sm font-medium shadow-lg max-w-md flex items-center gap-3 z-50"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{displayedAuthError}</span>
          </motion.div>
        )}
      </div>
    );
  }

  // Authenticated Layout
  const NavButton = ({ id, icon: Icon, label, badge }) => (
    <button
      onClick={() => { setView(id); if (id === 'list') setSelectedDoc(null); setMobileSidebar(false); }}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[14px] font-medium transition-all group relative overflow-hidden",
        (view === id && selectedDoc === null)
          ? "bg-white text-[#8B5E3C] border border-[#E8DFD0] shadow-sm"
          : "text-[#8C7B6B] hover:text-[#3D2E1C] hover:bg-[#F5F0E8]"
      )}
    >
      {view === id && selectedDoc === null && <div className="absolute left-0 w-1 h-6 bg-[#8B5E3C] rounded-r-full" />}
      <Icon className={cn("w-5 h-5 shrink-0", view === id && selectedDoc === null ? "text-[#8B5E3C]" : "opacity-60")} />
      <span>{label}</span>
      {badge !== null && badge !== undefined && badge !== 0 && (
        <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[#8B5E3C]/10 text-[#8B5E3C]">{badge}</span>
      )}
    </button>
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-24 px-8 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#8B5E3C]/10 to-[#C4853C]/10 border border-[#8B5E3C]/20 flex items-center justify-center shadow-sm hover:shadow-md transition-all hover:scale-105 magnetic p-1.5">
          <img src="/brand/brand-mark.png" alt="TypedDoc Logo" className="w-6 h-6 object-contain" />
        </div>
        <span className="font-serif font-black text-xl bg-clip-text text-transparent bg-gradient-to-r from-[#3D2E1C] to-[#8B5E3C]">
          TypedDoc
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <NotificationBell
            userId={user?.uid}
            onSelectDoc={id => {
              const d = documents.find(doc => doc.id === id);
              if (d) { setSelectedDoc(d); setView('edit'); }
            }}
          />
          <button onClick={() => setMobileSidebar(false)} className="p-2 rounded-xl bg-white/80 border border-[#E8DFD0] shadow-sm md:hidden text-[#3D2E1C] hover:bg-white hover:scale-105 transition-all magnetic">
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        <p className="px-4 text-[11px] font-bold text-[#8C7B6B] tracking-wide mb-4">Menu</p>
        <NavButton id="list" icon={LayoutDashboard} label="Documents" badge={documents.length || null} />
        <NavButton id="upload" icon={Plus} label="Upload" />
        <button
          type="button"
          onClick={() => setShowFaq(true)}
          className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[14px] font-medium text-[#8C7B6B] hover:text-[#3D2E1C] hover:bg-[#F5F0E8] transition-all group"
        >
          <HelpCircle className="w-5 h-5 shrink-0 opacity-60 group-hover:opacity-100 text-[#8B5E3C]" />
          <span>Help & FAQ</span>
        </button>
      </nav>

      <div className="p-4 mt-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-sm border border-[#E8DFD0] shadow-lg rounded-2xl p-4 mb-4 hover:shadow-xl transition-all"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="relative group shrink-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  className="w-11 h-11 rounded-2xl border-2 border-[#E8DFD0] group-hover:border-[#8B5E3C]/30 transition-all object-cover"
                  alt={user.displayName || 'User'}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="w-11 h-11 rounded-2xl border-2 border-[#E8DFD0] bg-[#8B5E3C]/10 flex items-center justify-center font-bold text-sm text-[#8B5E3C]">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : <User className="w-5 h-5 text-[#8B5E3C]" />}
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#8B5E3C]/0 to-[#8B5E3C]/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-[#3D2E1C] truncate">{user.displayName || 'User'}</p>
              <p className="text-[12px] text-[#8C7B6B] truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={logOut} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-[#8C7B6B] hover:text-[#3D2E1C] hover:bg-[#F5F0E8]/50 border border-transparent hover:border-[#E8DFD0] transition-all magnetic" aria-label="Sign out of your account">
            <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
          </button>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex relative text-[#3D2E1C] font-sans selection:bg-[#8B5E3C]/20">
      <div className="nebula-bg" />

      {/* Toast notifications */}
      <ToastContainer />

      {/* Issue #30: Offline banner */}
      <OfflineBanner />

      {/* Desktop Sidebar */}
      <aside className="w-72 border-r border-[#E8DFD0]/50 backdrop-blur-xl bg-white/40 flex-col shrink-0 hidden md:flex z-20 relative" role="navigation" aria-label="Main navigation">
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-white/40 pointer-events-none" />
        <div className="relative z-10">
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileSidebar && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-[#3D2E1C]/40 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileSidebar(false)} />
            <motion.aside initial={{x:-300}} animate={{x:0}} exit={{x:-300}} transition={{type:'spring', damping:30, stiffness:300}} className="fixed left-0 top-0 bottom-0 w-72 bg-[#FFFBF5] border-r border-[#E8DFD0] z-50 md:hidden shadow-xl">
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <AnimatePresence mode="wait">
          {view === 'edit' && selectedDoc ? (
            <motion.div key="editor" initial={{opacity:0, scale:0.98}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:1.02}} className="h-screen">
              <Editor doc={selectedDoc} onBack={() => setView('list')} versions={versions} />
            </motion.div>
          ) : (
            <motion.div key="main" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex-1 overflow-y-auto">
              <div className="max-w-6xl mx-auto py-6 sm:py-10 px-4 sm:px-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 sm:mb-12">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setMobileSidebar(true)} className="p-3 rounded-2xl bg-white border border-[#E8DFD0] shadow-sm md:hidden text-[#3D2E1C]">
                      <Menu className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-3xl font-serif font-black text-[#3D2E1C] tracking-tight">
                        {view === 'list' ? 'Your Documents' : 'Upload & Convert'}
                      </h2>
                      <p className="text-[13px] text-[#8C7B6B] font-medium mt-1">
                        {view === 'list' ? (
                          <span className="flex items-center gap-1">
                            <AnimatedCounter value={documents.length} /> documents
                          </span>
                        ) : ''}
                      </p>
                    </div>
                  </div>
                  
                  {view === 'list' && (
                    <div className="relative w-full sm:w-72 lg:w-80 group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#8C7B6B] group-focus-within:text-[#8B5E3C] transition-colors" />
                      <input type="text" placeholder="Search documents..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="pl-12 pr-6 py-3.5 rounded-2xl bg-white border border-[#E8DFD0] shadow-sm text-[14px] text-[#3D2E1C] placeholder:text-[#8C7B6B] focus:border-[#8B5E3C]/40 focus:ring-0 w-full transition-all outline-none" />
                    </div>
                  )}
                </div>

                {globalError && (
                  <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} className="mb-8 flex items-center gap-4 px-5 py-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-[14px] font-medium shadow-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>{globalError}</span>
                    <button onClick={() => setGlobalError(null)} className="ml-auto bg-white border border-red-100 p-1.5 rounded-xl hover:bg-red-50"><X className="w-4 h-4" /></button>
                  </motion.div>
                )}

                <AnimatePresence mode="wait">
                  {view === 'list' ? (
                    <motion.div key="list" initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}}>
                      <DocumentList
                        documents={filteredDocuments}
                        loading={docsLoading}
                        onSelect={doc => { setSelectedDoc(doc); setView('edit'); }}
                        onUploadClick={() => setView('upload')}
                      />
                    </motion.div>
                  ) : (
                    <motion.div key="upload" initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}}>
                      <FileUpload
                        onFilesAdded={handleFilesAdded}
                        jobs={jobs}
                        onRemoveJob={handleRemoveJob}
                        onRetryJob={handleRetryJob}
                        processingProgress={processingProgress}
                      />
                      {jobs.some(j => j.status === 'completed') && (
                        <div className="mt-12 flex justify-center">
                          <button onClick={() => setView('list')} className="px-6 py-3 rounded-2xl bg-[#8B5E3C] text-white font-medium hover:bg-[#6B462C] shadow-md transition-all group inline-flex items-center">
                            <Files className="w-4 h-4 mr-2" /> View Library <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Formatted Document Viewer Modal */}
      {formattedDocument && (
        <Suspense fallback={null}>
          <FormattedDocumentViewer
            formattedPdf={formattedDocument.pdf}
            formattedDocx={formattedDocument.docx}
            content={formattedDocument.content}
            filename={formattedDocument.filename}
            onClose={() => setFormattedDocument(null)}
          />
        </Suspense>
      )}

      {/* Rare UI FAQ & Help Drawer */}
      <FAQDrawer
        isOpen={showFaq}
        onClose={() => setShowFaq(false)}
      />
    </div>
  );
}
