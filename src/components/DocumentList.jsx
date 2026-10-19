import { useState } from 'react';
import { FileText, FileImage, ChevronRight, Table2, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { deleteDocument } from '../services/documents';
import { toast } from './Toast';
import { DeleteButton } from './rare';
import { addNotification } from '../lib/notifications';

export function DocumentList({ documents, onSelect }) {
  const [sortBy, setSortBy] = useState('date');

  const handleDelete = async (id, title) => {
    try {
      await deleteDocument(id);
      addNotification({
        title: 'Document deleted',
        message: `"${title || 'Untitled Document'}" was removed.`,
        type: 'info'
      });
      toast.success('Document deleted');
    } catch (err) {
      console.error('Delete document error:', err);
      toast.error('Failed to delete document');
      throw err;
    }
  };

  const sorted = [...documents].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.title || '').localeCompare(b.title || '');
      case 'words': {
        const wA = (a.content || '').trim() ? (a.content || '').trim().split(/\s+/).length : 0;
        const wB = (b.content || '').trim() ? (b.content || '').trim().split(/\s+/).length : 0;
        return wB - wA;
      }
      case 'date':
        return (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0);
      default:
        return 0;
    }
  });

  if (documents.length === 0) {
    return (
      <motion.div initial={{opacity:0, y: 20}} animate={{opacity:1, y: 0}} className="flex flex-col items-center justify-center py-32 text-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1], rotate: [0, 5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-white/80 to-[#FFFBF5]/80 backdrop-blur-sm border border-[#E8DFD0] flex items-center justify-center mb-8 shadow-lg"
        >
          <BookOpen className="w-10 h-10 text-[#8B5E3C]" />
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#8B5E3C]/0 to-[#8B5E3C]/10" />
        </motion.div>
        <h3 className="text-2xl font-serif font-black text-[#3D2E1C] mb-3">No documents yet</h3>
        <p className="text-sm text-[#8C7B6B] max-w-xs font-medium leading-relaxed">
          Upload your handwritten notes to get started and see them transform into beautiful typed documents.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Sort controls */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 justify-end"
      >
        <span className="text-[10px] font-bold text-[#8C7B6B] uppercase tracking-[0.2em] mr-2">Sort By</span>
        <div className="flex items-center p-1.5 rounded-2xl bg-white/80 backdrop-blur-sm border border-[#E8DFD0] shadow-md">
          {['date', 'name', 'words'].map(key => (
            <motion.button
              key={key}
              onClick={() => setSortBy(key)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn("px-4 py-2 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider relative",
                sortBy === key ? "bg-gradient-to-r from-[#8B5E3C]/10 to-[#C4853C]/10 text-[#8B5E3C] shadow-sm" : "text-[#8C7B6B] hover:text-[#3D2E1C]")}
            >
              {key}
              {sortBy === key && (
                <motion.div
                  layoutId="activeSortTab"
                  className="absolute inset-0 bg-gradient-to-r from-[#8B5E3C]/5 to-[#C4853C]/5 rounded-xl -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sorted.map((doc, i) => {
          const ext = doc.originalFileName?.split('.').pop()?.toLowerCase() || 'doc';
          const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
          const TypeIcon = isImage ? FileImage : FileText;
          const content = doc.content || '';
          const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
          const date = doc.updatedAt?.toDate?.();
          const hasTable = content.includes('|---') || content.includes('| ---');

          return (
            <motion.div
              key={doc.id}
              initial={{opacity:0, y:20, scale: 0.95}}
              animate={{opacity:1, y:0, scale: 1}}
              transition={{delay: i * 0.05, ease:[0.16,1,0.3,1], duration: 0.5}}
              whileHover={{ y: -4, scale: 1.02 }}
              onClick={() => onSelect(doc)}
              className="glass-card cursor-pointer p-6 group relative"
            >
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#8B5E3C]/0 via-transparent to-[#C4853C]/0 group-hover:from-[#8B5E3C]/5 group-hover:to-[#C4853C]/5 rounded-2xl transition-all duration-500 pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B5E3C]/10 to-[#C4853C]/10 border border-[#8B5E3C]/20 flex items-center justify-center group-hover:border-[#8B5E3C]/40 group-hover:shadow-lg transition-all"
                  >
                    <TypeIcon className="w-6 h-6 text-[#8B5E3C]" />
                  </motion.div>
                  <DeleteButton
                    onConfirm={() => handleDelete(doc.id, doc.title)}
                    aria-label={`Delete ${doc.title || 'document'}`}
                    className="opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>

                <h4 className="font-serif font-black text-xl text-[#3D2E1C] mb-3 truncate pr-2 group-hover:text-[#8B5E3C] transition-colors">
                  {doc.title || 'Untitled Document'}
                </h4>

                <p className="text-[13px] text-[#8C7B6B] line-clamp-2 leading-relaxed mb-6 font-medium group-hover:text-[#6B5D4F] transition-colors">
                  {(doc.content || '').slice(0, 120).replace(/[#*_|`>-]/g, '')}...
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-[#E8DFD0] group-hover:border-[#D4C9B8] transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-1 rounded-lg text-[9px] font-black text-[#8B5E3C] bg-[#8B5E3C]/10 uppercase tracking-wider">{ext}</span>
                    <span className="text-[11px] font-bold text-[#8C7B6B] flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-[#8C7B6B]" />
                      {wordCount.toLocaleString()} words
                    </span>
                    {hasTable && (
                      <div className="flex items-center gap-1 text-[#C4853C]">
                        <Table2 className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#8C7B6B]">
                    {date && date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    <ChevronRight className="w-4 h-4 text-[#8B5E3C] group-hover:translate-x-1 transition-transform" />
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
