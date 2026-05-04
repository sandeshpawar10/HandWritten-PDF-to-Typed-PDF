// import React, { useState, useEffect } from 'react';
// import { useAuthState } from 'react-firebase-hooks/auth';
// import { 
//   FileText, Plus, LogOut, Search, Files, Sparkles, User, ArrowRight,
//   AlertTriangle, X, Menu, Table2, Zap, Shield, Settings as SettingsIcon
// } from 'lucide-react';
// import { auth, signInWithGoogle, logOut } from './lib/firebase';
// import { Document, DocumentVersion, ConversionJob } from './types';
// import { subscribeToDocuments, createDocument, subscribeToVersions } from './services/documents';
// import { convertHandwritingToText } from './services/gemini';
// import { FileUpload } from './components/FileUpload';
// import { DocumentList } from './components/DocumentList';
// import { Editor } from './components/Editor';
// import { Settings } from './components/Settings';
// import { cn } from './lib/utils';
// import { motion, AnimatePresence } from 'motion/react';

// export default function App() {
//   const [user, loading] = useAuthState(auth);
//   const [documents, setDocuments] = useState<Document[]>([]);
//   const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
//   const [versions, setVersions] = useState<DocumentVersion[]>([]);
//   const [jobs, setJobs] = useState<ConversionJob[]>([]);
//   const [searchQuery, setSearchQuery] = useState('');
//   const [view, setView] = useState<'list' | 'upload' | 'edit' | 'settings'>('list');
//   const [globalError, setGlobalError] = useState<string | null>(null);
//   const [mobileSidebar, setMobileSidebar] = useState(false);
//   const [authError, setAuthError] = useState<string | null>(null);

//   const handleSignIn = async () => {
//     setAuthError(null);
//     try {
//       await signInWithGoogle();
//     } catch (err: any) {
//       const code = err?.code || '';
//       if (code === 'auth/unauthorized-domain') {
//         setAuthError(
//           `This domain (${window.location.hostname}) is not authorized for sign-in. ` +
//           `Please add it in Firebase Console → Authentication → Settings → Authorized domains.`
//         );
//       } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
//         // User closed the popup — not an error, just ignore
//       } else {
//         setAuthError(err?.message || 'Sign-in failed. Please try again.');
//       }
//     }
//   };

//   useEffect(() => {
//     if (user) {
//       const unsubscribe = subscribeToDocuments(user.uid, setDocuments);
//       return unsubscribe;
//     }
//   }, [user]);

//   useEffect(() => {
//     if (selectedDoc && user) {
//       const unsubscribe = subscribeToVersions(selectedDoc.id, user.uid, setVersions);
//       return unsubscribe;
//     }
//   }, [selectedDoc, user]);

//   const handleFilesAdded = async (files: File[]) => {
//     setGlobalError(null);
//     const newJobs: ConversionJob[] = files.map(file => ({
//       file, id: Math.random().toString(36).substr(2, 9), status: 'pending'
//     }));
//     setJobs(prev => [...prev, ...newJobs]);
//     setView('upload');
//     setMobileSidebar(false);

//     for (let idx = 0; idx < newJobs.length; idx++) {
//       const job = newJobs[idx];

//       // Add a 2-second delay between files to avoid hitting rate limits
//       if (idx > 0) {
//         await new Promise(r => setTimeout(r, 2000));
//       }

//       setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'converting' } : j));
//       try {
//         const text = await convertHandwritingToText(job.file, (status) => {
//           // Update the job with progress status (shown in UI)
//           setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'converting', error: status } : j));
//         });
//         if (!text || text.trim().length === 0) throw new Error('No text could be extracted from the document.');
//         const title = job.file.name.replace(/\.[^/.]+$/, "");
//         await createDocument(user!.uid, title, text, job.file.name);
//         setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'completed', content: text, error: undefined } : j));
//       } catch (err: any) {
//         const errMsg = err?.message || '';
//         let msg: string;
//         if (errMsg.includes('quota') || errMsg.includes('429') || errMsg.includes('rate limit') || errMsg.includes('resource exhausted')) {
//           msg = 'API rate limit reached after retries. Please wait 1-2 minutes and click Retry.';
//         } else if (errMsg.includes('too large') || errMsg.includes('payload')) {
//           msg = 'File too large for the API. Try a smaller PDF (under 20 MB).';
//         } else {
//           msg = errMsg || 'Conversion failed.';
//         }
//         setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed', error: msg } : j));
//       }
//     }
//   };

//   const filteredDocuments = documents.filter(doc =>
//     doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
//     doc.content.toLowerCase().includes(searchQuery.toLowerCase())
//   );

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-bg relative z-10">
//         <div className="flex flex-col items-center gap-6">
//           <div className="relative w-16 h-16">
//             <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent to-accent2 opacity-20 animate-pulse" />
//             <div className="absolute inset-0 rounded-2xl border border-accent/30 animate-spin-slow" />
//             <div className="absolute inset-2 rounded-xl bg-surface flex items-center justify-center">
//               <FileText className="w-5 h-5 text-accent" />
//             </div>
//           </div>
//           <p className="text-text-dim font-mono text-xs tracking-widest uppercase animate-pulse-glow">Initializing...</p>
//         </div>
//       </div>
//     );
//   }

//   if (!user) {
//     return (
//       <div className="min-h-screen bg-bg flex flex-col relative overflow-hidden">
//         {/* Animated orbs */}
//         <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-accent/5 blur-[120px] animate-float pointer-events-none" />
//         <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent2/5 blur-[100px] animate-float pointer-events-none" style={{animationDelay:'2s'}} />
        
//         <header className="relative z-10 px-6 sm:px-8 h-20 flex items-center justify-between border-b border-border">
//           <div className="flex items-center gap-3">
//             <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/20 to-accent2/20 border border-accent/20 flex items-center justify-center glow-cyan">
//               <FileText className="w-4 h-4 text-accent" />
//             </div>
//             <span className="font-display font-bold text-sm tracking-tight text-text-main">TypedDoc</span>
//           </div>
//           <button onClick={handleSignIn}
//             className="flex items-center gap-2 px-4 py-2 rounded-xl glass border-border-bright text-xs font-semibold text-text-mid hover:text-accent hover:border-accent/30 transition-all duration-300"
//           >
//             Sign in <ArrowRight className="w-3.5 h-3.5" />
//           </button>
//         </header>

