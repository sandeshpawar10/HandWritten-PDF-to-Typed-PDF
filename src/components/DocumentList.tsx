import React, { useState } from 'react';
import { FileText, FileImage, ChevronRight, Trash2, Clock, ArrowUpDown } from 'lucide-react';
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
    if (confirm('Delete this document permanently?')) await deleteDocument(id);
  };

  const sorted = [...documents].sort((a, b) => {
    if (sortBy === 'name') return a.title.localeCompare(b.title);
    if (sortBy === 'words') {
      const wA = a.content.trim().split(/\s+/).length;
      const wB = b.content.trim().split(/\s+/).length;
      return wB - wA;
    }
    // date (default) — newest first, handled by Firestore orderBy
    return 0;
  });

  if (documents.length === 0) {
    return (
      <motion.div initial={{opacity:0}} animate={{opacity:1}}
        className="flex flex-col items-center justify-center py-24 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-5">
          <FileText className="w-7 h-7 text-text-dim" />
        </div>
        <h3 className="text-base font-display font-semibold text-text-main mb-2">No documents yet</h3>
        <p className="text-sm text-text-dim max-w-xs">
          Upload a handwritten PDF or image to get started.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sort controls */}
      <div className="flex items-center gap-2 justify-end">
        <ArrowUpDown className="w-3 h-3 text-text-dim" />
        {(['date', 'name', 'words'] as SortKey[]).map(key => (
          <button key={key} onClick={() => setSortBy(key)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all capitalize",
              sortBy === key
                ? "bg-accent/10 text-accent border border-accent/20"
                : "text-text-dim hover:text-text-main hover:bg-surface border border-transparent"
            )}>
            {key}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((doc, i) => {
          const ext = doc.originalFileName?.split('.').pop()?.toLowerCase() || 'doc';
          const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
          const TypeIcon = isImage ? FileImage : FileText;
          const wordCount = doc.content.trim() ? doc.content.trim().split(/\s+/).length : 0;
          const date = doc.updatedAt?.toDate?.();
          const hasTable = doc.content.includes('|---') || doc.content.includes('| ---');

          return (
            <motion.div
              key={doc.id}
              initial={{opacity:0, y:12}}
              animate={{opacity:1, y:0}}
              transition={{delay: i * 0.05, ease:[0.16,1,0.3,1]}}
              onClick={() => onSelect(doc)}
              className="group relative rounded-2xl glass border border-border hover:border-accent/30 p-5 cursor-pointer transition-all duration-300 hover:bg-surface/60 overflow-hidden"
            >
              {/* Hover glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent/3 to-accent2/3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />

              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/10 to-accent2/10 border border-accent/20 flex items-center justify-center">
                    <TypeIcon className="w-4 h-4 text-accent" />
                  </div>
                  <button
                    onClick={e => handleDelete(e, doc.id)}
                    className="p-1.5 rounded-lg text-text-dim hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Title */}
                <h4 className="font-display font-semibold text-sm text-text-main mb-1 truncate pr-2 group-hover:text-accent transition-colors">
                  {doc.title || 'Untitled Document'}
                </h4>

                {/* Preview */}
                <p className="text-[12px] text-text-dim line-clamp-2 leading-relaxed mb-4">
                  {doc.content.slice(0, 120).replace(/[#*_|`>-]/g, '')}...
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium text-accent bg-accent/10 border border-accent/20">
                      {ext.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-text-dim font-mono">{wordCount} words</span>
                    {hasTable && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-medium text-accent2 bg-accent2/10 border border-accent2/20">
                        TABLE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
                    {date && (
                      <>
                        <Clock className="w-3 h-3" />
                        {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-accent opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
