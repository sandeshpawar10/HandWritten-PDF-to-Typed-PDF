import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  FileText, Plus, LogOut, Search, Files, Sparkles, User, ArrowRight,
  AlertTriangle, X, Menu, Table2, Zap, Shield, Settings as SettingsIcon,
  LayoutDashboard, Layers
} from 'lucide-react';
import { auth, signInWithGoogle, logOut } from './lib/firebase';
import { Document, DocumentVersion, ConversionJob } from './types';
import { subscribeToDocuments, createDocument, subscribeToVersions } from './services/documents';
import { convertHandwritingToText } from './services/gemini';
import { FileUpload } from './components/FileUpload';
import { DocumentList } from './components/DocumentList';
import { Editor } from './components/Editor';
import { Settings } from './components/Settings';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, loading] = useAuthState(auth);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'list' | 'upload' | 'edit' | 'settings'>('list');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
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
    if (user) {
      const unsubscribe = subscribeToDocuments(user.uid, setDocuments);
      return unsubscribe;
    }
  }, [user]);

  useEffect(() => {
    if (selectedDoc && user) {
      const unsubscribe = subscribeToVersions(selectedDoc.id, user.uid, setVersions);
      return unsubscribe;
    }
  }, [selectedDoc, user]);

  const handleFilesAdded = async (files: File[]) => {
    setGlobalError(null);
    const newJobs: ConversionJob[] = files.map(file => ({
      file, id: Math.random().toString(36).substr(2, 9), status: 'pending'
    }));
    setJobs(prev => [...prev, ...newJobs]);
    setView('upload');
    setMobileSidebar(false);

    for (let idx = 0; idx < newJobs.length; idx++) {
      const job = newJobs[idx];
      if (idx > 0) await new Promise(r => setTimeout(r, 2000));

      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'converting' } : j));
      try {
        const text = await convertHandwritingToText(job.file, (status) => {
          setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'converting', error: status } : j));
        });
        if (!text || text.trim().length === 0) throw new Error('No text extracted.');
        const title = job.file.name.replace(/\.[^/.]+$/, "");
        await createDocument(user!.uid, title, text, job.file.name);
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'completed', content: text, error: undefined } : j));
      } catch (err: any) {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed', error: err?.message || 'Failed' } : j));
      }
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg relative">
        <div className="nebula-bg" />
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-3xl bg-accent opacity-20 animate-pulse" />
            <div className="absolute inset-0 rounded-3xl border-2 border-accent/30 animate-[spin_3s_linear_infinite]" />
            <div className="absolute inset-3 rounded-2xl glass flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-accent animate-pulse" />
            </div>
          </div>
          <p className="text-accent/60 font-display font-bold text-xs tracking-widest uppercase">Prism Engine Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex flex-col relative overflow-hidden">
        <div className="nebula-bg" />
        
        <header className="relative z-10 px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center glow-accent">
              <Layers className="w-5 h-5 text-accent" />
            </div>
            <span className="font-display font-black text-lg tracking-tighter text-white uppercase">TypedDoc</span>
          </div>
          <button onClick={handleSignIn} className="btn-glass flex items-center gap-2">
            Sign in <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </header>

        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
          <motion.div initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} transition={{duration:1, ease:[0.16,1,0.3,1]}} className="max-w-5xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-accent/20 text-accent text-[10px] font-bold tracking-widest mb-10 uppercase">
              <Zap className="w-3 h-3 fill-accent" />
              Powered by Mistral OCR Engine
            </div>

            <h1 className="text-6xl sm:text-7xl md:text-9xl font-display font-black leading-[0.85] tracking-tighter-title mb-10">
              <span className="text-white">TRANSFORM </span>
              <span className="prism-text">HANDWRITING </span>
              <br className="hidden md:block" />
              <span className="text-white/40 font-light">TO PIXELS.</span>
            </h1>

            <p className="text-lg sm:text-xl text-text-mid max-w-2xl mx-auto mb-14 leading-relaxed font-medium">
              Upload notes, formulas, or tables. Our AI renders them into stunning, searchable documents instantly.
            </p>

            <button onClick={handleSignIn} className="btn-primary group">
              <User className="w-4 h-4 mr-2" />
              Get Started with Google
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="flex flex-wrap items-center justify-center gap-4 mt-20">
              {['Math Equations', 'Complex Tables', 'Batch Processing', 'Cloud Sync'].map((f) => (
                <span key={f} className="px-4 py-2 rounded-2xl text-[10px] font-bold text-text-dim border border-white/5 glass hover:border-accent/30 transition-all cursor-default">
                  {f}
                </span>
              ))}
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  // Authenticated Layout
  const NavButton = ({ id, icon: Icon, label, badge }: any) => (
    <button
      onClick={() => { setView(id); if (id === 'list') setSelectedDoc(null); setMobileSidebar(false); }}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[13px] font-bold transition-all group relative overflow-hidden",
        (view === id && selectedDoc === null)
          ? "glass-bright text-accent border-accent/20 shadow-[0_0_20px_rgba(255,62,141,0.1)]"
          : "text-text-dim hover:text-white hover:bg-white/5"
      )}
    >
      {view === id && selectedDoc === null && <div className="absolute left-0 w-1 h-6 bg-accent rounded-full" />}
      <Icon className={cn("w-5 h-5 shrink-0", view === id && selectedDoc === null ? "text-accent" : "opacity-50")} />
      <span>{label}</span>
      {badge !== null && (
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-lg bg-accent/20 text-accent">{badge}</span>
      )}
    </button>
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="h-24 px-8 flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <Layers className="w-4.5 h-4.5 text-accent" />
        </div>
        <span className="font-display font-black text-sm text-white tracking-tight uppercase">TypedDoc</span>
        <button onClick={() => setMobileSidebar(false)} className="ml-auto p-2 rounded-xl glass md:hidden">
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        <p className="px-4 text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] mb-4">Workspace</p>
        <NavButton id="list" icon={LayoutDashboard} label="Library" badge={documents.length || null} />
        <NavButton id="upload" icon={Plus} label="Convert" />
        <NavButton id="settings" icon={SettingsIcon} label="Settings" />
      </nav>

      <div className="p-4 mt-auto">
        <div className="glass rounded-3xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <img src={user.photoURL || ''} className="w-10 h-10 rounded-2xl border border-white/10" alt="me" />
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-white truncate">{user.displayName}</p>
              <p className="text-[10px] text-text-dim truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={logOut} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold text-text-dim hover:text-white hover:bg-white/5 border border-white/5 transition-all">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg flex relative text-text-main font-sans selection:bg-accent/30">
      <div className="nebula-bg" />

      {/* Desktop Sidebar */}
      <aside className="w-72 bg-bg/50 border-r border-white/5 flex-col shrink-0 hidden md:flex backdrop-blur-3xl">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileSidebar && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 md:hidden" onClick={() => setMobileSidebar(false)} />
            <motion.aside initial={{x:-300}} animate={{x:0}} exit={{x:-300}} transition={{type:'spring', damping:30, stiffness:300}} className="fixed left-0 top-0 bottom-0 w-72 bg-bg border-r border-white/10 z-50 md:hidden">
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <AnimatePresence mode="wait">
          {view === 'edit' && selectedDoc ? (
            <motion.div key="editor" initial={{opacity:0, scale:0.98}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:1.02}} className="h-screen">
              <Editor document={selectedDoc} onBack={() => setView('list')} versions={versions} />
            </motion.div>
          ) : (
            <motion.div key="main" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex-1 overflow-y-auto">
              <div className="max-w-6xl mx-auto py-10 px-6 sm:px-10">
                <div className="flex items-center justify-between mb-12">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setMobileSidebar(true)} className="p-3 rounded-2xl glass md:hidden">
                      <Menu className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-3xl font-display font-black text-white tracking-tight uppercase">
                        {view === 'list' ? 'Archive' : view === 'settings' ? 'Preferences' : 'Converter'}
                      </h2>
                      <p className="text-xs text-text-dim font-bold tracking-wide mt-1">
                        {view === 'list' ? `MANAGING ${documents.length} ASSETS` : 'SYSTEM CONFIGURATION'}
                      </p>
                    </div>
                  </div>
                  
                  {view === 'list' && (
                    <div className="relative hidden lg:block group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim group-focus-within:text-accent transition-colors" />
                      <input type="text" placeholder="Filter documents..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="pl-11 pr-6 py-3.5 rounded-2xl glass border-white/5 text-[13px] text-white placeholder:text-text-dim focus:border-accent/40 focus:ring-0 w-80 transition-all outline-none" />
                    </div>
                  )}
                </div>

                {globalError && (
                  <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} className="mb-8 flex items-center gap-4 px-5 py-4 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] font-bold">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>{globalError}</span>
                    <button onClick={() => setGlobalError(null)} className="ml-auto glass p-1.5 rounded-xl"><X className="w-4 h-4" /></button>
                  </motion.div>
                )}

                <AnimatePresence mode="wait">
                  {view === 'list' ? (
                    <motion.div key="list" initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}}>
                      <DocumentList documents={filteredDocuments} onSelect={doc => { setSelectedDoc(doc); setView('edit'); }} />
                    </motion.div>
                  ) : view === 'settings' ? (
                    <motion.div key="settings" initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}}>
                      <Settings />
                    </motion.div>
                  ) : (
                    <motion.div key="upload" initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}}>
                      <FileUpload onFilesAdded={handleFilesAdded} jobs={jobs} onRemoveJob={id => setJobs(p => p.filter(j => j.id !== id))} />
                      {jobs.some(j => j.status === 'completed') && (
                        <div className="mt-12 flex justify-center">
                          <button onClick={() => setView('list')} className="btn-primary group">
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
    </div>
  );
}