//         <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
//           <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{duration:0.7,ease:[0.16,1,0.3,1]}} className="max-w-4xl">
            
//             <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-accent/20 text-accent text-[11px] font-mono font-medium tracking-widest mb-8">
//               <Sparkles className="w-3 h-3 animate-pulse-glow" />
//               GEMINI AI · OCR ENGINE
//             </div>

//             <h1 className="text-5xl sm:text-6xl md:text-8xl font-display font-bold leading-[0.95] tracking-tight mb-8">
//               <span className="text-text-main">Turn </span>
//               <span className="relative">
//                 <span className="bg-gradient-to-r from-accent via-accent2 to-accent3 bg-clip-text text-transparent">handwriting</span>
//                 <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
//                   <path d="M2 8 Q75 2 150 8 Q225 14 298 6" stroke="url(#ul)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
//                   <defs><linearGradient id="ul" x1="0" y1="0" x2="300" y2="0"><stop stopColor="#6ee7f7"/><stop offset="0.5" stopColor="#a78bfa"/><stop offset="1" stopColor="#34d399"/></linearGradient></defs>
//                 </svg>
//               </span>
//               <span className="text-text-main"> into</span>
//               <br />
//               <span className="text-text-dim font-light">typed documents.</span>
//             </h1>

//             <p className="text-base sm:text-lg text-text-mid max-w-xl mx-auto mb-12 leading-relaxed">
//               Upload any handwritten PDF or image. Gemini AI transcribes every page—including <strong className="text-accent">tables</strong>, lists, and formulas—into clean, exportable documents.
//             </p>

//             {authError && (
//               <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
//                 className="mb-8 max-w-lg mx-auto flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-left"
//               >
//                 <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
//                 <div>
//                   <p className="font-semibold mb-1">Sign-in failed</p>
//                   <p className="text-xs text-red-400/80">{authError}</p>
//                 </div>
//                 <button onClick={() => setAuthError(null)} className="ml-auto shrink-0"><X className="w-3.5 h-3.5" /></button>
//               </motion.div>
//             )}

//             <motion.button
//               onClick={handleSignIn}
//               whileHover={{scale:1.03}} whileTap={{scale:0.97}}
//               className="relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-sm overflow-hidden group"
//               style={{background:'linear-gradient(135deg, rgba(110,231,247,0.15), rgba(167,139,250,0.15))', border:'1px solid rgba(110,231,247,0.3)'}}
//             >
//               <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-accent2/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
//               <div className="absolute inset-0 overflow-hidden rounded-2xl">
//                 <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12" />
//               </div>
//               <User className="w-4 h-4 text-accent relative z-10" />
//               <span className="relative z-10 text-text-main">Continue with Google</span>
//               <ArrowRight className="w-4 h-4 text-accent relative z-10 group-hover:translate-x-1 transition-transform" />
//             </motion.button>

//             {/* Feature pills */}
//             <div className="flex flex-wrap items-center justify-center gap-3 mt-16">
//               {[
//                 { icon: Table2, text: 'Table Preservation' },
//                 { icon: Files, text: 'Multi-page PDF' },
//                 { icon: Zap, text: 'Batch Upload' },
//                 { icon: FileText, text: 'Export PDF/DOCX/TXT' },
//                 { icon: Shield, text: 'Version History' },
//               ].map(({ icon: Icon, text }) => (
//                 <span key={text} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-text-dim border border-border glass">
//                   <Icon className="w-3 h-3 text-accent/60" />
//                   {text}
//                 </span>
//               ))}
//             </div>
//           </motion.div>
//         </main>
//       </div>
//     );
//   }

//   // ── Authenticated layout ──
//   const sidebarContent = (
//     <>
//       {/* Logo */}
//       <div className="h-16 px-5 flex items-center gap-3 border-b border-border">
//         <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/20 to-accent2/20 border border-accent/20 flex items-center justify-center">
//           <FileText className="w-4 h-4 text-accent" />
//         </div>
//         <span className="font-display font-bold text-sm text-text-main tracking-tight">TypedDoc</span>
//         {/* Close button (mobile only) */}
//         <button onClick={() => setMobileSidebar(false)} className="ml-auto p-1.5 rounded-lg hover:bg-surface text-text-dim md:hidden">
//           <X className="w-4 h-4" />
//         </button>
//       </div>

//       {/* Nav */}
//       <nav className="flex-1 p-3 space-y-1">
//         <p className="px-3 text-[10px] font-mono text-text-dim uppercase tracking-widest mb-3 mt-2">Workspace</p>
        
//         {[
//           { id: 'list', icon: Files, label: 'Library', badge: documents.length > 0 ? documents.length : null },
//           { id: 'upload', icon: Plus, label: 'Convert', badge: null },
//           { id: 'settings', icon: SettingsIcon, label: 'Settings', badge: null },
//         ].map(({ id, icon: Icon, label, badge }) => (
//           <button
//             key={id}
//             onClick={() => { setView(id as any); if (id === 'list') setSelectedDoc(null); setMobileSidebar(false); }}
//             className={cn(
//               "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group",
//               view === id && selectedDoc === null
//                 ? "bg-gradient-to-r from-accent/10 to-accent2/10 text-accent border border-accent/20"
//                 : "text-text-dim hover:text-text-main hover:bg-surface"
//             )}
//           >
//             <Icon className="w-4 h-4 shrink-0" />
//             <span>{label}</span>
//             {badge !== null && (
//               <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{badge}</span>
//             )}
//             {id === 'upload' && jobs.some(j => j.status === 'converting') && (
//               <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
//             )}
//           </button>
//         ))}
//       </nav>

