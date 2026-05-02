import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileImage, FileText, Loader2, X, Download, AlertCircle, CheckCircle2, Clock, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ConversionJob } from '../types';
import { exportToPdf } from '../services/export';

interface FileUploadProps {
  onFilesAdded: (files: File[]) => void;
  jobs: ConversionJob[];
  onRemoveJob: (id: string) => void;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return FileText;
  return FileImage;
}

export function FileUpload({ onFilesAdded, jobs, onRemoveJob }: FileUploadProps) {
  const onDrop = useCallback((files: File[]) => onFilesAdded(files), [onFilesAdded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    multiple: true,
  } as any);

  const completed = jobs.filter(j => j.status === 'completed').length;
  const failed = jobs.filter(j => j.status === 'failed').length;
  const processing = jobs.filter(j => j.status === 'converting' || j.status === 'pending').length;
  const total = jobs.length;

  const statusConfig = {
    pending:    { label: 'Queued',     icon: Clock,         color: 'text-text-dim',  bg: 'bg-text-dim/10' },
    converting: { label: 'Processing', icon: Loader2,       color: 'text-amber-400', bg: 'bg-amber-400/10' },
    completed:  { label: 'Complete',   icon: CheckCircle2,  color: 'text-accent3',   bg: 'bg-accent3/10' },
    failed:     { label: 'Failed',     icon: AlertCircle,   color: 'text-red-400',   bg: 'bg-red-400/10' },
  };

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative rounded-2xl border-2 border-dashed p-12 sm:p-16 text-center cursor-pointer transition-all duration-300 overflow-hidden group",
          isDragActive
            ? "border-accent/60 bg-accent/5"
            : "border-border hover:border-accent/30 hover:bg-surface/50"
        )}
      >
        <input {...getInputProps()} />

        {/* Animated background grid */}
        <div className="absolute inset-0 opacity-20"
          style={{backgroundImage:'radial-gradient(rgba(110,231,247,0.3) 1px, transparent 1px)', backgroundSize:'32px 32px'}} />

        {/* Glow on drag */}
        {isDragActive && (
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-accent2/5 animate-pulse" />
        )}

        <div className="relative z-10 flex flex-col items-center">
          <motion.div
            animate={isDragActive ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300",
              isDragActive
                ? "bg-gradient-to-br from-accent/20 to-accent2/20 border border-accent/40"
                : "bg-surface border border-border group-hover:border-accent/30"
            )}
          >
            <Upload className={cn("w-6 h-6 transition-colors", isDragActive ? "text-accent" : "text-text-dim group-hover:text-accent")} />
          </motion.div>

          <h3 className="text-base font-display font-semibold text-text-main mb-2">
            {isDragActive ? "Drop to start converting" : "Upload handwritten documents"}
          </h3>
          <p className="text-sm text-text-dim max-w-sm">
            Drag & drop PDFs or images here, or click to browse. Tables, lists, and all formatting will be preserved.
          </p>

          <div className="flex gap-2 mt-6">
            {['PDF', 'PNG', 'JPG', 'WEBP'].map(f => (
              <span key={f} className="px-2.5 py-1 rounded-full text-[10px] font-mono font-medium text-text-dim border border-border glass">
                .{f.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Progress bar (when processing) */}
      {total > 0 && processing > 0 && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-2">
          <div className="flex justify-between text-[11px] font-mono">
            <span className="text-text-dim">Converting {processing} of {total} files...</span>
            <span className="text-accent animate-progress-pulse">{Math.round((completed / total) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-surface border border-border overflow-hidden">
            <motion.div
              initial={{width:0}}
              animate={{width: `${Math.max(5, (completed / total) * 100)}%`}}
              transition={{duration:0.5}}
              className="h-full rounded-full"
              style={{background:'linear-gradient(90deg, #6ee7f7, #a78bfa)'}}
            />
          </div>
        </motion.div>
      )}

      {/* Job queue */}
      <AnimatePresence>
        {jobs.length > 0 && (
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}
            className="rounded-2xl glass border border-border overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-surface/50">
              <span className="text-xs font-semibold text-text-mid">Queue ({jobs.length} files)</span>
              <div className="flex items-center gap-4 text-[11px] font-mono font-medium">
                {completed > 0 && <span className="text-accent3">{completed} done</span>}
                {processing > 0 && <span className="text-amber-400">{processing} processing</span>}
                {failed > 0 && <span className="text-red-400">{failed} failed</span>}
              </div>
            </div>

            <div className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {jobs.map((job, i) => {
                  const cfg = statusConfig[job.status];
                  const StatusIcon = cfg.icon;
                  const TypeIcon = getFileIcon(job.file.name);
                  return (
                    <motion.div
                      key={job.id}
                      initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:10}}
                      transition={{delay: i * 0.05}}
                      className="px-5 py-4 flex items-center gap-4 group hover:bg-surface/30 transition-colors"
                    >
                      {/* File icon */}
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", cfg.bg)}>
                        <TypeIcon className={cn("w-4 h-4", cfg.color)} />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-main truncate">{job.file.name}</p>
                        <p className="text-[11px] text-text-dim font-mono">
                          {(job.file.size / 1024 / 1024).toFixed(2)} MB
                          {job.status === 'failed' && job.error && (
                            <span className="text-red-400 ml-2">— {job.error}</span>
                          )}
                        </p>
                      </div>

                      {/* Status + actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", cfg.bg, cfg.color)}>
                          <StatusIcon className={cn("w-3 h-3", job.status === 'converting' && "animate-spin")} />
                          <span className="hidden sm:inline">{cfg.label}</span>
                        </div>

                        {job.status === 'completed' && job.content && (
                          <button
                            onClick={() => exportToPdf(job.file.name.replace(/\.[^/.]+$/, '') + '_typed', job.content!)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-bg transition-all hover:scale-[1.03] active:scale-[0.97]"
                            style={{background:'linear-gradient(135deg,#6ee7f7,#a78bfa)'}}
                          >
                            <Download className="w-3 h-3" />
                            PDF
                          </button>
                        )}

                        {job.status === 'failed' && (
                          <button
                            onClick={() => onFilesAdded([job.file])}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 hover:bg-amber-400/15 transition-all"
                            title="Retry conversion"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span className="hidden sm:inline">Retry</span>
                          </button>
                        )}

                        <button
                          onClick={() => onRemoveJob(job.id)}
                          className="p-1.5 rounded-lg text-text-dim hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
