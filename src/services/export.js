import { saveAs } from 'file-saver';
import {
  Document as DocxDocument, Packer, Paragraph, TextRun,
  HeadingLevel, Table, TableRow, TableCell, WidthType,
  BorderStyle, AlignmentType
} from 'docx';
import { auth } from '../lib/firebase.js';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD
  ? "https://typeddoc.onrender.com"
  : "http://localhost:3001");
const RENDER_PDF_URL = `${API_BASE}/api/v1/render/pdf`;

// ── Markdown parser helpers ──

function parseMarkdownBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'code', lines: codeLines });
      continue;
    }

    // Math blocks $$
    if (trimmed === '$$') {
      const mathLines = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]);
        i++;
      }
      i++; // skip closing $$
      blocks.push({ type: 'math', lines: mathLines });
      continue;
    }

    // Raw LaTeX begin{...} blocks
    if (trimmed.startsWith('\\begin{')) {
      const mathLines = [line];
      const beginType = trimmed.match(/^\\begin\{([^}]+)\}/)?.[1];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(`\\end{${beginType}}`)) {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        mathLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'math', lines: mathLines });
      continue;
    }

    // Page separator
    if (trimmed.match(/^--- Page \d+ ---$/)) {
      blocks.push({ type: 'separator', text: trimmed });
      i++;
      continue;
    }

    // HR
    if (trimmed.match(/^(---|\*\*\*|___)$/)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Table: line has | and next line is separator row
    if (trimmed.includes('|') && i + 1 < lines.length && lines[i + 1].trim().match(/^\|?[\s\-:|]+\|/)) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const rows = tableLines
        .filter(l => !l.match(/^\|?[\s\-:|]+\|?$/))
        .map(l => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
      blocks.push({ type: 'table', rows });
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const qLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        qLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', text: qLines.join('\n') });
      continue;
    }

    // Unordered list
    if (trimmed.match(/^[-*+]\s+/)) {
      blocks.push({ type: 'list-item', ordered: false, text: trimmed.replace(/^[-*+]\s+/, '') });
      i++;
      continue;
    }

    // Ordered list
    if (trimmed.match(/^\d+\.\s+/)) {
      blocks.push({ type: 'list-item', ordered: true, text: trimmed.replace(/^\d+\.\s+/, '') });
      i++;
      continue;
    }

    // Empty line
    if (trimmed === '') {
      blocks.push({ type: 'empty' });
      i++;
      continue;
    }

    // Regular paragraph
    blocks.push({ type: 'paragraph', text: trimmed });
    i++;
  }

  return blocks;
}

function parseInlineRuns(text) {
  const runs = [];
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\$[^$]+\$|\*[^*]+\*|_[^_]+_|[^*_`$]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const seg = match[1];
    if (seg.startsWith('**') && seg.endsWith('**')) {
      runs.push(new TextRun({ text: seg.slice(2, -2), bold: true, size: 24 }));
    } else if (seg.startsWith('__') && seg.endsWith('__')) {
      runs.push(new TextRun({ text: seg.slice(2, -2), bold: true, size: 24 }));
    } else if (seg.startsWith('`') && seg.endsWith('`')) {
      runs.push(new TextRun({ text: seg.slice(1, -1), font: 'Courier New', size: 22, shading: { fill: 'F0F0F0' } }));
    } else if (seg.startsWith('*') && seg.endsWith('*')) {
      runs.push(new TextRun({ text: seg.slice(1, -1), italics: true, size: 24 }));
    } else if (seg.startsWith('_') && seg.endsWith('_')) {
      runs.push(new TextRun({ text: seg.slice(1, -1), italics: true, size: 24 }));
    } else if (seg.startsWith('$') && seg.endsWith('$')) {
      // Clean inline math
      const math = seg.slice(1, -1).replace(/\\text\{([^}]+)\}/g, '$1').replace(/\\quad/g, '  ');
      runs.push(new TextRun({ text: math, italics: true, color: '444444', size: 24 }));
    } else if (seg.length > 0) {
      runs.push(new TextRun({ text: seg, size: 24 }));
    }
  }
  return runs.length > 0 ? runs : [new TextRun({ text, size: 24 })];
}

// ── Export functions ──

export async function exportToTxt(title, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${title}.txt`);
}

