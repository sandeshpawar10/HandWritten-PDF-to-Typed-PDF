// import React, { useState, useEffect } from 'react';
// import { Key, Save, CheckCircle2, AlertCircle } from 'lucide-react';
// import { motion } from 'motion/react';

// export function Settings() {
//   const [apiKey, setApiKey] = useState('');
//   const [saved, setSaved] = useState(false);

//   useEffect(() => {
//     const stored = localStorage.getItem('TYPEDDOC_GEMINI_API_KEY');
//     if (stored) setApiKey(stored);
//   }, []);

//   const handleSave = () => {
//     if (apiKey.trim()) {
//       localStorage.setItem('TYPEDDOC_GEMINI_API_KEY', apiKey.trim());
//     } else {
//       localStorage.removeItem('TYPEDDOC_GEMINI_API_KEY');
//     }
//     setSaved(true);
//     setTimeout(() => setSaved(false), 3000);
//   };

//   return (
//     <div className="max-w-2xl mx-auto py-8">
//       <div className="mb-8">
//         <h2 className="text-2xl font-display font-bold text-text-main tracking-tight flex items-center gap-2">
//           <Key className="w-6 h-6 text-accent" />
//           API Configuration
//         </h2>
//         <p className="text-sm text-text-dim mt-2">
//           TypedDoc uses Gemini 2.0 Flash to convert your handwritten documents. If you are experiencing "API rate limit" errors, you can provide your own free Gemini API key below.
//         </p>
//       </div>

//       <div className="p-6 rounded-2xl glass border border-border space-y-6">
//         <div>
//           <label className="block text-sm font-semibold text-text-main mb-2">
//             Your Gemini API Key
//           </label>
//           <div className="relative">
//             <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
//             <input
//               type="password"
//               value={apiKey}
//               onChange={(e) => setApiKey(e.target.value)}
//               placeholder="AIzaSy..."
//               className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface/50 border border-border text-sm text-text-main placeholder:text-text-dim focus:border-accent/50 focus:outline-none transition-all"
//             />
//           </div>
//           <p className="text-xs text-text-dim mt-3">
//             Get a free API key from Google AI Studio. Your key is stored locally in your browser and is never sent to our servers.
//           </p>
//         </div>

//         <div className="flex items-center gap-4 pt-2">
//           <button
//             onClick={handleSave}
//             className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-bg transition-all hover:scale-[1.02] active:scale-[0.98]"
//             style={{ background: 'linear-gradient(135deg, #6ee7f7, #a78bfa)' }}
//           >
//             <Save className="w-4 h-4" />
//             Save Key
//           </button>
          
//           {saved && (
//             <motion.span
//               initial={{ opacity: 0, x: -10 }}
//               animate={{ opacity: 1, x: 0 }}
//               className="flex items-center gap-1.5 text-xs font-semibold text-accent3"
//             >
//               <CheckCircle2 className="w-4 h-4" />
//               Saved successfully
//             </motion.span>
//           )}
//         </div>
//       </div>

//       <div className="mt-8 p-5 rounded-xl bg-accent/5 border border-accent/20 flex gap-3">
//         <AlertCircle className="w-5 h-5 text-accent shrink-0" />
//         <div className="text-sm">
//           <p className="font-semibold text-text-main mb-1">How to get an API key</p>
//           <ol className="list-decimal pl-4 space-y-1 text-text-dim text-xs">
//             <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-accent hover:underline">Google AI Studio</a></li>
//             <li>Sign in with your Google account</li>
//             <li>Click "Create API key"</li>
//             <li>Copy the key and paste it here</li>
//           </ol>
//         </div>
//       </div>
//     </div>
//   );
// }



// import React, { useState, useEffect } from 'react';
// import { Key, Save, CheckCircle2, AlertCircle, ExternalLink, Trash2 } from 'lucide-react';
// import { motion } from 'motion/react';

// export function Settings() {
//   const [apiKey, setApiKey] = useState('');
//   const [saved, setSaved] = useState(false);
//   const [hasKey, setHasKey] = useState(false);

//   useEffect(() => {
//     const stored = localStorage.getItem('TYPEDDOC_GEMINI_API_KEY');
//     if (stored) {
//       setApiKey(stored);
//       setHasKey(true);
//     }
//   }, []);

//   const handleSave = () => {
//     const trimmed = apiKey.trim();
//     if (trimmed) {
//       localStorage.setItem('TYPEDDOC_GEMINI_API_KEY', trimmed);
//       setHasKey(true);
//     } else {
//       localStorage.removeItem('TYPEDDOC_GEMINI_API_KEY');
//       setHasKey(false);
//     }
//     setSaved(true);
//     setTimeout(() => setSaved(false), 3000);
//   };

