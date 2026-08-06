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
    pending:    { label: 'QUEUED',     icon: Clock,         color: 'text-text-dim',  bg: 'bg-white/5' },
    converting: { label: 'PROCESSING', icon: Loader2,       color: 'text-accent2',   bg: 'bg-accent2/10' },
    completed:  { label: 'DONE',       icon: CheckCircle2,  color: 'text-accent3',   bg: 'bg-accent3/10' },
    failed:     { label: 'ERROR',      icon: AlertCircle,   color: 'text-accent',    bg: 'bg-accent/10' },
  };

  return (
    <div className="space-y-10">
      {/* Drop zone */}
      <div {...getRootProps()} className={cn(
        "relative rounded-[2.5rem] border-2 border-dashed p-16 sm:p-24 text-center cursor-pointer transition-all duration-500 overflow-hidden group",
        isDragActive ? "border-accent/60 bg-accent/5 scale-[0.98]" : "border-white/5 glass hover:border-accent/30"
      )}>
        <input {...getInputProps()} />

        {/* Dynamic Mesh for Dragging */}
        <AnimatePresence>
          {isDragActive && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="absolute inset-0 bg-gradient-to-br from-accent/10 via-accent2/5 to-accent3/10 animate-pulse" />
          )}
        </AnimatePresence>

        <div className="relative z-10 flex flex-col items-center">
          <motion.div animate={isDragActive ? { scale: 1.2, rotate: 10 } : { scale: 1, rotate: 0 }}
            className={cn("w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500",
              isDragActive ? "glass-bright border-accent/40 shadow-[0_0_30px_rgba(255,62,141,0.2)]" : "glass border-white/10 group-hover:border-accent/40")}>
            <Upload className={cn("w-8 h-8 transition-colors duration-500", isDragActive ? "text-accent" : "text-text-dim group-hover:text-accent")} />
          </motion.div>

          <h3 className="text-2xl font-display font-black text-white mb-3 uppercase tracking-tight">
            {isDragActive ? "RELEASE TO CONVERT" : "READY FOR DIGITIZATION"}
          </h3>
          <p className="text-sm text-text-dim max-w-sm font-bold leading-relaxed">
            Drag your handwritten PDFs or images into this prism. Our AI engine will extract every detail.
          </p>

          <div className="flex gap-3 mt-8">
            {['PDF', 'IMG'].map(f => (
              <span key={f} className="px-3 py-1 rounded-xl text-[10px] font-black text-text-dim border border-white/5 glass uppercase tracking-widest">
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
            <h4 className="text-[10px] font-black text-text-dim uppercase tracking-[0.3em] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-accent" /> SYSTEM FEED
            </h4>
            <div className="flex gap-4">
              {processing > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent2 animate-pulse" />
                  <span className="text-[10px] font-black text-accent2 uppercase">{processing} ACTIVE</span>
                </div>
              )}
              <span className="text-[10px] font-black text-text-dim uppercase">{completed}/{total} SYNCED</span>
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
                    className="glass-card p-5 flex items-center gap-5 group">
                    
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-white/5 transition-colors", cfg.bg)}>
                      <TypeIcon className={cn("w-5 h-5", cfg.color)} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate uppercase tracking-tight">{job.file.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-bold text-text-dim">{(job.file.size / 1024 / 1024).toFixed(2)} MB</span>
                        {job.status === 'failed' && <span className="text-[10px] font-bold text-accent uppercase tracking-tighter">{job.error}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black tracking-widest border border-white/5", cfg.bg, cfg.color)}>
                        <StatusIcon className={cn("w-3 h-3", job.status === 'converting' && "animate-spin")} />
                        {cfg.label}
                      </div>

                      {job.status === 'completed' && job.content && (
                        <button onClick={() => exportToPdf(job.file.name.replace(/\.[^/.]+$/, ''), job.content)}
                          className="btn-glass p-2.5 rounded-xl hover:text-accent border-white/5">
                          <Download className="w-4 h-4" />
                        </button>
                      )}

                      {job.status === 'failed' && (
                        <button onClick={() => onFilesAdded([job.file])} className="btn-glass p-2.5 rounded-xl hover:text-accent2">
                          <RotateCw className="w-4 h-4" />
                        </button>
                      )}

                      <button onClick={() => onRemoveJob(job.id)} className="p-2 rounded-xl text-text-dim hover:text-white transition-colors">
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