//       {/* User */}
//       <div className="p-3 border-t border-border">
//         <div className="flex items-center gap-3 px-3 py-2 mb-2">
//           <img
//             src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=0d1117&color=6ee7f7`}
//             alt="avatar"
//             referrerPolicy="no-referrer"
//             className="w-7 h-7 rounded-full border border-border"
//           />
//           <div className="min-w-0">
//             <p className="text-xs font-semibold text-text-main truncate">{user.displayName}</p>
//             <p className="text-[10px] text-text-dim truncate font-mono">{user.email}</p>
//           </div>
//         </div>
//         <button
//           onClick={logOut}
//           className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-medium text-text-dim hover:text-red-400 hover:bg-red-500/5 border border-border hover:border-red-500/20 transition-all"
//         >
//           <LogOut className="w-3.5 h-3.5" />
//           Sign out
//         </button>
//       </div>
//     </>
//   );

//   return (
//     <div className="min-h-screen bg-bg flex relative">
//       {/* Background orbs */}
//       <div className="fixed top-0 left-0 w-[400px] h-[400px] rounded-full bg-accent/3 blur-[100px] pointer-events-none" />
//       <div className="fixed bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-accent2/3 blur-[80px] pointer-events-none" />

//       {/* Desktop Sidebar */}
//       <aside className="relative z-10 w-60 bg-sidebar border-r border-border flex-col shrink-0 hidden md:flex" style={{backdropFilter:'blur(20px)'}}>
//         {sidebarContent}
//       </aside>

//       {/* Mobile Sidebar Overlay */}
//       <AnimatePresence>
//         {mobileSidebar && (
//           <>
//             <motion.div
//               initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
//               className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
//               onClick={() => setMobileSidebar(false)}
//             />
//             <motion.aside
//               initial={{x:-260}} animate={{x:0}} exit={{x:-260}}
//               transition={{type:'spring', damping:25, stiffness:300}}
//               className="fixed left-0 top-0 bottom-0 w-60 bg-sidebar border-r border-border flex flex-col z-50 md:hidden"
//               style={{backdropFilter:'blur(20px)'}}
//             >
//               {sidebarContent}
//             </motion.aside>
//           </>
//         )}
//       </AnimatePresence>

//       {/* Main */}
//       <main className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
//         <AnimatePresence mode="wait">
//           {view === 'edit' && selectedDoc ? (
//             <motion.div key="editor" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="h-screen">
//               <Editor document={selectedDoc} onBack={() => setView('list')} versions={versions} />
//             </motion.div>
//           ) : (
//             <motion.div key="main" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex-1 overflow-y-auto">
//               <div className="max-w-5xl mx-auto py-8 sm:py-10 px-5 sm:px-10">
//                 {/* Header */}
//                 <div className="flex items-center justify-between mb-8 sm:mb-10">
//                   <div className="flex items-center gap-3">
//                     {/* Mobile hamburger */}
//                     <button onClick={() => setMobileSidebar(true)} className="p-2 rounded-xl hover:bg-surface text-text-dim md:hidden">
//                       <Menu className="w-5 h-5" />
//                     </button>
//                     <div>
//                       <h2 className="text-xl sm:text-2xl font-display font-bold text-text-main tracking-tight">
//                         {view === 'list' ? 'Document Library' : view === 'settings' ? 'Settings' : 'Convert Documents'}
//                       </h2>
//                       <p className="text-xs sm:text-sm text-text-dim mt-1">
//                         {view === 'list' 
//                           ? `${documents.length} document${documents.length !== 1 ? 's' : ''} in your archive`
//                           : view === 'settings'
//                             ? 'Configure your API key and preferences'
//                             : 'Upload handwritten PDFs or images to transcribe'}
//                       </p>
//                     </div>
//                   </div>
//                   {view === 'list' && (
//                     <div className="relative hidden sm:block">
//                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
//                       <input
//                         type="text"
//                         placeholder="Search documents..."
//                         value={searchQuery}
//                         onChange={e => setSearchQuery(e.target.value)}
//                         className="pl-9 pr-4 py-2.5 rounded-xl glass border-border text-xs text-text-main placeholder:text-text-dim focus:border-accent/40 focus:outline-none transition-all w-56"
//                       />
//                     </div>
//                   )}
//                 </div>

//                 {/* Mobile search */}
//                 {view === 'list' && (
//                   <div className="relative sm:hidden mb-6">
//                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
//                     <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
//                       className="w-full pl-9 pr-4 py-2.5 rounded-xl glass border-border text-xs text-text-main placeholder:text-text-dim focus:border-accent/40 focus:outline-none transition-all" />
//                   </div>
//                 )}

//                 {globalError && (
//                   <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
//                     className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
//                   >
//                     <AlertTriangle className="w-4 h-4 shrink-0" />
//                     <span>{globalError}</span>
//                     <button onClick={() => setGlobalError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
//                   </motion.div>
//                 )}

//                 <AnimatePresence mode="wait">
//                   {view === 'list' ? (
//                     <motion.div key="list" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
//                       <DocumentList documents={filteredDocuments} onSelect={doc => { setSelectedDoc(doc); setView('edit'); }} />
//                     </motion.div>
//                   ) : view === 'settings' ? (
//                     <motion.div key="settings" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
//                       <Settings />
//                     </motion.div>
//                   ) : (
//                     <motion.div key="upload" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
//                       <FileUpload onFilesAdded={handleFilesAdded} jobs={jobs} onRemoveJob={id => setJobs(p => p.filter(j => j.id !== id))} />
//                       {jobs.some(j => j.status === 'completed') && (
//                         <motion.div initial={{opacity:0}} animate={{opacity:1}} className="mt-8 flex justify-center">
//                           <button onClick={() => setView('list')}
//                             className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-bg transition-all hover:scale-[1.02] active:scale-[0.98]"
//                             style={{background:'linear-gradient(135deg, #6ee7f7, #a78bfa)'}}>
//                             <Files className="w-4 h-4" />
//                             View in Library
//                             <ArrowRight className="w-4 h-4" />
//                           </button>
//                         </motion.div>
//                       )}
//                     </motion.div>
//                   )}
//                 </AnimatePresence>
//               </div>
//             </motion.div>
//           )}
//         </AnimatePresence>
//       </main>
//     </div>
//   );
// }







