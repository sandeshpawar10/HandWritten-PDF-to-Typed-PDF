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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Formatted Document</h3>
              <p className="text-sm text-gray-500">
                {filename || 'document.pdf'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download Buttons */}
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download PDF</span>
            </button>

            <button
              onClick={handleDownloadDocx}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download DOCX</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Unable to preview PDF</p>
                <p className="text-sm text-gray-500 mt-2">
                  Use the download buttons above to save the formatted document
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview
              </span>
              <span>
                • Formatted with headings, bold, and proper spacing
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Auto-formatted by Gemini AI
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
