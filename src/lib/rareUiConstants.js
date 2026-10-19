/**
 * src/lib/rareUiConstants.js
 * Pure JavaScript constants and algorithmic helpers for Rare UI components.
 * Independent of JSX / DOM, fully testable in Node.js test runners.
 */

export const DEFAULT_AI_STATES = {
  queued: { label: 'Queued', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
  reading: { label: 'Reading document', color: 'text-[#8B5E3C]', bg: 'bg-[#8B5E3C]/10', border: 'border-[#8B5E3C]/20', spin: true },
  ocr: { label: 'Recognizing handwriting', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', spin: true },
  transcribing: { label: 'Recognizing handwriting', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', spin: true },
  verifying: { label: 'Verifying equations & tables', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', spin: true },
  formatting: { label: 'Building server PDF', color: 'text-[#C4853C]', bg: 'bg-[#C4853C]/10', border: 'border-[#C4853C]/20', spin: true },
  done: { label: 'Ready', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  completed: { label: 'Ready', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  error: { label: 'Needs attention', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' }
};

export const DEFAULT_WORKFLOW_STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'render', label: 'Prepare pages' },
  { id: 'ocr', label: 'Recognize text' },
  { id: 'verify', label: 'Verify math & tables' },
  { id: 'export', label: 'Build PDF' },
  { id: 'done', label: 'Ready' }
];

export const DEFAULT_FAQ_ITEMS = [
  {
    id: 'accepted-files',
    question: 'What file formats and sizes are supported?',
    answer: 'TypedDoc accepts PDF documents and image files (PNG, JPEG, WebP) up to 25 MB per file. Multi-page PDFs are automatically split and processed concurrently.'
  },
  {
    id: 'page-modes',
    question: 'What is the difference between Clean Reflow and Faithful modes?',
    answer: 'Clean Reflow intelligently groups handwritten notes into compact, beautifully spaced academic typography to prevent excessive page counts (e.g. 27 source pages reflow into ~12 clean pages). Faithful mode enforces strict 1:1 page correspondence matching your exact original layout.'
  },
  {
    id: 'math-tables',
    question: 'How are math equations and tables recognized?',
    answer: 'TypedDoc uses Gemini Multimodal AI with specialized LaTeX and markdown AST verification gates. It converts handwritten formulas into authentic KaTeX expressions and aligns handwritten tabular grids into structured Markdown tables.'
  },
  {
    id: 'server-pdf',
    question: 'Why does my exported PDF say "TypedDoc Server PDF Renderer"?',
    answer: 'Unlike browser print dialogs, TypedDoc generates authentic A4 vector PDFs directly on the server using pdf-lib with embedded academic metadata, running headers, and page numbering.'
  },
  {
    id: 'privacy',
    question: 'How is my document data kept private?',
    answer: 'Your uploaded notes are processed in memory and encrypted in transit. Documents are linked strictly to your Google account and never used for public model training.'
  }
];

/**
 * Extract heading items from markdown content.
 */
export function extractHeadingsFromMarkdown(markdown = '') {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const headings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].trim().replace(/[*_`]/g, '');
      const slug = rawText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `section-${i}`;

      headings.push({
        id: slug,
        label: rawText,
        level,
        depth: level - 1,
        lineIndex: i
      });
    }
  }

  return headings;
}
