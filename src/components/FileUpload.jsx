import { useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileImage, FileText, Loader2, X, Download, AlertCircle, CheckCircle2, Clock, RotateCw, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from './Toast';
import { ChunkedProgressBar } from './ChunkedProgressBar';
import { downloadBase64File } from '../services/chunkedOcr';
import { InlineAIStatus, AnimatedCounter, DeleteButton } from './rare';
import { addNotification } from '../lib/notifications';

// File size limits - prevent backend OOM
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILE_SIZE_MB = 25;

function getFileIcon(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return FileText;
  return FileImage;
}

export function FileUpload({ onFilesAdded, jobs, onRemoveJob, onRetryJob, processingProgress }) {
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

  // Emit durable notifications when jobs complete or fail
  useEffect(() => {
    jobs.forEach(job => {
      if (job.status === 'completed' && !job._notified) {
        job._notified = true;
        addNotification({
          title: 'Document transcribed',
          message: `${job.file.name} was successfully transcribed.`,
          type: 'success',
          docId: job.id
        });
      } else if (job.status === 'failed' && !job._notified) {
        job._notified = true;
        addNotification({
          title: 'Transcription failed',
          message: `${job.file.name}: ${job.error || 'Server error occurred'}`,
          type: 'error',
          docId: job.id
        });
      }
    });
  }, [jobs]);

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
          "relative rounded-3xl sm:rounded-[2.5rem] border-2 border-dashed p-6 sm:p-12 md:p-20 text-center cursor-pointer overflow-hidden group backdrop-blur-sm",
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
                  className="absolute inset-0 bg-gradient-to-br from-[#8B5E3C]/20 to-transparent rounded-3xl sm:rounded-[2.5rem] blur-3xl"
                />
              </>
            )}
          </AnimatePresence>

          <div className="relative z-10 flex flex-col items-center">
            {/* Interactive Transformation Visual */}
            <div className="flex items-center justify-center gap-3 mb-5 sm:mb-8 select-none">
              {/* Handwritten note preview */}
              <motion.div
                animate={isDragActive ? { x: -8, rotate: -6, scale: 1.05 } : { x: 0, rotate: -2, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-12 h-16 sm:w-14 sm:h-18 rounded-lg bg-[#F6EEDF] border border-[#DECFB5] shadow-md p-2 flex flex-col justify-between"
              >
                <div className="space-y-1 mt-0.5">
                  <div className="h-1 w-full bg-[#3D2E1C]/60 rounded-full" />
                  <div className="h-1 w-4/5 bg-[#3D2E1C]/50 rounded-full" />
                  <div className="h-1 w-2/3 bg-[#3D2E1C]/40 rounded-full" />
                </div>
                <div className="text-[7px] font-mono text-[#9C8A76] uppercase">Note</div>
              </motion.div>

              {/* Transformation arrow with amber glow */}
              <motion.div
                animate={isDragActive ? { scale: 1.25, rotate: 5 } : { scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="relative flex items-center justify-center text-[#C4853C]"
              >
                <svg width="32" height="24" viewBox="0 0 32 24" fill="none" className="overflow-visible">
                  <path
                    d="M 4 18 C 6 10, 16 8, 26 10 L 22 6 L 30 11 L 22 16 L 24 12 C 16 11, 8 13, 6 20 Z"
                    fill={isDragActive ? "#D99A4A" : "#C4853C"}
                    className={isDragActive ? "drop-shadow-[0_2px_8px_rgba(217,154,74,0.6)]" : ""}
                  />
                </svg>
              </motion.div>

              {/* Brand typed document preview */}
              <motion.div
                animate={isDragActive ? { x: 8, rotate: 2, scale: 1.08 } : { x: 0, rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex items-center justify-center relative shadow-sm"
              >
                <img
                  src="/brand/logo.jpg"
                  alt="TypedDoc Logo"
                  className="w-full h-full object-cover rounded-xl"
                />
              </motion.div>
            </div>

            <motion.h3
              animate={isDragActive ? { scale: 1.05 } : { scale: 1 }}
              className="text-xl sm:text-2xl font-display font-black text-[#3D2E1C] mb-2 sm:mb-3"
            >
              {isDragActive ? "Release to transform" : "Drop your handwritten notes"}
            </motion.h3>
            <p className="text-xs sm:text-sm text-[#8C7B6B] max-w-sm font-medium leading-relaxed">
              Supports PDF and image files (max {MAX_FILE_SIZE_MB} MB per file)
            </p>

            <div className="flex gap-2 sm:gap-3 mt-6 sm:mt-10">
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
            <div className="flex gap-2 sm:gap-5">
              {processing > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-[#C4853C]/10 border border-[#C4853C]/20"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-[#C4853C]"
                  />
                  <span className="text-[11px] sm:text-xs font-bold text-[#C4853C]">{processing} active</span>
                </motion.div>
              )}
              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white/60 backdrop-blur-sm border border-[#E8DFD0]">
                <span className="text-[11px] sm:text-xs font-bold text-[#8C7B6B] flex items-center gap-1">
                  <AnimatedCounter value={completed} />/<AnimatedCounter value={total} /> completed
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {jobs.map(job => {
                const cfg = statusConfig[job.status];
                const TypeIcon = getFileIcon(job.file.name);
                return (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="glass-card p-4 sm:p-5 flex flex-col gap-3 group hover:shadow-xl transition-shadow"
                  >
                    {/* Top Tier: File Info on Left, Status Badge & Actions on Right */}
                    <div className="flex items-center justify-between gap-3 w-full">
                      {/* Left: Icon + File Name & Metadata */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          className={cn(
                            "w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border transition-all",
                            cfg.bg,
                            job.status === 'converting' && "animate-pulse"
                          )}
                        >
                          <TypeIcon className={cn("w-5 h-5 sm:w-6 sm:h-6", cfg.color)} />
                        </motion.div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-[#3D2E1C] truncate" title={job.file.name}>
                            {job.file.name}
                          </p>
                          <span className="text-[10px] sm:text-[11px] font-semibold text-[#8C7B6B] flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8C7B6B]/60" />
                            {(job.file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      </div>

                      {/* Right: Status Badge & Action Buttons */}
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {/* Status Badge using Rare UI Inline AI Status */}
                        <InlineAIStatus
                          state={job.status === 'converting' ? (processingProgress?.stage === 'formatting' ? 'formatting' : processingProgress?.stage === 'verifying' ? 'verifying' : 'ocr') : job.status}
                          detail={
                            processingProgress?.jobId === job.id && processingProgress?.total > 0
                              ? (processingProgress?.inFlight > 0
                                  ? `${processingProgress.current}/${processingProgress.total} (${processingProgress.inFlight} active)`
                                  : `${processingProgress.current}/${processingProgress.total}`)
                              : undefined
                          }
                        />

                        {/* Download button for completed */}
                        {job.status === 'completed' && (
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!job.formattedPdf) {
                                toast.error('Server-formatted PDF was not generated. Please retry the conversion.');
                                return;
                              }
                              downloadBase64File(
                                job.formattedPdf,
                                `${job.file.name.replace(/\.[^/.]+$/, '')}_formatted.pdf`,
                                'application/pdf'
                              );
                            }}
                            title={job.formattedPdf ? "Download server-formatted PDF" : "Server PDF unavailable"}
                            aria-label="Download formatted PDF"
                            className={cn(
                              "min-w-[36px] min-h-[36px] p-2 rounded-xl bg-white/90 border border-[#E8DFD0] transition-all shadow-xs flex items-center justify-center",
                              job.formattedPdf
                                ? "hover:bg-[#8B5E3C]/10 hover:border-[#8B5E3C]/30 hover:text-[#8B5E3C] text-[#8C7B6B]"
                                : "opacity-40 cursor-not-allowed text-[#8C7B6B]"
                            )}
                          >
                            <Download className="w-4 h-4" />
                          </motion.button>
                        )}

                        {/* Retry button for failed */}
                        {job.status === 'failed' && (
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.08, rotate: 180 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onRetryJob) {
                                onRetryJob(job.id);
                              } else {
                                onRemoveJob(job.id);
                                onFilesAdded([job.file]);
                              }
                            }}
                            title="Retry conversion"
                            aria-label="Retry conversion"
                            className="min-w-[36px] min-h-[36px] p-2 rounded-xl bg-white/90 border border-[#C4853C]/30 hover:bg-[#C4853C]/10 hover:border-[#C4853C] text-[#C4853C] flex items-center justify-center transition-all shadow-xs"
                          >
                            <RotateCw className="w-4 h-4" />
                          </motion.button>
                        )}

                        {/* Remove / Cancel button using Rare UI DeleteButton for completed/failed */}
                        {job.status === 'converting' ? (
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveJob(job.id);
                            }}
                            title="Cancel conversion"
                            aria-label="Cancel conversion"
                            className="min-w-[36px] min-h-[36px] p-2 rounded-xl text-[#8C7B6B] hover:text-red-500 hover:bg-red-50/80 border border-transparent hover:border-red-200 flex items-center justify-center transition-all"
                          >
                            <X className="w-4 h-4" />
                          </motion.button>
                        ) : (
                          <DeleteButton
                            onConfirm={() => onRemoveJob(job.id)}
                            aria-label={`Remove ${job.file.name}`}
                          />
                        )}
                      </div>
                    </div>

                    {/* Bottom Tier: Full-Width (100%) Progress Bar & Details */}
                    {job.status === 'converting' && (
                      <div className="w-full pt-1">
                        {processingProgress?.jobId === job.id ? (
                          <ChunkedProgressBar progress={processingProgress} />
                        ) : (
                          <ChunkedProgressBar
                            progress={{
                              percent: 15,
                              current: 0,
                              total: 1,
                              stage: 'reading',
                              message: job.progressMessage || 'Preparing document for OCR...'
                            }}
                          />
                        )}
                      </div>
                    )}

                    {job.status === 'failed' && job.error && (
                      <div className="w-full pt-1">
                        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-50/80 border border-red-100 text-[11px] text-[#C25B4E] font-medium leading-relaxed break-words">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#C25B4E]" />
                          <span>{job.error}</span>
                        </div>
                      </div>
                    )}

                    {job.status === 'completed' && job.totalPages && (
                      <div className="w-full pt-0.5 flex items-center justify-between text-[11px] text-[#5B8C5A] font-semibold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {job.totalPages} {job.totalPages === 1 ? 'page' : 'pages'} formatted successfully
                        </span>
                      </div>
                    )}
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