//   const handleClear = () => {
//     localStorage.removeItem('TYPEDDOC_GEMINI_API_KEY');
//     setApiKey('');
//     setHasKey(false);
//     setSaved(false);
//   };

//   const isValidFormat = apiKey.trim().startsWith('AIza') && apiKey.trim().length > 20;

//   return (
//     <div className="max-w-2xl mx-auto py-8 space-y-6">
//       {/* Why you need your own key */}
//       <div className="p-5 rounded-xl bg-red-500/10 border border-red-500/30 flex gap-3">
//         <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
//         <div className="text-sm">
//           <p className="font-semibold text-red-300 mb-1">Why am I seeing "API rate limit" errors?</p>
//           <p className="text-red-200/70 leading-relaxed">
//             This app uses Google's Gemini AI. Without your own API key the app falls back to a shared
//             demo key that is <strong>shared by everyone</strong> and exhausts its free quota quickly.
//             Add your own key below — it's free and takes 30 seconds.
//           </p>
//         </div>
//       </div>

//       {/* Key input */}
//       <div className="p-6 rounded-2xl glass border border-border space-y-5">
//         <div>
//           <label className="block text-sm font-semibold text-text-main mb-2 flex items-center gap-2">
//             <Key className="w-4 h-4 text-accent" />
//             Your Gemini API Key
//             {hasKey && (
//               <span className="ml-auto flex items-center gap-1 text-xs text-green-400 font-normal">
//                 <CheckCircle2 className="w-3.5 h-3.5" /> Key saved
//               </span>
//             )}
//           </label>
//           <div className="relative">
//             <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
//             <input
//               type="password"
//               value={apiKey}
//               onChange={e => setApiKey(e.target.value)}
//               placeholder="AIzaSy..."
//               className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface/50 border border-border text-sm text-text-main placeholder:text-text-dim focus:border-accent/50 focus:outline-none transition-all"
//             />
//           </div>
//           {apiKey && !isValidFormat && (
//             <p className="text-xs text-yellow-400 mt-1.5 flex items-center gap-1">
//               <AlertCircle className="w-3 h-3" />
//               This doesn't look like a valid Gemini API key (should start with "AIza…")
//             </p>
//           )}
//           <p className="text-xs text-text-dim mt-2">
//             Your key is stored locally in your browser only — it is never sent to our servers.
//           </p>
//         </div>

//         <div className="flex items-center gap-3 pt-1">
//           <button
//             onClick={handleSave}
//             className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-bg transition-all hover:scale-[1.02] active:scale-[0.98]"
//             style={{ background: 'linear-gradient(135deg, #6ee7f7, #a78bfa)' }}
//           >
//             <Save className="w-4 h-4" />
//             Save Key
//           </button>

//           {hasKey && (
//             <button
//               onClick={handleClear}
//               className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
//             >
//               <Trash2 className="w-3.5 h-3.5" />
//               Clear
//             </button>
//           )}

//           {saved && (
//             <motion.span
//               initial={{ opacity: 0, x: -10 }}
//               animate={{ opacity: 1, x: 0 }}
//               className="flex items-center gap-1.5 text-xs font-semibold text-green-400"
//             >
//               <CheckCircle2 className="w-4 h-4" />
//               Saved successfully
//             </motion.span>
//           )}
//         </div>
//       </div>

//       {/* How to get a key */}
//       <div className="p-5 rounded-xl bg-accent/5 border border-accent/20 flex gap-3">
//         <AlertCircle className="w-5 h-5 text-accent shrink-0" />
//         <div className="text-sm">
//           <p className="font-semibold text-text-main mb-2">How to get a free API key (30 seconds)</p>
//           <ol className="list-decimal pl-4 space-y-1.5 text-text-dim text-xs">
//             <li>
//               Go to{' '}
//               <a
//                 href="https://aistudio.google.com/app/apikey"
//                 target="_blank"
//                 rel="noreferrer"
//                 className="text-accent hover:underline inline-flex items-center gap-1"
//               >
//                 Google AI Studio <ExternalLink className="w-3 h-3" />
//               </a>
//             </li>
//             <li>Sign in with your Google account</li>
//             <li>Click <strong className="text-text-main">"Create API key"</strong></li>
//             <li>Copy the key (starts with <code className="text-accent">AIza…</code>) and paste it above</li>
//             <li>Click <strong className="text-text-main">"Save Key"</strong></li>
//           </ol>
//           <p className="mt-3 text-text-dim/60 text-[11px]">
//             The free tier is generous — 1 500 000 tokens/day and 15 requests/minute, more than enough for personal use.
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// }