export const exportToDocx = async (title, content) => {
  const blocks = parseMarkdownBlocks(content);
  const children = [];

  // Add document title
  children.push(new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 48, color: '000000' })],
    heading: HeadingLevel.TITLE,
    spacing: { after: 400 },
  }));

  const headingMap = {
    1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4, 5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6,
  };

  const borderStyle = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const cellBorders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        children.push(new Paragraph({
          children: [new TextRun({ text: block.text || '', bold: true, size: block.level === 1 ? 36 : block.level === 2 ? 30 : 26 })],
          heading: headingMap[block.level || 1],
          spacing: { before: 300, after: 150 },
        }));
        break;

      case 'table':
        if (block.rows && block.rows.length > 0) {
          const tableRows = block.rows.map((row, rIdx) => {
            const colWidth = row.length > 0 ? Math.floor(9000 / row.length) : 9000;
            return new TableRow({
              children: row.map(cell =>
                new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun({
                      text: cell,
                      bold: rIdx === 0,
                      size: 22,
                    })],
                  })],
                  borders: cellBorders,
                  width: { size: colWidth, type: WidthType.DXA },
                  shading: rIdx === 0 ? { fill: 'E8EDF5' } : undefined,
                })
              ),
            });
          });
          children.push(new Table({ rows: tableRows, width: { size: 9000, type: WidthType.DXA } }));
          children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        }
        break;

      case 'list-item':
        children.push(new Paragraph({
          children: parseInlineRuns(block.text || ''),
          bullet: block.ordered ? undefined : { level: 0 },
          numbering: block.ordered ? { reference: 'default-numbering', level: 0 } : undefined,
          spacing: { after: 60 },
        }));
        break;

      case 'blockquote':
        children.push(new Paragraph({
          children: [new TextRun({ text: block.text || '', italics: true, color: '666666', size: 24 })],
          indent: { left: 720 },
          spacing: { before: 200, after: 200 },
        }));
        break;

      case 'code':
        (block.lines || []).forEach(codeLine => {
          children.push(new Paragraph({
            children: [new TextRun({ text: codeLine, font: 'Courier New', size: 20 })],
            spacing: { after: 40 },
            shading: { fill: 'F5F5F5' },
          }));
        });
        break;

      case 'math':
        (block.lines || []).forEach(mathLine => {
          const clean = mathLine
            .replace(/\\text\{([^}]+)\}/g, '$1')
            .replace(/\\quad/g, '  ')
            .replace(/\\begin\{[^}]+\}/g, '')
            .replace(/\\end\{[^}]+\}/g, '')
            .trim();
          if (clean) {
            children.push(new Paragraph({
              children: [new TextRun({ text: clean, italics: true, color: '444444', size: 26 })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80 },
            }));
          }
        });
        break;

      case 'separator':
        // Skip separators in clean export
        break;

      case 'paragraph':
        children.push(new Paragraph({
          children: parseInlineRuns(block.text || ''),
          spacing: { after: 120 },
        }));
        break;

      default:
        break;
    }
  }

  const doc = new DocxDocument({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }],
      }],
    },
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${title}.docx`);
}

/**
 * Request real server-generated PDF with embedded metadata and academic typography.
 * Strictly downloads the authentic server binary (*_formatted.pdf).
 */
export async function exportServerPdf(title, content, options = {}) {
  const { pageMode = 'clean-reflow' } = options;

  if (!content || !content.trim()) {
    throw new Error('Cannot export empty document to PDF.');
  }

  let token = null;
  if (auth?.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn('Could not retrieve auth token for PDF render:', e.message);
    }
  }

  const res = await fetch(RENDER_PDF_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      title: title || 'TypedDoc Document',
      content,
      pageMode
    })
  });

  if (!res.ok) {
    let errMsg = `Failed to generate PDF (HTTP ${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.error || errMsg;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  if (!data.formattedPdf) {
    throw new Error('Server returned an empty PDF payload.');
  }

  // Download the authentic server-generated PDF binary
  const byteCharacters = atob(data.formattedPdf);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  const safeTitle = (title || 'document').replace(/[/\\?%*:|"<>]/g, '_').trim();
  saveAs(blob, `${safeTitle}_formatted.pdf`);

  return data;
}

/**
 * Authoritative PDF export: Delegates directly to server renderer.
 */
export async function exportToPdf(title, content, options = {}) {
  return await exportServerPdf(title, content, options);
}

/**
 * Browser-print generator using window.print().
 * Kept strictly for the explicitly labelled "Print Current View" action.
 */
export async function printCurrentView(title, content, options = {}) {
  const { pageMode = 'clean-reflow' } = options;

  // Find the dedicated print container, or generate from content as fallback
  let printEl = document.getElementById('pdf-export-content');
  let clone;

  if (printEl) {
    clone = printEl.cloneNode(true);
  } else if (content) {
    clone = document.createElement('div');
    const blocks = parseMarkdownBlocks(content);
    for (const block of blocks) {
      if (block.type === 'heading') {
        const h = document.createElement(`h${block.level || 1}`);
        h.className = `md-h${block.level || 1}`;
        h.textContent = block.text || '';
        clone.appendChild(h);
      } else if (block.type === 'paragraph') {
        const p = document.createElement('p');
        p.className = 'md-paragraph';
        p.textContent = block.text || '';
        clone.appendChild(p);
      } else if (block.type === 'code') {
        const pre = document.createElement('pre');
        pre.className = 'md-code-block';
        pre.textContent = (block.lines || []).join('\n');
        clone.appendChild(pre);
      } else if (block.type === 'math') {
        const div = document.createElement('div');
        div.className = 'md-math-block';
        div.textContent = (block.lines || []).join('\n');
        clone.appendChild(div);
      } else if (block.type === 'blockquote') {
        const bq = document.createElement('blockquote');
        bq.className = 'md-blockquote';
        bq.textContent = block.text || '';
        clone.appendChild(bq);
      } else if (block.type === 'list-item') {
        const li = document.createElement('li');
        li.textContent = block.text || '';
        clone.appendChild(li);
      } else if (block.type === 'hr') {
        const hr = document.createElement('hr');
        hr.className = 'md-hr';
        clone.appendChild(hr);
      } else if (block.type === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'md-page-separator';
        const span = document.createElement('span');
        span.textContent = block.text ? block.text.replace(/^-+\s*|\s*-+$/g, '') : 'Page';
        sep.appendChild(span);
        clone.appendChild(sep);
      } else if (block.type === 'table') {
        if (block.rows && block.rows.length > 0) {
          const tbl = document.createElement('table');
          tbl.className = 'md-table';
          block.rows.forEach((row, rIdx) => {
            const tr = document.createElement('tr');
            row.forEach(cell => {
              const el = document.createElement(rIdx === 0 ? 'th' : 'td');
              el.textContent = cell;
              tr.appendChild(el);
            });
            tbl.appendChild(tr);
          });
          clone.appendChild(tbl);
        }
      }
    }
  } else {
    throw new Error('PDF export failed: Document preview element (#pdf-export-content) not found and no document content was provided.');
  }

  // Use the browser's paged PDF engine. Unlike canvas-based export, it can
  // reliably handle large documents with many full-page diagrams.
  clone.id = 'active-print-container';
  clone.className = 'md-preview'; // Reset classes to avoid Tailwind layout conflicts
  clone.style.display = 'block';
  clone.style.position = 'absolute';
  clone.style.top = '0';
  clone.style.left = '0';
  clone.style.width = '100%';
  clone.style.background = 'white';
  clone.style.zIndex = '999999';
  
  // Avoid adding a second title when OCR already produced an H1 title.
  if (!clone.querySelector('h1')) {
    const header = document.createElement('div');
    header.className = 'print-header';
    const heading = document.createElement('h1');
    heading.textContent = title;
    header.appendChild(heading);
    clone.prepend(header);
  }

  document.body.appendChild(clone);

  // Inject print-specific CSS
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    /* Screen preview styling for the clone */
    #active-print-container {
      padding: 20px;
      opacity: 0.01;
      pointer-events: none;
    }

    /* Print media overrides */
    @media print {
      /* Hide the React application completely */
      #root { display: none !important; }
      
      /* Reset body to allow normal scrolling/printing */
      body { 
        background: white !important; 
        overflow: visible !important; 
        height: auto !important; 
        min-height: auto !important;
      }
      
      /* Make the print container visible and static */
      #active-print-container {
        position: static !important;
        display: block !important;
        width: 100% !important;
        opacity: 1 !important;
        padding: 0 !important;
      }

      /* Page setup: compact 12mm 14mm in reflow */
      @page {
        size: A4;
        margin: ${pageMode === 'clean-reflow' ? '12mm 14mm' : '15mm 18mm'};
      }

      /* Reset everything inside print container */
      #active-print-container *, #active-print-container *::before, #active-print-container *::after {
        box-sizing: border-box;
      }

      /* Academic fonts */
      #active-print-container, #active-print-container p, #active-print-container h1, #active-print-container h2, #active-print-container h3, #active-print-container th, #active-print-container td, #active-print-container li, #active-print-container blockquote {
        font-family: "Times New Roman", Times, Georgia, serif !important;
        color: black !important;
      }

      /* Layout & Typography */
      #active-print-container { 
        font-size: ${pageMode === 'clean-reflow' ? '10.5pt' : '11.5pt'} !important;
        line-height: ${pageMode === 'clean-reflow' ? '1.35' : '1.6'} !important;
      }

      .print-header h1 { 
        font-size: 20pt !important; 
        font-weight: 800; 
        border-bottom: 1.5pt solid black; 
        padding-bottom: 0.25em; 
        margin-bottom: 0.8em; 
      }
      
      #active-print-container .md-h1 { 
        font-size: 15pt !important; 
        font-weight: 800; 
        margin: 0.8em 0 0.35em !important; 
        border-bottom: 1px solid #ccc; 
        padding-bottom: 0.2em; 
        break-after: avoid !important;
        page-break-after: avoid !important;
      }
      #active-print-container .md-h2 { 
        font-size: 13pt !important; 
        font-weight: 700; 
        margin: 0.65em 0 0.25em !important; 
        break-after: avoid !important;
        page-break-after: avoid !important;
      }
      #active-print-container .md-h3 { 
        font-size: 11.5pt !important; 
        font-weight: 700; 
        margin: 0.5em 0 0.2em !important; 
        break-after: avoid !important;
        page-break-after: avoid !important;
      }
      #active-print-container .md-h4 { 
        font-size: 10.5pt !important; 
        font-weight: 700; 
        margin: 0.4em 0 0.2em !important; 
        break-after: avoid !important;
        page-break-after: avoid !important;
      }

      #active-print-container .md-paragraph { 
        margin-bottom: 0.45em !important; 
        text-align: justify; 
      }
      #active-print-container strong { font-weight: bold; }
      
      #active-print-container .md-ul, #active-print-container .md-ol { 
        margin: 0.5em 0 !important; 
        padding-left: 1.6em !important; 
      }
      #active-print-container li { 
        margin-bottom: 0.25em !important; 
      }

      #active-print-container .md-math-block {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
        margin: 0.5em 0 !important;
        padding: 0.4em 0.6em !important;
        background: #f9f9f9 !important;
        border: 1px solid #ddd !important;
        border-radius: 4px;
        text-align: center;
      }
      
      #active-print-container .md-code-inline {
        font-family: monospace !important;
        background: #f1f1f1 !important;
        padding: 1px 3px !important;
        border-radius: 3px;
        font-size: 0.88em !important;
      }
      
      #active-print-container .md-code-block {
        font-family: monospace !important;
        background: #f1f1f1 !important;
        padding: 0.6em !important;
        border-radius: 4px;
        font-size: 8.5pt !important;
        line-height: 1.2 !important;
        margin: 0.5em 0 !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      #active-print-container .md-code-block * { font-family: monospace !important; }

      #active-print-container .md-table { 
        width: 100%; 
        border-collapse: collapse; 
        margin: 0.6em 0 !important; 
        break-inside: auto;
      }
      #active-print-container .md-table thead {
        display: table-header-group !important;
      }
      #active-print-container .md-table tr {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      #active-print-container .md-table th, #active-print-container .md-table td { 
        border: 1px solid #ccc; 
        padding: 4px 6px !important; 
        font-size: 9pt !important; 
      }
      #active-print-container .md-table th { 
        background: #eee !important; 
        font-weight: bold; 
      }

      #active-print-container .md-blockquote { 
        border-left: 3px solid #ccc; 
        margin: 0.6em 0 !important; 
        padding-left: 0.8em !important; 
        color: #555 !important; 
      }
      #active-print-container .md-hr { 
        border: none; 
        border-top: 1px solid #ccc; 
        margin: 0.8em 0 !important; 
      }
      
      #active-print-container .md-image { 
        max-width: 100%; 
        height: auto; 
        display: block; 
        margin: 0.8em auto !important; 
        break-inside: avoid !important;
      }
      
      /* In clean-reflow mode: soft running page dividers, preventing double-pagination */
      ${pageMode === 'clean-reflow' ? `
      #active-print-container .md-page-separator {
        break-before: auto !important;
        page-break-before: auto !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        margin: 1.2em 0 0.8em !important;
        color: #777 !important;
        font-size: 8pt !important;
        font-weight: 500 !important;
        height: auto !important;
        overflow: visible !important;
      }
      #active-print-container .md-page-separator span {
        padding: 0 0.8em;
        background: white;
      }
      #active-print-container .md-page-separator::before,
      #active-print-container .md-page-separator::after {
        content: '';
        flex: 1;
        border-bottom: 0.5pt solid #ddd;
      }
      ` : `
      /* Faithful / Preserve-source-pages mode: Strict page breaks */
      #active-print-container .md-page-separator { 
        break-before: page !important; 
        page-break-before: always !important; 
        height: 0 !important; 
        overflow: hidden !important; 
        margin: 0 !important; 
      }
      #active-print-container .print-header + .md-page-separator { 
        break-before: auto !important; 
        page-break-before: auto !important; 
      }
      `}
      
      /* Hide top header/footer URLs that browsers insert */
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
  document.head.appendChild(styleEl);

  // Deterministic font and rendering readiness safeguard
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue if font readiness promise fails
    }
  }
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 120)));

  // Trigger the print dialog!
  window.print();

  // Cleanup after printing (using a timeout so the print dialog captures it before deletion)
  setTimeout(() => {
    if (document.body.contains(clone)) document.body.removeChild(clone);
    if (document.head.contains(styleEl)) document.head.removeChild(styleEl);
  }, 2000);
}