// import React, { useState, useEffect } from 'react';
// import { useAuthState } from 'react-firebase-hooks/auth';
// import { 
//   FileText, Plus, LogOut, Search, Files, Sparkles, User, ArrowRight,
//   AlertTriangle, X, Menu, Table2, Zap, Shield, Settings as SettingsIcon
// } from 'lucide-react';
// import { auth, signInWithGoogle, logOut } from './lib/firebase';
// import { Document, DocumentVersion, ConversionJob } from './types';
// import { subscribeToDocuments, createDocument, subscribeToVersions } from './services/documents';
// import { convertHandwritingToText } from './services/gemini';
// import { FileUpload } from './components/FileUpload';
// import { DocumentList } from './components/DocumentList';
// import { Editor } from './components/Editor';
// import { Settings } from './components/Settings';
// import { cn } from './lib/utils';
// import { motion, AnimatePresence } from 'motion/react';

// export default function App() {
//   const [user, loading] = useAuthState(auth);
//   const [documents, setDocuments] = useState<Document[]>([]);
//   const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
//   const [versions, setVersions] = useState<DocumentVersion[]>([]);
//   const [jobs, setJobs] = useState<ConversionJob[]>([]);
//   const [searchQuery, setSearchQuery] = useState('');
//   const [view, setView] = useState<'list' | 'upload' | 'edit' | 'settings'>('list');
//   const [globalError, setGlobalError] = useState<string | null>(null);
//   const [mobileSidebar, setMobileSidebar] = useState(false);
//   const [authError, setAuthError] = useState<string | null>(null);

//   const handleSignIn = async () => {
//     setAuthError(null);
//     try {
//       await signInWithGoogle();
//     } catch (err: any) {
//       const code = err?.code || '';
//       if (code === 'auth/unauthorized-domain') {
//         setAuthError(
//           `This domain (${window.location.hostname}) is not authorized for sign-in. ` +
//           `Please add it in Firebase Console → Authentication → Settings → Authorized domains.`
//         );
//       } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
//         // User closed the popup — not an error, just ignore
//       } else {
//         setAuthError(err?.message || 'Sign-in failed. Please try again.');
//       }
//     }
//   };

//   useEffect(() => {
//     if (user) {
//       const unsubscribe = subscribeToDocuments(user.uid, setDocuments);
//       return unsubscribe;
//     }
//   }, [user]);

//   useEffect(() => {
//     if (selectedDoc && user) {
//       const unsubscribe = subscribeToVersions(selectedDoc.id, user.uid, setVersions);
//       return unsubscribe;
//     }
//   }, [selectedDoc, user]);

//   const handleFilesAdded = async (files: File[]) => {
//     setGlobalError(null);
//     const newJobs: ConversionJob[] = files.map(file => ({
//       file, id: Math.random().toString(36).substr(2, 9), status: 'pending'
//     }));
//     setJobs(prev => [...prev, ...newJobs]);
//     setView('upload');
//     setMobileSidebar(false);

//     for (let idx = 0; idx < newJobs.length; idx++) {
//       const job = newJobs[idx];

//       // Add a 2-second delay between files to avoid hitting rate limits
//       if (idx > 0) {
//         await new Promise(r => setTimeout(r, 2000));
//       }

//       setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'converting' } : j));
//       try {
//         const text = await convertHandwritingToText(job.file, (status) => {
//           // Update the job with progress status (shown in UI)
//           setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'converting', error: status } : j));
//         });
//         if (!text || text.trim().length === 0) throw new Error('No text could be extracted from the document.');
//         const title = job.file.name.replace(/\.[^/.]+$/, "");
//         await createDocument(user!.uid, title, text, job.file.name);
//         setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'completed', content: text, error: undefined } : j));
//       } catch (err: any) {
//         const errMsg = err?.message || '';
//         let msg: string;
//         if (errMsg.startsWith('NO_API_KEY:') || errMsg.includes('NO_API_KEY')) {
//           msg = '⚠️ No API key set. Go to Settings → add your free Gemini API key from Google AI Studio.';
//         } else if (errMsg.includes('quota') || errMsg.includes('429') || errMsg.includes('rate limit') || errMsg.includes('resource exhausted')) {
//           msg = 'API rate limit reached after retries. Your free-tier key is exhausted. Wait a minute, or try again later.';
//         } else if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('api key not valid')) {
//           msg = 'Invalid API key. Double-check your key in Settings — it should start with "AIza…".';
//         } else if (errMsg.includes('too large') || errMsg.includes('payload')) {
//           msg = 'File too large for the API. Try a smaller PDF (under 20 MB).';
//         } else {
//           msg = errMsg || 'Conversion failed.';
//         }
//         setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed', error: msg } : j));
//       }
//     }
//   };

//   const filteredDocuments = documents.filter(doc =>
//     doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
//     doc.content.toLowerCase().includes(searchQuery.toLowerCase())
//   );

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-bg relative z-10">
//         <div className="flex flex-col items-center gap-6">
//           <div className="relative w-16 h-16">
//             <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent to-accent2 opacity-20 animate-pulse" />
//             <div className="absolute inset-0 rounded-2xl border border-accent/30 animate-spin-slow" />
//             <div className="absolute inset-2 rounded-xl bg-surface flex items-center justify-center">
//               <FileText className="w-5 h-5 text-accent" />
//             </div>
//           </div>
//           <p className="text-text-dim font-mono text-xs tracking-widest uppercase animate-pulse-glow">Initializing...</p>
//         </div>
//       </div>
//     );
//   }

//   if (!user) {
//     return (
//       <div className="min-h-screen bg-bg flex flex-col relative overflow-hidden">
//         {/* Animated orbs */}
//         <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-accent/5 blur-[120px] animate-float pointer-events-none" />
//         <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent2/5 blur-[100px] animate-float pointer-events-none" style={{animationDelay:'2s'}} />
        
