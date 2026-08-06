import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileImage, FileText, Loader2, X, Download, AlertCircle, CheckCircle2, Clock, RotateCw, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { exportToPdf } from '../services/export';

function getFileIcon(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return FileText;
  return FileImage;
}

export function FileUpload({ onFilesAdded, jobs, onRemoveJob }) {
  const onDrop = useCallback((files) => onFilesAdded(files), [onFilesAdded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    multiple: true,
  });

  const completed = jobs.filter(j => j.status === 'completed').length;
  const processing = jobs.filter(j => j.status === 'converting' || j.status === 'pending').length;
  const total = jobs.length;

  const statusConfig = {
    pending:    { label: 'Queued',     icon: Clock,         color: 'text-[#8C7B6B]',  bg: 'bg-[#8C7B6B]/10' },
    converting: { label: 'Processing', icon: Loader2,       color: 'text-[#C4853C]',  bg: 'bg-[#C4853C]/10' },
    completed:  { label: 'Done',       icon: CheckCircle2,  color: 'text-[#5B8C5A]',  bg: 'bg-[#5B8C5A]/10' },
    failed:     { label: 'Error',      icon: AlertCircle,   color: 'text-[#C25B4E]',  bg: 'bg-[#C25B4E]/10' },
  };

  return (
    <div className="space-y-10">
      {/* Drop zone */}
      <div {...getRootProps()} className={cn(
        "relative rounded-[2.5rem] border-2 border-dashed p-16 sm:p-24 text-center cursor-pointer transition-all duration-500 overflow-hidden group",
        isDragActive ? "border-[#C4853C] bg-[#8B5E3C]/5 scale-[0.98]" : "border-[#E8DFD0] bg-[#FFFBF5] hover:border-[#C4853C]/30"
      )}>
        <input {...getInputProps()} />

        {/* Dynamic Mesh for Dragging */}
        <AnimatePresence>
          {isDragActive && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="absolute inset-0 bg-gradient-to-br from-[#8B5E3C]/10 via-[#C4853C]/5 to-[#5B8C5A]/10 animate-pulse" />
          )}
        </AnimatePresence>

        <div className="relative z-10 flex flex-col items-center">
          <motion.div animate={isDragActive ? { scale: 1.2, rotate: 10 } : { scale: 1, rotate: 0 }}
            className={cn("w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500",
              isDragActive ? "bg-[#FFFBF5] border border-[#C4853C] shadow-[0_0_30px_rgba(196,133,60,0.2)]" : "bg-[#FFFBF5] border border-[#E8DFD0] group-hover:border-[#C4853C]/40")}>
            <Upload className={cn("w-8 h-8 transition-colors duration-500", isDragActive ? "text-[#8B5E3C]" : "text-[#8C7B6B] group-hover:text-[#8B5E3C]")} />
          </motion.div>

          <h3 className="text-xl font-display font-bold text-[#3D2E1C] mb-2">
            {isDragActive ? "Drop to convert" : "Drop your handwritten notes here"}
          </h3>
          <p className="text-sm text-[#8C7B6B] max-w-sm">
            Supports PDF and image files
          </p>

          <div className="flex gap-3 mt-8">
            {['PDF', 'IMG'].map(f => (
              <span key={f} className="px-3 py-1 rounded-xl text-[10px] font-bold text-[#8C7B6B] border border-[#E8DFD0] bg-[#FFFBF5]">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Conversion Feed */}
      {total > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-xs font-bold text-[#8C7B6B] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#8B5E3C]" /> Conversion Progress
            </h4>
            <div className="flex gap-4">
              {processing > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C4853C] animate-pulse" />
                  <span className="text-xs font-bold text-[#C4853C]">{processing} active</span>
                </div>
              )}
              <span className="text-xs font-bold text-[#8C7B6B]">{completed}/{total} completed</span>
            </div>
          </div>

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {jobs.map((job, i) => {
                const cfg = statusConfig[job.status];
                const StatusIcon = cfg.icon;
                const TypeIcon = getFileIcon(job.file.name);
                return (
                  <motion.div key={job.id} initial={{opacity:0, x:-20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:20}}
                    className="bg-[#FFFBF5] border border-[#E8DFD0] rounded-2xl shadow-sm p-5 flex items-center gap-5 group">
                    
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-[#E8DFD0] transition-colors", cfg.bg)}>
                      <TypeIcon className={cn("w-5 h-5", cfg.color)} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#3D2E1C] truncate">{job.file.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-bold text-[#8C7B6B]">{(job.file.size / 1024 / 1024).toFixed(2)} MB</span>
                        {job.status === 'failed' && <span className="text-[10px] font-bold text-[#C25B4E]">{job.error}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold border border-[#E8DFD0]", cfg.bg, cfg.color)}>
                        <StatusIcon className={cn("w-3 h-3", job.status === 'converting' && "animate-spin")} />
                        {cfg.label}
                      </div>

                      {job.status === 'completed' && job.content && (
                        <button onClick={() => exportToPdf(job.file.name.replace(/\.[^/.]+$/, ''), job.content)}
                          className="btn-glass p-2.5 rounded-xl hover:text-[#8B5E3C] border-[#E8DFD0]">
                          <Download className="w-4 h-4" />
                        </button>
                      )}

                      {job.status === 'failed' && (
                        <button onClick={() => onFilesAdded([job.file])} className="btn-glass p-2.5 rounded-xl hover:text-[#C4853C] border-[#E8DFD0]">
                          <RotateCw className="w-4 h-4" />
                        </button>
                      )}

                      <button onClick={() => onRemoveJob(job.id)} className="p-2 rounded-xl text-[#8C7B6B] hover:text-[#3D2E1C] transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