import React, { useState, useEffect } from 'react';
import { Key, Save, CheckCircle2, AlertCircle, ExternalLink, Trash2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

export function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('TYPEDDOC_MISTRAL_API_KEY');
    if (stored) {
      setApiKey(stored);
      setHasKey(true);
    }
  }, []);

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem('TYPEDDOC_MISTRAL_API_KEY', trimmed);
      setHasKey(true);
    } else {
      localStorage.removeItem('TYPEDDOC_MISTRAL_API_KEY');
      setHasKey(false);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClear = () => {
    localStorage.removeItem('TYPEDDOC_MISTRAL_API_KEY');
    setApiKey('');
    setHasKey(false);
    setSaved(false);
  };

  // Mistral keys are long random strings, at least 32 chars
  const isValidFormat = apiKey.trim().length >= 32;

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">

      {/* Powered by badge */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-accent/10 to-accent2/10 border border-accent/20">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">M</div>
        <div>
          <p className="text-sm font-semibold text-text-main">Powered by Mistral OCR 3</p>
          <p className="text-xs text-text-dim">Purpose-built for documents · 88.9% handwriting accuracy · $1–2 per 1,000 pages</p>
        </div>
      </div>

      {/* No key warning */}
      {!hasKey && (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-300 mb-0.5">API key required to convert documents</p>
            <p className="text-yellow-200/70 text-xs">Get a free key from Mistral in under a minute — new accounts get free trial credits.</p>
          </div>
        </div>
      )}

      {/* Key input */}
      <div className="p-6 rounded-2xl glass border border-border space-y-5">
        <div>
          <label className="block text-sm font-semibold text-text-main mb-2 flex items-center gap-2">
            <Key className="w-4 h-4 text-accent" />
            Mistral API Key
            {hasKey && (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-400 font-normal">
                <CheckCircle2 className="w-3.5 h-3.5" /> Key saved
              </span>
            )}
          </label>

          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Paste your Mistral API key here…"
              className="w-full pl-10 pr-10 py-3 rounded-xl bg-surface/50 border border-border text-sm text-text-main placeholder:text-text-dim focus:border-accent/50 focus:outline-none transition-all font-mono"
            />
            <button
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main transition-colors"
              tabIndex={-1}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {apiKey && !isValidFormat && (
            <p className="text-xs text-yellow-400 mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Key looks too short — make sure you copied it fully
            </p>
          )}
          {apiKey && isValidFormat && (
            <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Key format looks correct
            </p>
          )}
          <p className="text-xs text-text-dim mt-2">Stored locally in your browser only — never sent to our servers.</p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-bg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #6ee7f7, #a78bfa)' }}
          >
            <Save className="w-4 h-4" />
            Save Key
          </button>

          {hasKey && (
            <button
              onClick={handleClear}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}

          {saved && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1.5 text-xs font-semibold text-green-400"
            >
              <CheckCircle2 className="w-4 h-4" /> Saved!
            </motion.span>
          )}
        </div>
      </div>

      {/* How to get a key */}
      <div className="p-5 rounded-xl bg-accent/5 border border-accent/20 flex gap-3">
        <AlertCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <div className="text-sm w-full">
          <p className="font-semibold text-text-main mb-3">How to get a Mistral API key (1 minute)</p>
          <ol className="list-decimal pl-4 space-y-1.5 text-text-dim text-xs">
            <li>Go to <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">console.mistral.ai/api-keys <ExternalLink className="w-3 h-3" /></a></li>
            <li>Create a free account (Google / GitHub login supported)</li>
            <li>Click <strong className="text-text-main">"Create new key"</strong></li>
            <li>Copy the key and paste it above, then click <strong className="text-text-main">"Save Key"</strong></li>
          </ol>

          {/* Pricing table */}
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded-lg bg-surface/50">
              <p className="text-accent font-bold text-sm">$2</p>
              <p className="text-text-dim text-[10px] mt-0.5">per 1,000 pages</p>
            </div>
            <div className="p-2 rounded-lg bg-surface/50">
              <p className="text-accent font-bold text-sm">$1</p>
              <p className="text-text-dim text-[10px] mt-0.5">batch (async)</p>
            </div>
            <div className="p-2 rounded-lg bg-surface/50">
              <p className="text-accent font-bold text-sm">~FREE</p>
              <p className="text-text-dim text-[10px] mt-0.5">trial credits</p>
            </div>
          </div>
          <p className="text-text-dim/50 text-[10px] mt-2 text-center">
            A 30-page PDF costs ~₹0.05 — 13× cheaper than GPT-4o
          </p>
        </div>
      </div>

    </div>
  );
}