//         <header className="relative z-10 px-6 sm:px-8 h-20 flex items-center justify-between border-b border-border">
//           <div className="flex items-center gap-3">
//             <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/20 to-accent2/20 border border-accent/20 flex items-center justify-center glow-cyan">
//               <FileText className="w-4 h-4 text-accent" />
//             </div>
//             <span className="font-display font-bold text-sm tracking-tight text-text-main">TypedDoc</span>
//           </div>
//           <button onClick={handleSignIn}
//             className="flex items-center gap-2 px-4 py-2 rounded-xl glass border-border-bright text-xs font-semibold text-text-mid hover:text-accent hover:border-accent/30 transition-all duration-300"
//           >
//             Sign in <ArrowRight className="w-3.5 h-3.5" />
//           </button>
//         </header>

//         <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
//           <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{duration:0.7,ease:[0.16,1,0.3,1]}} className="max-w-4xl">
            
//             <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-accent/20 text-accent text-[11px] font-mono font-medium tracking-widest mb-8">
//               <Sparkles className="w-3 h-3 animate-pulse-glow" />
//               GEMINI AI · OCR ENGINE
//             </div>

//             <h1 className="text-5xl sm:text-6xl md:text-8xl font-display font-bold leading-[0.95] tracking-tight mb-8">
//               <span className="text-text-main">Turn </span>
//               <span className="relative">
//                 <span className="bg-gradient-to-r from-accent via-accent2 to-accent3 bg-clip-text text-transparent">handwriting</span>
//                 <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
//                   <path d="M2 8 Q75 2 150 8 Q225 14 298 6" stroke="url(#ul)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
//                   <defs><linearGradient id="ul" x1="0" y1="0" x2="300" y2="0"><stop stopColor="#6ee7f7"/><stop offset="0.5" stopColor="#a78bfa"/><stop offset="1" stopColor="#34d399"/></linearGradient></defs>
//                 </svg>
//               </span>
//               <span className="text-text-main"> into</span>
//               <br />
//               <span className="text-text-dim font-light">typed documents.</span>
//             </h1>

//             <p className="text-base sm:text-lg text-text-mid max-w-xl mx-auto mb-12 leading-relaxed">
//               Upload any handwritten PDF or image. Gemini AI transcribes every page—including <strong className="text-accent">tables</strong>, lists, and formulas—into clean, exportable documents.
//             </p>

//             {authError && (
//               <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
//                 className="mb-8 max-w-lg mx-auto flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-left"
//               >
//                 <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
//                 <div>
//                   <p className="font-semibold mb-1">Sign-in failed</p>
//                   <p className="text-xs text-red-400/80">{authError}</p>
//                 </div>
//                 <button onClick={() => setAuthError(null)} className="ml-auto shrink-0"><X className="w-3.5 h-3.5" /></button>
//               </motion.div>
//             )}

//             <motion.button
//               onClick={handleSignIn}
//               whileHover={{scale:1.03}} whileTap={{scale:0.97}}
//               className="relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-sm overflow-hidden group"
//               style={{background:'linear-gradient(135deg, rgba(110,231,247,0.15), rgba(167,139,250,0.15))', border:'1px solid rgba(110,231,247,0.3)'}}
//             >
//               <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-accent2/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
//               <div className="absolute inset-0 overflow-hidden rounded-2xl">
//                 <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12" />
//               </div>
//               <User className="w-4 h-4 text-accent relative z-10" />
//               <span className="relative z-10 text-text-main">Continue with Google</span>
//               <ArrowRight className="w-4 h-4 text-accent relative z-10 group-hover:translate-x-1 transition-transform" />
//             </motion.button>

//             {/* Feature pills */}
//             <div className="flex flex-wrap items-center justify-center gap-3 mt-16">
//               {[
//                 { icon: Table2, text: 'Table Preservation' },
//                 { icon: Files, text: 'Multi-page PDF' },
//                 { icon: Zap, text: 'Batch Upload' },
//                 { icon: FileText, text: 'Export PDF/DOCX/TXT' },
//                 { icon: Shield, text: 'Version History' },
//               ].map(({ icon: Icon, text }) => (
//                 <span key={text} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-text-dim border border-border glass">
//                   <Icon className="w-3 h-3 text-accent/60" />
//                   {text}
//                 </span>
//               ))}
//             </div>
//           </motion.div>
//         </main>
//       </div>
//     );
//   }

//   // ── Authenticated layout ──
//   const sidebarContent = (
//     <>
//       {/* Logo */}
//       <div className="h-16 px-5 flex items-center gap-3 border-b border-border">
//         <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/20 to-accent2/20 border border-accent/20 flex items-center justify-center">
//           <FileText className="w-4 h-4 text-accent" />
//         </div>
//         <span className="font-display font-bold text-sm text-text-main tracking-tight">TypedDoc</span>
//         {/* Close button (mobile only) */}
//         <button onClick={() => setMobileSidebar(false)} className="ml-auto p-1.5 rounded-lg hover:bg-surface text-text-dim md:hidden">
//           <X className="w-4 h-4" />
//         </button>
//       </div>

//       {/* Nav */}
//       <nav className="flex-1 p-3 space-y-1">
//         <p className="px-3 text-[10px] font-mono text-text-dim uppercase tracking-widest mb-3 mt-2">Workspace</p>
        
//         {[
//           { id: 'list', icon: Files, label: 'Library', badge: documents.length > 0 ? documents.length : null },
//           { id: 'upload', icon: Plus, label: 'Convert', badge: null },
//           { id: 'settings', icon: SettingsIcon, label: 'Settings', badge: null },
//         ].map(({ id, icon: Icon, label, badge }) => (
//           <button
//             key={id}
//             onClick={() => { setView(id as any); if (id === 'list') setSelectedDoc(null); setMobileSidebar(false); }}
//             className={cn(
//               "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group",
//               view === id && selectedDoc === null
//                 ? "bg-gradient-to-r from-accent/10 to-accent2/10 text-accent border border-accent/20"
//                 : "text-text-dim hover:text-text-main hover:bg-surface"
//             )}
//           >
//             <Icon className="w-4 h-4 shrink-0" />
//             <span>{label}</span>
//             {badge !== null && (
//               <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{badge}</span>
//             )}
//             {id === 'upload' && jobs.some(j => j.status === 'converting') && (
//               <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
//             )}
//           </button>
//         ))}
//       </nav>

