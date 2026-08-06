import { useState } from 'react';
import { FileText, FileImage, ChevronRight, Trash2, Table2, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { deleteDocument } from '../services/documents';

export function DocumentList({ documents, onSelect }) {
  const [sortBy, setSortBy] = useState('date');

  const handleDelete = async (e, id) => {
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
        <div className="w-20 h-20 rounded-3xl bg-[#FFFBF5] border border-[#E8DFD0] flex items-center justify-center mb-8 border-[#8B5E3C]/20">
          <BookOpen className="w-8 h-8 text-[#8C7B6B]" />
        </div>
        <h3 className="text-xl font-serif font-black text-[#3D2E1C] mb-2">No documents yet</h3>
        <p className="text-sm text-[#8C7B6B] max-w-xs font-bold">
          Upload your handwritten notes to get started.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Sort controls */}
      <div className="flex items-center gap-3 justify-end">
        <span className="text-[10px] font-bold text-[#8C7B6B] uppercase tracking-[0.2em] mr-2">Sort By</span>
        <div className="flex items-center p-1 rounded-2xl bg-[#FFFBF5] border border-[#E8DFD0]">
          {['date', 'name', 'words'].map(key => (
            <button key={key} onClick={() => setSortBy(key)}
              className={cn("px-4 py-1.5 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider",
                sortBy === key ? "bg-[#8B5E3C]/10 text-[#8B5E3C]" : "text-[#8C7B6B] hover:text-[#3D2E1C]")}>
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
              onClick={() => onSelect(doc)} className="bg-[#FFFBF5] border border-[#E8DFD0] rounded-2xl shadow-sm hover:shadow-md hover:border-[#D4C9B8] transition-all duration-300 cursor-pointer p-6 group relative overflow-hidden">
              
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-[#8B5E3C]/5 border border-[#8B5E3C]/10 flex items-center justify-center group-hover:border-[#8B5E3C]/30 transition-colors">
                  <TypeIcon className="w-5 h-5 text-[#8B5E3C]" />
                </div>
                <button onClick={e => handleDelete(e, doc.id)} className="p-2 rounded-xl text-[#8C7B6B] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <h4 className="font-serif font-black text-lg text-[#3D2E1C] mb-2 truncate pr-2 group-hover:text-[#8B5E3C] transition-colors">
                {doc.title || 'Untitled Asset'}
              </h4>

              <p className="text-[13px] text-[#8C7B6B] line-clamp-2 leading-relaxed mb-6 font-medium">
                {doc.content.slice(0, 100).replace(/[#*_|`>-]/g, '')}...
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-[#E8DFD0]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-[#8B5E3C] opacity-60">{ext}</span>
                  <span className="text-[10px] font-bold text-[#8C7B6B]">{wordCount} words</span>
                  {hasTable && <Table2 className="w-3 h-3 text-[#C4853C] opacity-60" />}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-[#8C7B6B]">
                  {date && date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  <ChevronRight className="w-3 h-3 text-[#8B5E3C] group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
