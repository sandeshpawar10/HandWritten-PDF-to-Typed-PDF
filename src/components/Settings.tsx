import React, { useState, useEffect } from 'react';
import { Key, Save, CheckCircle2, AlertCircle, ExternalLink, Trash2, Eye, EyeOff, Sparkles, Zap, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';


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

  const isValidFormat = apiKey.trim().length >= 32;

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8 pb-20">
      
      {/* Header */}
      <div className="space-y-2 mb-10">
        <h3 className="text-3xl font-display font-black text-white uppercase tracking-tight">Configuration</h3>
        <p className="text-sm text-text-dim font-bold tracking-wide">SYSTEM PARAMETERS & API ACCESS</p>
      </div>

      {/* Powered by Prism Engine */}
      <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}}
        className="glass-card p-8 bg-gradient-to-br from-accent/5 via-accent2/5 to-transparent border-accent/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Zap className="w-16 h-16 text-accent" />
        </div>
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl glass-bright flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h4 className="text-lg font-display font-black text-white uppercase tracking-tight">Mistral OCR v3</h4>
            <p className="text-xs text-accent font-bold tracking-widest uppercase">Active Transcription Engine</p>
          </div>
        </div>
        
        <p className="text-sm text-text-mid leading-relaxed font-medium mb-6 max-w-xl">
          TypedDoc is powered by Mistral's specialized document vision model. It offers 88.9% accuracy for complex handwriting, tables, and multi-page flows.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: ShieldCheck, label: 'End-to-End Encryption' },
            { icon: Zap, label: 'Real-time Processing' },
            { icon: Key, label: 'Local Key Storage' }
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] font-black text-text-dim uppercase tracking-wider">
              <item.icon className="w-3.5 h-3.5 text-accent/60" />
              {item.label}
            </div>
          ))}
        </div>
      </motion.div>

      {/* API Key Input */}
      <div className="glass-card p-8 space-y-8">
        <div>
          <label className="block text-[10px] font-black text-text-dim uppercase tracking-[0.2em] mb-4">
            Mistral API Access Token
          </label>
          
          <div className="relative group">
            <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim group-focus-within:text-accent transition-colors" />
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Paste token here..."
              className="w-full pl-12 pr-12 py-4 rounded-2xl glass border-white/5 text-sm text-white placeholder:text-text-dim focus:border-accent/40 focus:ring-0 transition-all font-mono outline-none"
            />
            <button
              onClick={() => setShowKey(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-dim hover:text-white transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-[10px] text-text-dim font-bold uppercase tracking-tight">
              Stored locally. Never leaves your hardware.
            </p>
            {apiKey && (
              <span className={cn("text-[10px] font-black uppercase tracking-widest", isValidFormat ? "text-accent3" : "text-accent")}>
                {isValidFormat ? "✓ VALID FORMAT" : "⚠ INCOMPLETE TOKEN"}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button onClick={handleSave} disabled={!apiKey.trim()} className="btn-primary px-8 h-12 text-xs">
            <Save className="w-4 h-4 mr-2" /> Save Configuration
          </button>

          {hasKey && (
            <button onClick={handleClear} className="btn-glass h-12 px-6 flex items-center gap-2 text-red-400 hover:text-red-300">
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          )}

          <AnimatePresence>
            {saved && (
              <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-[10px] font-black text-accent3 uppercase tracking-widest">
                <CheckCircle2 className="w-4 h-4" /> SYNCED
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Guide */}
      <div className="glass-card p-8 border-white/5">
        <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-accent" /> Authentication Guide
        </h4>
        <ol className="space-y-4">
          {[
            { step: '01', text: 'Navigate to Mistral Console API dashboard.', link: 'https://console.mistral.ai/api-keys' },
            { step: '02', text: 'Generate a new secure access token.', link: null },
            { step: '03', text: 'Apply the token to the Prism configuration above.', link: null }
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="font-display font-black text-lg text-accent/40">{item.step}</span>
              <p className="text-sm text-text-mid font-medium pt-1">
                {item.text}
                {item.link && (
                  <a href={item.link} target="_blank" rel="noreferrer" className="text-accent ml-2 hover:underline inline-flex items-center gap-1 uppercase text-[10px] font-black">
                    Go to Console <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </p>
            </li>
          ))}
        </ol>
      </div>

    </div>
  );
}