//       {/* User */}
//       <div className="p-3 border-t border-border">
//         <div className="flex items-center gap-3 px-3 py-2 mb-2">
//           <img
//             src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=0d1117&color=6ee7f7`}
//             alt="avatar"
//             referrerPolicy="no-referrer"
//             className="w-7 h-7 rounded-full border border-border"
//           />
//           <div className="min-w-0">
//             <p className="text-xs font-semibold text-text-main truncate">{user.displayName}</p>
//             <p className="text-[10px] text-text-dim truncate font-mono">{user.email}</p>
//           </div>
//         </div>
//         <button
//           onClick={logOut}
//           className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-medium text-text-dim hover:text-red-400 hover:bg-red-500/5 border border-border hover:border-red-500/20 transition-all"
//         >
//           <LogOut className="w-3.5 h-3.5" />
//           Sign out
//         </button>
//       </div>
//     </>
//   );

//   return (
//     <div className="min-h-screen bg-bg flex relative">
//       {/* Background orbs */}
//       <div className="fixed top-0 left-0 w-[400px] h-[400px] rounded-full bg-accent/3 blur-[100px] pointer-events-none" />
//       <div className="fixed bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-accent2/3 blur-[80px] pointer-events-none" />

//       {/* Desktop Sidebar */}
//       <aside className="relative z-10 w-60 bg-sidebar border-r border-border flex-col shrink-0 hidden md:flex" style={{backdropFilter:'blur(20px)'}}>
//         {sidebarContent}
//       </aside>

//       {/* Mobile Sidebar Overlay */}
//       <AnimatePresence>
//         {mobileSidebar && (
//           <>
//             <motion.div
//               initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
//               className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
//               onClick={() => setMobileSidebar(false)}
//             />
//             <motion.aside
//               initial={{x:-260}} animate={{x:0}} exit={{x:-260}}
//               transition={{type:'spring', damping:25, stiffness:300}}
//               className="fixed left-0 top-0 bottom-0 w-60 bg-sidebar border-r border-border flex flex-col z-50 md:hidden"
//               style={{backdropFilter:'blur(20px)'}}
//             >
//               {sidebarContent}
//             </motion.aside>
//           </>
//         )}
//       </AnimatePresence>

//       {/* Main */}
//       <main className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
//         <AnimatePresence mode="wait">
//           {view === 'edit' && selectedDoc ? (
//             <motion.div key="editor" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="h-screen">
//               <Editor document={selectedDoc} onBack={() => setView('list')} versions={versions} />
//             </motion.div>
//           ) : (
//             <motion.div key="main" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex-1 overflow-y-auto">
//               <div className="max-w-5xl mx-auto py-8 sm:py-10 px-5 sm:px-10">
//                 {/* Header */}
//                 <div className="flex items-center justify-between mb-8 sm:mb-10">
//                   <div className="flex items-center gap-3">
//                     {/* Mobile hamburger */}
//                     <button onClick={() => setMobileSidebar(true)} className="p-2 rounded-xl hover:bg-surface text-text-dim md:hidden">
//                       <Menu className="w-5 h-5" />
//                     </button>
//                     <div>
//                       <h2 className="text-xl sm:text-2xl font-display font-bold text-text-main tracking-tight">
//                         {view === 'list' ? 'Document Library' : view === 'settings' ? 'Settings' : 'Convert Documents'}
//                       </h2>
//                       <p className="text-xs sm:text-sm text-text-dim mt-1">
//                         {view === 'list' 
//                           ? `${documents.length} document${documents.length !== 1 ? 's' : ''} in your archive`
//                           : view === 'settings'
//                             ? 'Configure your API key and preferences'
//                             : 'Upload handwritten PDFs or images to transcribe'}
//                       </p>
//                     </div>
//                   </div>
//                   {view === 'list' && (
//                     <div className="relative hidden sm:block">
//                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
//                       <input
//                         type="text"
//                         placeholder="Search documents..."
//                         value={searchQuery}
//                         onChange={e => setSearchQuery(e.target.value)}
//                         className="pl-9 pr-4 py-2.5 rounded-xl glass border-border text-xs text-text-main placeholder:text-text-dim focus:border-accent/40 focus:outline-none transition-all w-56"
//                       />
//                     </div>
//                   )}
//                 </div>

//                 {/* Mobile search */}
//                 {view === 'list' && (
//                   <div className="relative sm:hidden mb-6">
//                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
//                     <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
//                       className="w-full pl-9 pr-4 py-2.5 rounded-xl glass border-border text-xs text-text-main placeholder:text-text-dim focus:border-accent/40 focus:outline-none transition-all" />
//                   </div>
//                 )}

//                 {globalError && (
//                   <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
//                     className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
//                   >
//                     <AlertTriangle className="w-4 h-4 shrink-0" />
//                     <span>{globalError}</span>
//                     <button onClick={() => setGlobalError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
//                   </motion.div>
//                 )}

//                 <AnimatePresence mode="wait">
//                   {view === 'list' ? (
//                     <motion.div key="list" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
//                       <DocumentList documents={filteredDocuments} onSelect={doc => { setSelectedDoc(doc); setView('edit'); }} />
//                     </motion.div>
//                   ) : view === 'settings' ? (
//                     <motion.div key="settings" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
//                       <Settings />
//                     </motion.div>
//                   ) : (
//                     <motion.div key="upload" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
//                       <FileUpload onFilesAdded={handleFilesAdded} jobs={jobs} onRemoveJob={id => setJobs(p => p.filter(j => j.id !== id))} />
//                       {jobs.some(j => j.status === 'completed') && (
//                         <motion.div initial={{opacity:0}} animate={{opacity:1}} className="mt-8 flex justify-center">
//                           <button onClick={() => setView('list')}
//                             className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-bg transition-all hover:scale-[1.02] active:scale-[0.98]"
//                             style={{background:'linear-gradient(135deg, #6ee7f7, #a78bfa)'}}>
//                             <Files className="w-4 h-4" />
//                             View in Library
//                             <ArrowRight className="w-4 h-4" />
//                           </button>
//                         </motion.div>
//                       )}
//                     </motion.div>
//                   )}
//                 </AnimatePresence>
//               </div>
//             </motion.div>
//           )}
//         </AnimatePresence>
//       </main>
//     </div>
//   );
// }






