import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileImage, FileText, Loader2, X, Download, AlertCircle, CheckCircle2, Clock, RotateCw, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { exportToPdf } from '../services/export';
import { toast } from './Toast';
import { ChunkedProgressBar } from './ChunkedProgressBar';

// File size limits - prevent backend OOM
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILE_SIZE_MB = 20;

function getFileIcon(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return FileText;
  return FileImage;
}

export function FileUpload({ onFilesAdded, jobs, onRemoveJob, processingProgress }) {
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    // Filter out files that are too large
    const validFiles = [];
    const errors = [];

    for (const file of acceptedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push({
          file: file.name,
          error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_FILE_SIZE_MB} MB.`
        });
      } else {
        validFiles.push(file);
      }
    }

    // Handle rejected files (wrong type)
    for (const rejected of rejectedFiles) {
      errors.push({
        file: rejected.file.name,
        error: 'Invalid file type. Only PDF and image files are supported.'
      });
    }

    // Show errors to user
    if (errors.length > 0) {
      errors.forEach(e => {
        toast.error(`${e.file}: ${e.error}`, { duration: 7000 });
      });
    }

    // Process valid files
    if (validFiles.length > 0) {
      onFilesAdded(validFiles);
    }
  }, [onFilesAdded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp']
    },
    multiple: true,
    maxSize: MAX_FILE_SIZE, // 20MB limit
    maxFiles: 10 // Prevent uploading too many files at once
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div {...getRootProps()} className={cn(
          "relative rounded-[2.5rem] border-2 border-dashed p-16 sm:p-24 text-center cursor-pointer overflow-hidden group backdrop-blur-sm",
          isDragActive
            ? "border-[#C4853C] bg-gradient-to-br from-[#8B5E3C]/10 to-[#C4853C]/5 scale-[0.98] shadow-xl"
            : "border-[#E8DFD0] bg-white/60 hover:border-[#C4853C]/40 hover:bg-white/80 shadow-md hover:shadow-lg",
          "transition-all duration-500"
        )}>
          <input {...getInputProps()} />

          {/* Animated gradient overlay for drag state */}
          <AnimatePresence>
            {isDragActive && (
              <>
                <motion.div
                  initial={{opacity:0}}
                  animate={{opacity:1}}
                  exit={{opacity:0}}
                  className="absolute inset-0 bg-gradient-to-br from-[#8B5E3C]/15 via-[#C4853C]/10 to-[#5B8C5A]/15"
                />
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.2, opacity: 0.3 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 bg-gradient-to-br from-[#8B5E3C]/20 to-transparent rounded-[2.5rem] blur-3xl"
                />
              </>
            )}
          </AnimatePresence>

          <div className="relative z-10 flex flex-col items-center">
            <motion.div
              animate={isDragActive ? { scale: 1.3, rotate: 15, y: -5 } : { scale: 1, rotate: 0, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={cn(
                "w-24 h-24 rounded-3xl flex items-center justify-center mb-8 relative",
                isDragActive
                  ? "bg-white border-2 border-[#C4853C] shadow-2xl"
                  : "bg-gradient-to-br from-white to-[#FFFBF5] border border-[#E8DFD0] group-hover:border-[#C4853C]/40 shadow-lg group-hover:shadow-xl",
                "transition-all duration-500"
              )}
            >
              <Upload className={cn(
                "w-9 h-9 transition-all duration-500",
                isDragActive ? "text-[#8B5E3C] scale-110" : "text-[#8C7B6B] group-hover:text-[#8B5E3C] group-hover:scale-110"
              )} />
              {!isDragActive && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#8B5E3C]/0 to-[#8B5E3C]/10"
                />
              )}
            </motion.div>

            <motion.h3
              animate={isDragActive ? { scale: 1.05 } : { scale: 1 }}
              className="text-2xl font-display font-black text-[#3D2E1C] mb-3"
            >
              {isDragActive ? "Drop to convert" : "Drop your handwritten notes"}
            </motion.h3>
            <p className="text-sm text-[#8C7B6B] max-w-sm font-medium leading-relaxed">
              Supports PDF and image files (max {MAX_FILE_SIZE_MB} MB per file)
            </p>

            <div className="flex gap-3 mt-10">
              {[
                { label: 'PDF', icon: FileText },
                { label: 'IMG', icon: FileImage }
              ].map((f, i) => (
                <motion.span
                  key={f.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  className="px-4 py-2 rounded-xl text-[11px] font-bold text-[#8B5E3C] border border-[#E8DFD0] bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-[#8B5E3C]/30 transition-all flex items-center gap-2"
                >
                  <f.icon className="w-3.5 h-3.5" />
                  {f.label}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Conversion Feed */}
      {total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between px-2">
            <h4 className="text-sm font-bold text-[#8C7B6B] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#8B5E3C]" />
              Conversion Progress
            </h4>
            <div className="flex gap-5">
              {processing > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#C4853C]/10 border border-[#C4853C]/20"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-[#C4853C]"
                  />
                  <span className="text-xs font-bold text-[#C4853C]">{processing} active</span>
                </motion.div>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/60 backdrop-blur-sm border border-[#E8DFD0]">
                <span className="text-xs font-bold text-[#8C7B6B]">{completed}/{total} completed</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {jobs.map((job, i) => {
                const cfg = statusConfig[job.status];
                const StatusIcon = cfg.icon;
                const TypeIcon = getFileIcon(job.file.name);
                return (
                  <motion.div
                    key={job.id}
                    initial={{opacity:0, x:-20, scale: 0.95}}
                    animate={{opacity:1, x:0, scale: 1}}
                    exit={{opacity:0, x:20, scale: 0.95}}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="glass-card p-5 flex items-center gap-5 group hover:shadow-xl"
                  >
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all",
                        cfg.bg,
                        job.status === 'converting' && "animate-pulse"
                      )}
                    >
                      <TypeIcon className={cn("w-6 h-6", cfg.color)} />
                    </motion.div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#3D2E1C] truncate mb-1">{job.file.name}</p>

                      {/* Show progress bar if this job is processing and has progress data */}
                      {job.status === 'converting' && processingProgress?.jobId === job.id && processingProgress.total > 0 ? (
                        <div className="mt-2">
                          <ChunkedProgressBar progress={processingProgress} />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-[#8C7B6B] flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-[#8C7B6B]" />
                            {(job.file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                          {job.status === 'converting' && job.error && (
                            <span className="text-[10px] font-medium text-[#8B5E3C] px-2 py-0.5 rounded-lg bg-amber-50">
                              {job.error}
                            </span>
                          )}
                          {job.status === 'failed' && (
                            <span className="text-[10px] font-bold text-[#C25B4E] px-2 py-0.5 rounded-lg bg-red-50">
                              {job.error}
                            </span>
                          )}
                          {job.status === 'completed' && job.totalPages && (
                            <span className="text-[10px] font-bold text-[#5B8C5A] px-2 py-0.5 rounded-lg bg-green-50">
                              {job.totalPages} pages processed
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold border shadow-sm",
                        cfg.bg,
                        cfg.color
                      )}>
                        <StatusIcon className={cn("w-3.5 h-3.5", job.status === 'converting' && "animate-spin")} />
                        {cfg.label}
                      </div>

                      {job.status === 'completed' && job.content && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => exportToPdf(job.file.name.replace(/\.[^/.]+$/, ''), job.content)}
                          className="p-2.5 rounded-xl bg-white/80 border border-[#E8DFD0] hover:bg-[#8B5E3C]/10 hover:border-[#8B5E3C]/30 hover:text-[#8B5E3C] text-[#8C7B6B] transition-all shadow-sm hover:shadow-md magnetic"
                        >
                          <Download className="w-4 h-4" />
                        </motion.button>
                      )}

                      {job.status === 'failed' && (
                        <motion.button
                          whileHover={{ scale: 1.1, rotate: 180 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onFilesAdded([job.file])}
                          className="p-2.5 rounded-xl bg-white/80 border border-[#E8DFD0] hover:bg-[#C4853C]/10 hover:border-[#C4853C]/30 hover:text-[#C4853C] text-[#8C7B6B] transition-all shadow-sm hover:shadow-md"
                        >
                          <RotateCw className="w-4 h-4" />
                        </motion.button>
                      )}

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onRemoveJob(job.id)}
                        className="p-2 rounded-xl text-[#8C7B6B] hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
}
