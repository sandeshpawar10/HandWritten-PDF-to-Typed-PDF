import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  FileText, Plus, LogOut, Search, Files, Sparkles, User, ArrowRight,
  AlertTriangle, X, Menu, Table2, Zap, Shield, Settings as SettingsIcon,
  LayoutDashboard, Layers, BookOpen
} from 'lucide-react';
import { auth, signInWithGoogle, logOut } from './lib/firebase';
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
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [versions, setVersions] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [view, setView] = useState('list');
  const [globalError, setGlobalError] = useState(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [authError, setAuthError] = useState(null);

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

  const handleFilesAdded = async (files) => {
    setGlobalError(null);
    const newJobs = files.map(file => ({
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
        await createDocument(user.uid, title, text, job.file.name);
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'completed', content: text, error: undefined } : j));
      } catch (err) {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed', error: err?.message || 'Failed' } : j));
      }
    }
  };

  // Debounce search input — waits 300ms after last keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    (debouncedSearch.length > 2 && doc.content.toLowerCase().includes(debouncedSearch.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8] relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F5F0E8] to-[#E8DFD0] pointer-events-none" />
        <div className="flex flex-col items-center gap-6 relative z-10">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-[#8B5E3C] opacity-10 animate-pulse" />
            <BookOpen className="w-8 h-8 text-[#8B5E3C] animate-[spin_3s_linear_infinite]" />
          </div>
          <p className="text-[#8B5E3C] font-serif font-bold text-lg">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F5F0E8] to-[#E8DFD0] pointer-events-none" />
        
        <header className="relative z-10 px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFFBF5] border border-[#E8DFD0] flex items-center justify-center shadow-sm">
              <BookOpen className="w-5 h-5 text-[#8B5E3C]" />
            </div>
            <span className="font-serif font-black text-xl text-[#3D2E1C]">TypedDoc</span>
          </div>
          <button onClick={handleSignIn} className="px-4 py-2 rounded-xl bg-white border border-[#E8DFD0] text-[#3D2E1C] font-bold text-sm hover:bg-[#F5F0E8] transition-colors shadow-sm flex items-center gap-2">
            Sign in <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </header>

        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
          <motion.div initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} transition={{duration:1, ease:[0.16,1,0.3,1]}} className="max-w-5xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#E8DFD0] text-[#8B5E3C] text-[10px] font-bold tracking-wide mb-10 shadow-sm">
              <Zap className="w-3 h-3 fill-[#8B5E3C]" />
              Powered by Mistral OCR Engine
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-8xl font-serif font-black leading-[1.1] tracking-tight mb-8 text-[#3D2E1C]">
              Transform Your <span className="text-[#8B5E3C]">Handwritten</span><br className="hidden md:block" /> Notes
            </h1>

            <p className="text-lg sm:text-xl text-[#6B5D4F] max-w-2xl mx-auto mb-14 leading-relaxed font-medium">
              Upload your handwritten PDFs and get beautifully typed documents in seconds.
            </p>

            <button onClick={handleSignIn} className="px-8 py-4 rounded-2xl bg-[#8B5E3C] text-white font-bold text-lg hover:bg-[#6B462C] transition-all shadow-md group inline-flex items-center">
              <User className="w-5 h-5 mr-3" />
              Get Started with Google
              <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="flex flex-wrap items-center justify-center gap-4 mt-20">
              {['Math Equations', 'Complex Tables', 'Batch Processing', 'Cloud Sync'].map((f) => (
                <span key={f} className="px-4 py-2 rounded-2xl text-[12px] font-medium text-[#8B5E3C] bg-white border border-[#E8DFD0] shadow-sm hover:border-[#8B5E3C]/30 transition-all cursor-default">
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
    <div className="flex flex-col h-full bg-[#FFFBF5]">
      <div className="h-24 px-8 flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl bg-[#8B5E3C]/10 border border-[#8B5E3C]/20 flex items-center justify-center">
          <BookOpen className="w-4.5 h-4.5 text-[#8B5E3C]" />
        </div>
        <span className="font-serif font-black text-lg text-[#3D2E1C] tracking-tight">TypedDoc</span>
        <button onClick={() => setMobileSidebar(false)} className="ml-auto p-2 rounded-xl bg-white border border-[#E8DFD0] shadow-sm md:hidden text-[#3D2E1C]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        <p className="px-4 text-[11px] font-bold text-[#8C7B6B] tracking-wide mb-4">Menu</p>
        <NavButton id="list" icon={LayoutDashboard} label="Documents" badge={documents.length || null} />
        <NavButton id="upload" icon={Plus} label="Upload" />
        <NavButton id="settings" icon={SettingsIcon} label="Settings" />
      </nav>

      <div className="p-4 mt-auto">
        <div className="bg-white border border-[#E8DFD0] shadow-sm rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <img src={user.photoURL || ''} className="w-10 h-10 rounded-2xl border border-[#E8DFD0]" alt="me" />
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-[#3D2E1C] truncate">{user.displayName}</p>
              <p className="text-[12px] text-[#8C7B6B] truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={logOut} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium text-[#8C7B6B] hover:text-[#3D2E1C] hover:bg-[#F5F0E8] border border-transparent transition-all">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex relative text-[#3D2E1C] font-sans selection:bg-[#8B5E3C]/20">
      <div className="absolute inset-0 bg-gradient-to-br from-[#F5F0E8] to-[#E8DFD0] pointer-events-none" />

      {/* Desktop Sidebar */}
      <aside className="w-72 border-r border-[#E8DFD0] flex-col shrink-0 hidden md:flex z-20">
        {sidebarContent}
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
              <div className="max-w-6xl mx-auto py-10 px-6 sm:px-10">
                <div className="flex items-center justify-between mb-12">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setMobileSidebar(true)} className="p-3 rounded-2xl bg-white border border-[#E8DFD0] shadow-sm md:hidden text-[#3D2E1C]">
                      <Menu className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-3xl font-serif font-black text-[#3D2E1C] tracking-tight">
                        {view === 'list' ? 'Your Documents' : view === 'settings' ? 'Settings' : 'Upload & Convert'}
                      </h2>
                      <p className="text-[13px] text-[#8C7B6B] font-medium mt-1">
                        {view === 'list' ? `${documents.length} documents` : 'App settings'}
                      </p>
                    </div>
                  </div>
                  
                  {view === 'list' && (
                    <div className="relative hidden lg:block group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#8C7B6B] group-focus-within:text-[#8B5E3C] transition-colors" />
                      <input type="text" placeholder="Search documents..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="pl-12 pr-6 py-3.5 rounded-2xl bg-white border border-[#E8DFD0] shadow-sm text-[14px] text-[#3D2E1C] placeholder:text-[#8C7B6B] focus:border-[#8B5E3C]/40 focus:ring-0 w-80 transition-all outline-none" />
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
    </div>
  );
}
