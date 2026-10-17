import React, { useMemo, useEffect } from 'react';
import { FileText, Download, Eye, X } from 'lucide-react';
import { downloadBase64File } from '../services/formattedOcr';
import { toast } from './Toast';

/**
 * PDF Viewer Component
 * Displays formatted PDF with download options for PDF and DOCX
 */
export function FormattedDocumentViewer({ formattedPdf, formattedDocx, filename, onClose }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleDownloadPdf = () => {
    if (!formattedPdf) {
      toast.error('PDF not available');
      return;
    }
    const name = filename ? filename.replace(/\.[^/.]+$/, '') + '_formatted.pdf' : 'document_formatted.pdf';
    downloadBase64File(formattedPdf, name, 'application/pdf');
  };

  const handleDownloadDocx = () => {
    if (!formattedDocx) {
      toast.error('DOCX not available');
      return;
    }
    const name = filename ? filename.replace(/\.[^/.]+$/, '') + '_formatted.docx' : 'document_formatted.docx';
    downloadBase64File(formattedDocx, name, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  };

  // Convert base64 to blob URL for preview
  const pdfUrl = React.useMemo(() => {
    if (!formattedPdf) return null;
    try {
      const byteCharacters = atob(formattedPdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Failed to create PDF URL:', error);
      return null;
    }
  }, [formattedPdf]);

  React.useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[95vh] sm:h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 gap-2 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">Formatted Document</h3>
              <p className="text-xs text-gray-500 truncate max-w-[140px] sm:max-w-xs">
                {filename || 'document.pdf'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Download Buttons */}
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-xs sm:text-sm font-semibold transition-colors shadow-xs active:scale-95"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Download PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>

            <button
              onClick={handleDownloadDocx}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 text-xs sm:text-sm font-semibold transition-colors shadow-xs active:scale-95"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Download DOCX</span>
              <span className="sm:hidden">DOCX</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 overflow-hidden bg-gray-100">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title="Formatted Document Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center">
                <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                <p className="text-gray-700 font-medium text-sm sm:text-base">Unable to preview PDF</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                  Use the download buttons above to save the formatted document
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-2.5 sm:p-3 border-t border-gray-200 bg-gray-50/80 shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-gray-600 gap-1 sm:gap-4">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">Formatted with headings, bold, and proper spacing</span>
            </div>
            <div className="text-[11px] text-gray-500 shrink-0">
              Auto-formatted by Gemini AI
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
