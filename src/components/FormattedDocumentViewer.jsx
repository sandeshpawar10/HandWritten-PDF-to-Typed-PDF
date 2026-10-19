import { useState, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FileText, Download, Eye, X, BookOpen } from 'lucide-react';
import { downloadBase64File } from '../services/formattedOcr';
import { MarkdownPreview } from './MarkdownPreview';
import { toast } from './Toast';
import { RailTOC } from './rare';

/**
 * FormattedDocumentViewer Component
 * Displays formatted PDF with download options for PDF and DOCX.
 * Includes interactive reading view tab fallback with RailTOC outline so preview is never blank.
 */
export function FormattedDocumentViewer({ formattedPdf, formattedDocx, content = '', filename = 'document.pdf', onClose }) {
  const [activeTab, setActiveTab] = useState(formattedPdf ? 'pdf' : 'markdown');
  const markdownScrollRef = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleDownloadPdf = () => {
    if (!formattedPdf) {
      toast.error('PDF is not available for this document.');
      return;
    }
    const safeName = filename ? filename.replace(/\.[^/.]+$/, '') + '_formatted.pdf' : 'document_formatted.pdf';
    downloadBase64File(formattedPdf, safeName, 'application/pdf');
    toast.success('Downloading formatted PDF...');
  };

  const handleDownloadDocx = () => {
    if (!formattedDocx) {
      toast.error('DOCX is not available for this document.');
      return;
    }
    const safeName = filename ? filename.replace(/\.[^/.]+$/, '') + '_formatted.docx' : 'document_formatted.docx';
    downloadBase64File(formattedDocx, safeName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    toast.success('Downloading formatted DOCX...');
  };

  // Convert base64 to blob URL for preview
  const pdfUrl = useMemo(() => {
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

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-doc-title"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[95vh] sm:h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 gap-2 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 id="modal-doc-title" className="text-sm sm:text-base font-bold text-gray-900 truncate">
                Formatted Document
              </h3>
              <p className="text-xs text-gray-500 truncate max-w-[140px] sm:max-w-xs">
                {filename || 'document.pdf'}
              </p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('pdf')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'pdf' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> PDF View
              </span>
            </button>
            <button
              onClick={() => setActiveTab('markdown')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'markdown' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Reading View
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Download Buttons */}
            <button
              onClick={handleDownloadPdf}
              disabled={!formattedPdf}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs active:scale-95 ${
                formattedPdf
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              title={formattedPdf ? 'Download Formatted PDF' : 'PDF not generated'}
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Download PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>

            <button
              onClick={handleDownloadDocx}
              disabled={!formattedDocx}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs active:scale-95 ${
                formattedDocx
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              title={formattedDocx ? 'Download Formatted Word Document' : 'DOCX not generated'}
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Download DOCX</span>
              <span className="sm:hidden">DOCX</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-hidden bg-gray-50 relative">
          {activeTab === 'pdf' && (
            pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title="Formatted Document Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full p-6">
                <div className="text-center max-w-sm">
                  <FileText className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                  <h4 className="font-bold text-gray-800 text-base">Interactive Reading View Ready</h4>
                  <p className="text-xs text-gray-500 mt-1 mb-4">
                    PDF embedding is unavailable in this browser view. Switch to Reading View to preview or download the file above.
                  </p>
                  <button
                    onClick={() => setActiveTab('markdown')}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    Open Reading View
                  </button>
                </div>
              </div>
            )
          )}

          {activeTab === 'markdown' && (
            <div ref={markdownScrollRef} className="w-full h-full overflow-y-auto p-4 sm:p-8 bg-[#FFFBF5]">
              <div className="max-w-5xl mx-auto flex gap-8 items-start">
                <div className="flex-1 min-w-0 max-w-3xl bg-white p-6 sm:p-10 rounded-2xl border border-[#E8DFD0] shadow-sm">
                  {content ? (
                    <MarkdownPreview content={content} />
                  ) : (
                    <p className="text-sm text-gray-500 italic">No document text available.</p>
                  )}
                </div>

                {content && (
                  <div className="hidden lg:block w-64 shrink-0 sticky top-0">
                    <RailTOC content={content} containerRef={markdownScrollRef} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-2.5 sm:p-3 border-t border-gray-200 bg-gray-50/80 shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-gray-600 gap-1 sm:gap-4">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">Formatted with academic layout, math styling, tables, and typography</span>
            </div>
            <div className="text-[11px] text-gray-500 shrink-0">
              TypedDoc Formatted Engine
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

FormattedDocumentViewer.propTypes = {
  formattedPdf: PropTypes.string,
  formattedDocx: PropTypes.string,
  content: PropTypes.string,
  filename: PropTypes.string,
  onClose: PropTypes.func
};
