import React, { useState } from 'react';
import { FileText, FileImage, ChevronRight, Trash2, Clock, ArrowUpDown, Table2, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import { Document } from '../types';
import { deleteDocument } from '../services/documents';
import { cn } from '../lib/utils';

interface DocumentListProps {
  documents: Document[];
  onSelect: (doc: Document) => void;
  selectedId?: string;
}

type SortKey = 'date' | 'name' | 'words';

export function DocumentList({ documents, onSelect, selectedId }: DocumentListProps) {
  const [sortBy, setSortBy] = useState<SortKey>('date');

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this asset permanently?')) await deleteDocument(id);
  };

  const sorted = [...documents].sort((a, b) => {
    if (sortBy === 'name') return a.title.localeCompare(b.title);
    if (sortBy === 'words') {
      const wA = a.content.trim().split(/\s+/).length;
      const wB = b.content.trim().split(/\s+/).length;
      return wB - wA;
    }
    return 0;
  });

  if (documents.length === 0) {
    return (
      <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-20 h-20 rounded-3xl glass flex items-center justify-center mb-8 border-accent/20">
          <Layers className="w-8 h-8 text-text-dim" />
        </div>
        <h3 className="text-xl font-display font-black text-white mb-2 uppercase tracking-tight">Archive Empty</h3>
        <p className="text-sm text-text-dim max-w-xs font-bold">
          No assets detected. Switch to Converter to digitize your handwriting.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Sort controls */}
      <div className="flex items-center gap-3 justify-end">
        <span className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] mr-2">Sort By</span>
        <div className="flex items-center p-1 rounded-2xl glass border-white/5">
          {(['date', 'name', 'words'] as SortKey[]).map(key => (
            <button key={key} onClick={() => setSortBy(key)}
              className={cn("px-4 py-1.5 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider",
                sortBy === key ? "bg-accent/10 text-accent" : "text-text-dim hover:text-white")}>
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sorted.map((doc, i) => {
          const ext = doc.originalFileName?.split('.').pop()?.toLowerCase() || 'doc';
          const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
          const TypeIcon = isImage ? FileImage : FileText;
          const wordCount = doc.content.trim() ? doc.content.trim().split(/\s+/).length : 0;
          const date = doc.updatedAt?.toDate?.();
          const hasTable = doc.content.includes('|---') || doc.content.includes('| ---');

          return (
            <motion.div key={doc.id} initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay: i * 0.05, ease:[0.16,1,0.3,1]}}
              onClick={() => onSelect(doc)} className="glass-card p-6 cursor-pointer group relative overflow-hidden">
              
              {/* Highlight bar */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-accent/5 border border-accent/10 flex items-center justify-center group-hover:border-accent/30 transition-colors">
                  <TypeIcon className="w-5 h-5 text-accent" />
                </div>
                <button onClick={e => handleDelete(e, doc.id)} className="p-2 rounded-xl text-text-dim hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <h4 className="font-display font-black text-lg text-white mb-2 truncate pr-2 group-hover:text-accent transition-colors uppercase tracking-tight">
                {doc.title || 'Untitled Asset'}
              </h4>

              <p className="text-[13px] text-text-dim line-clamp-2 leading-relaxed mb-6 font-medium">
                {doc.content.slice(0, 100).replace(/[#*_|`>-]/g, '')}...
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-accent opacity-60 uppercase">{ext}</span>
                  <span className="text-[10px] font-bold text-text-dim uppercase tracking-tighter">{wordCount} WORDS</span>
                  {hasTable && <Table2 className="w-3 h-3 text-accent2 opacity-60" />}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-text-dim uppercase">
                  {date && date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  <ChevronRight className="w-3 h-3 text-accent group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
