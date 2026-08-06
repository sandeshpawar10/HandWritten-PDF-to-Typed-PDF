import { Sparkles, Zap, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';


export function Settings() {
  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8 pb-20">
      
      {/* Header */}
      <div className="space-y-2 mb-10">
        <h3 className="text-3xl font-serif font-black text-[#3D2E1C] tracking-tight">Settings</h3>
        <p className="text-sm text-[#8C7B6B] font-bold tracking-wide">App configuration</p>
      </div>

      {/* Powered by Prism Engine */}
      <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}}
        className="bg-[#FFFBF5] border border-[#E8DFD0] rounded-2xl shadow-sm p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Zap className="w-16 h-16 text-[#8B5E3C]" />
        </div>
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#FFFBF5] border border-[#E8DFD0] flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-[#8B5E3C]" />
          </div>
          <div>
            <h4 className="text-lg font-serif font-black text-[#3D2E1C] tracking-tight">Mistral OCR v3</h4>
            <p className="text-xs text-[#8B5E3C] font-bold tracking-widest">Active Transcription Engine</p>
          </div>
        </div>
        
        <p className="text-sm text-[#6B5D4F] leading-relaxed font-medium mb-6 max-w-xl">
          TypedDoc is powered by Mistral's specialized document vision model. It offers 88.9% accuracy for complex handwriting, tables, and multi-page flows.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: ShieldCheck, label: 'End-to-End Encryption' },
            { icon: Zap, label: 'Real-time Processing' },
            { icon: Sparkles, label: 'AI Powered' }
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] font-black text-[#8C7B6B] tracking-wider">
              <item.icon className="w-3.5 h-3.5 text-[#8B5E3C]" />
              {item.label}
            </div>
          ))}
        </div>
      </motion.div>

    </div>
  );
}