import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  FileText, Plus, LogOut, Search, Files, Sparkles, User, ArrowRight,
  AlertTriangle, X, Menu, Table2, Zap, Shield, Settings as SettingsIcon
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
        setAuthError(
          `This domain (${window.location.hostname}) is not authorized for sign-in. ` +
          `Please add it in Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // User closed the popup — not an error, just ignore
      } else {
        setAuthError(err?.message || 'Sign-in failed. Please try again.');
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

      // Add a 2-second delay between files to avoid hitting rate limits
      if (idx > 0) {
        await new Promise(r => setTimeout(r, 2000));
      }

      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'converting' } : j));
      try {
        const text = await convertHandwritingToText(job.file, (status) => {
          // Update the job with progress status (shown in UI)
          setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'converting', error: status } : j));
        });
        if (!text || text.trim().length === 0) throw new Error('No text could be extracted from the document.');
        const title = job.file.name.replace(/\.[^/.]+$/, "");
        await createDocument(user!.uid, title, text, job.file.name);
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'completed', content: text, error: undefined } : j));
      } catch (err: any) {
        const errMsg = err?.message || '';
        let msg: string;
        if (errMsg.startsWith('NO_API_KEY:') || errMsg.includes('NO_API_KEY')) {
          msg = '⚠️ No API key set. Go to Settings → add your Mistral API key from console.mistral.ai/api-keys';
        } else if (errMsg.startsWith('INVALID_API_KEY:') || errMsg.includes('INVALID_API_KEY')) {
          msg = '🔑 Invalid API key. Double-check your Mistral key in Settings.';
        } else if (errMsg.startsWith('QUOTA:') || errMsg.includes('QUOTA')) {
          msg = '💳 Mistral quota exceeded. Top up at console.mistral.ai — costs only ~₹0.05 per 30-page PDF.';
        } else if (errMsg.includes('429') || errMsg.includes('rate limit') || errMsg.includes('too many')) {
          msg = '⏳ Rate limited. Retrying automatically — or wait a moment and try again.';
        } else if (errMsg.includes('too large') || errMsg.includes('payload')) {
          msg = 'File too large. Mistral OCR supports PDFs up to 50 MB.';
        } else {
          msg = errMsg || 'Conversion failed.';
        }
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed', error: msg } : j));
      }
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg relative z-10">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent to-accent2 opacity-20 animate-pulse" />
            <div className="absolute inset-0 rounded-2xl border border-accent/30 animate-spin-slow" />
            <div className="absolute inset-2 rounded-xl bg-surface flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent" />
            </div>
          </div>
          <p className="text-text-dim font-mono text-xs tracking-widest uppercase animate-pulse-glow">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex flex-col relative overflow-hidden">
        {/* Animated orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-accent/5 blur-[120px] animate-float pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent2/5 blur-[100px] animate-float pointer-events-none" style={{animationDelay:'2s'}} />
        
        <header className="relative z-10 px-6 sm:px-8 h-20 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/20 to-accent2/20 border border-accent/20 flex items-center justify-center glow-cyan">
              <FileText className="w-4 h-4 text-accent" />
            </div>
            <span className="font-display font-bold text-sm tracking-tight text-text-main">TypedDoc</span>
          </div>
          <button onClick={handleSignIn}
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass border-border-bright text-xs font-semibold text-text-mid hover:text-accent hover:border-accent/30 transition-all duration-300"
          >
            Sign in <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </header>

        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
          <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{duration:0.7,ease:[0.16,1,0.3,1]}} className="max-w-4xl">
            
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-accent/20 text-accent text-[11px] font-mono font-medium tracking-widest mb-8">
              <Sparkles className="w-3 h-3 animate-pulse-glow" />
              GEMINI AI · OCR ENGINE
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-8xl font-display font-bold leading-[0.95] tracking-tight mb-8">
              <span className="text-text-main">Turn </span>
              <span className="relative">
                <span className="bg-gradient-to-r from-accent via-accent2 to-accent3 bg-clip-text text-transparent">handwriting</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <path d="M2 8 Q75 2 150 8 Q225 14 298 6" stroke="url(#ul)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                  <defs><linearGradient id="ul" x1="0" y1="0" x2="300" y2="0"><stop stopColor="#6ee7f7"/><stop offset="0.5" stopColor="#a78bfa"/><stop offset="1" stopColor="#34d399"/></linearGradient></defs>
                </svg>
              </span>
              <span className="text-text-main"> into</span>
              <br />
              <span className="text-text-dim font-light">typed documents.</span>
            </h1>

            <p className="text-base sm:text-lg text-text-mid max-w-xl mx-auto mb-12 leading-relaxed">
              Upload any handwritten PDF or image. Gemini AI transcribes every page—including <strong className="text-accent">tables</strong>, lists, and formulas—into clean, exportable documents.
            </p>

            {authError && (
              <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
                className="mb-8 max-w-lg mx-auto flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-left"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Sign-in failed</p>
                  <p className="text-xs text-red-400/80">{authError}</p>
                </div>
                <button onClick={() => setAuthError(null)} className="ml-auto shrink-0"><X className="w-3.5 h-3.5" /></button>
              </motion.div>
            )}

            <motion.button
              onClick={handleSignIn}
              whileHover={{scale:1.03}} whileTap={{scale:0.97}}
              className="relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-sm overflow-hidden group"
              style={{background:'linear-gradient(135deg, rgba(110,231,247,0.15), rgba(167,139,250,0.15))', border:'1px solid rgba(110,231,247,0.3)'}}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-accent2/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12" />
              </div>
              <User className="w-4 h-4 text-accent relative z-10" />
              <span className="relative z-10 text-text-main">Continue with Google</span>
              <ArrowRight className="w-4 h-4 text-accent relative z-10 group-hover:translate-x-1 transition-transform" />
            </motion.button>

            {/* Feature pills */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-16">
              {[
                { icon: Table2, text: 'Table Preservation' },
                { icon: Files, text: 'Multi-page PDF' },
                { icon: Zap, text: 'Batch Upload' },
                { icon: FileText, text: 'Export PDF/DOCX/TXT' },
                { icon: Shield, text: 'Version History' },
              ].map(({ icon: Icon, text }) => (
                <span key={text} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-text-dim border border-border glass">
                  <Icon className="w-3 h-3 text-accent/60" />
                  {text}
                </span>
              ))}
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  // ── Authenticated layout ──
  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-border">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/20 to-accent2/20 border border-accent/20 flex items-center justify-center">
          <FileText className="w-4 h-4 text-accent" />
        </div>
        <span className="font-display font-bold text-sm text-text-main tracking-tight">TypedDoc</span>
        {/* Close button (mobile only) */}
        <button onClick={() => setMobileSidebar(false)} className="ml-auto p-1.5 rounded-lg hover:bg-surface text-text-dim md:hidden">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        <p className="px-3 text-[10px] font-mono text-text-dim uppercase tracking-widest mb-3 mt-2">Workspace</p>
        
        {[
          { id: 'list', icon: Files, label: 'Library', badge: documents.length > 0 ? documents.length : null },
          { id: 'upload', icon: Plus, label: 'Convert', badge: null },
          { id: 'settings', icon: SettingsIcon, label: 'Settings', badge: null },
        ].map(({ id, icon: Icon, label, badge }) => (
          <button
            key={id}
            onClick={() => { setView(id as any); if (id === 'list') setSelectedDoc(null); setMobileSidebar(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group",
              view === id && selectedDoc === null
                ? "bg-gradient-to-r from-accent/10 to-accent2/10 text-accent border border-accent/20"
                : "text-text-dim hover:text-text-main hover:bg-surface"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
            {badge !== null && (
              <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{badge}</span>
            )}
            {id === 'upload' && jobs.some(j => j.status === 'converting') && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <img
            src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=0d1117&color=6ee7f7`}
            alt="avatar"
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-full border border-border"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text-main truncate">{user.displayName}</p>
            <p className="text-[10px] text-text-dim truncate font-mono">{user.email}</p>
          </div>
        </div>
        <button
          onClick={logOut}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-medium text-text-dim hover:text-red-400 hover:bg-red-500/5 border border-border hover:border-red-500/20 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-bg flex relative">
      {/* Background orbs */}
      <div className="fixed top-0 left-0 w-[400px] h-[400px] rounded-full bg-accent/3 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-accent2/3 blur-[80px] pointer-events-none" />

      {/* Desktop Sidebar */}
      <aside className="relative z-10 w-60 bg-sidebar border-r border-border flex-col shrink-0 hidden md:flex" style={{backdropFilter:'blur(20px)'}}>
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileSidebar && (
          <>
            <motion.div
              initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setMobileSidebar(false)}
            />
            <motion.aside
              initial={{x:-260}} animate={{x:0}} exit={{x:-260}}
              transition={{type:'spring', damping:25, stiffness:300}}
              className="fixed left-0 top-0 bottom-0 w-60 bg-sidebar border-r border-border flex flex-col z-50 md:hidden"
              style={{backdropFilter:'blur(20px)'}}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'edit' && selectedDoc ? (
            <motion.div key="editor" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="h-screen">
              <Editor document={selectedDoc} onBack={() => setView('list')} versions={versions} />
            </motion.div>
          ) : (
            <motion.div key="main" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex-1 overflow-y-auto">
              <div className="max-w-5xl mx-auto py-8 sm:py-10 px-5 sm:px-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 sm:mb-10">
                  <div className="flex items-center gap-3">
                    {/* Mobile hamburger */}
                    <button onClick={() => setMobileSidebar(true)} className="p-2 rounded-xl hover:bg-surface text-text-dim md:hidden">
                      <Menu className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-display font-bold text-text-main tracking-tight">
                        {view === 'list' ? 'Document Library' : view === 'settings' ? 'Settings' : 'Convert Documents'}
                      </h2>
                      <p className="text-xs sm:text-sm text-text-dim mt-1">
                        {view === 'list' 
                          ? `${documents.length} document${documents.length !== 1 ? 's' : ''} in your archive`
                          : view === 'settings'
                            ? 'Configure your API key and preferences'
                            : 'Upload handwritten PDFs or images to transcribe'}
                      </p>
                    </div>
                  </div>
                  {view === 'list' && (
                    <div className="relative hidden sm:block">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
                      <input
                        type="text"
                        placeholder="Search documents..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2.5 rounded-xl glass border-border text-xs text-text-main placeholder:text-text-dim focus:border-accent/40 focus:outline-none transition-all w-56"
                      />
                    </div>
                  )}
                </div>

                {/* Mobile search */}
                {view === 'list' && (
                  <div className="relative sm:hidden mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
                    <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl glass border-border text-xs text-text-main placeholder:text-text-dim focus:border-accent/40 focus:outline-none transition-all" />
                  </div>
                )}

                {globalError && (
                  <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
                    className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{globalError}</span>
                    <button onClick={() => setGlobalError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
                  </motion.div>
                )}

                <AnimatePresence mode="wait">
                  {view === 'list' ? (
                    <motion.div key="list" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
                      <DocumentList documents={filteredDocuments} onSelect={doc => { setSelectedDoc(doc); setView('edit'); }} />
                    </motion.div>
                  ) : view === 'settings' ? (
                    <motion.div key="settings" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
                      <Settings />
                    </motion.div>
                  ) : (
                    <motion.div key="upload" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
                      <FileUpload onFilesAdded={handleFilesAdded} jobs={jobs} onRemoveJob={id => setJobs(p => p.filter(j => j.id !== id))} />
                      {jobs.some(j => j.status === 'completed') && (
                        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="mt-8 flex justify-center">
                          <button onClick={() => setView('list')}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-bg transition-all hover:scale-[1.02] active:scale-[0.98]"
                            style={{background:'linear-gradient(135deg, #6ee7f7, #a78bfa)'}}>
                            <Files className="w-4 h-4" />
                            View in Library
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </motion.div>
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


