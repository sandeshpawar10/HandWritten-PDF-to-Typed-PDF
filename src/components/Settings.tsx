import React, { useState, useEffect } from 'react';
import { Key, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('TYPEDDOC_GEMINI_API_KEY');
    if (stored) setApiKey(stored);
  }, []);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('TYPEDDOC_GEMINI_API_KEY', apiKey.trim());
    } else {
      localStorage.removeItem('TYPEDDOC_GEMINI_API_KEY');
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-display font-bold text-text-main tracking-tight flex items-center gap-2">
          <Key className="w-6 h-6 text-accent" />
          API Configuration
        </h2>
        <p className="text-sm text-text-dim mt-2">
          TypedDoc uses Gemini 2.0 Flash to convert your handwritten documents. If you are experiencing "API rate limit" errors, you can provide your own free Gemini API key below.
        </p>
      </div>

      <div className="p-6 rounded-2xl glass border border-border space-y-6">
        <div>
          <label className="block text-sm font-semibold text-text-main mb-2">
            Your Gemini API Key
          </label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface/50 border border-border text-sm text-text-main placeholder:text-text-dim focus:border-accent/50 focus:outline-none transition-all"
            />
          </div>
          <p className="text-xs text-text-dim mt-3">
            Get a free API key from Google AI Studio. Your key is stored locally in your browser and is never sent to our servers.
          </p>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-bg transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #6ee7f7, #a78bfa)' }}
          >
            <Save className="w-4 h-4" />
            Save Key
          </button>
          
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1.5 text-xs font-semibold text-accent3"
            >
              <CheckCircle2 className="w-4 h-4" />
              Saved successfully
            </motion.span>
          )}
        </div>
      </div>

      <div className="mt-8 p-5 rounded-xl bg-accent/5 border border-accent/20 flex gap-3">
        <AlertCircle className="w-5 h-5 text-accent shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-text-main mb-1">How to get an API key</p>
          <ol className="list-decimal pl-4 space-y-1 text-text-dim text-xs">
            <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-accent hover:underline">Google AI Studio</a></li>
            <li>Sign in with your Google account</li>
            <li>Click "Create API key"</li>
            <li>Copy the key and paste it here</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
