import { saveAs } from 'file-saver';
import {
  Document as DocxDocument, Packer, Paragraph, TextRun,
  HeadingLevel, Table, TableRow, TableCell, WidthType,
  BorderStyle, AlignmentType
} from 'docx';

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
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\$[^\$]+\$|\*[^*]+\*|_[^_]+_|[^*_`\$]+)/g;
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
          const tableRows = block.rows.map((row, rIdx) =>
            new TableRow({
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
                  width: { size: Math.floor(9000 / row.length), type: WidthType.DXA },
                  shading: rIdx === 0 ? { fill: 'E8EDF5' } : undefined,
                })
              ),
            })
          );
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

export async function exportToPdf(title, content) {
  // Find the dedicated print container
  const printEl = document.getElementById('pdf-export-content');
  if (!printEl) {
    window.print();
    return;
  }

  // Mobile: bypass print dialog and directly download using html2pdf.js
  if (window.innerWidth < 768) {
    const html2pdf = (await import('html2pdf.js')).default;
    
    // Temporarily make the container visible so html2canvas can capture it
    const originalClasses = printEl.className;
    printEl.className = "absolute inset-0 bg-white p-[20mm] z-[9999] opacity-100 block";
    
    const opt = {
      margin:       15,
      filename:     `${title || 'Document'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(printEl).save();
    } finally {
      // Restore original classes
      printEl.className = originalClasses;
    }
    return;
  }

  // Laptop/Desktop logic: Create a properly sized hidden iframe
  // to calculate layout widths correctly for print
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '210mm';   // A4 width
  iframe.style.height = '297mm';  // A4 height
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) return;

  // Copy all stylesheets from the main document to the iframe
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(el => el.outerHTML)
    .join('\n');

  // Build the print document
  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        ${styles}
        <style>
          /* Page setup — controls the actual printed page margins */
          @page {
            size: A4;
            margin: 15mm 18mm;
          }

          /* Reset everything */
          *, *::before, *::after {
            box-sizing: border-box;
          }

          /* Times New Roman — classic academic document font */
          body, p, div, span, li, h1, h2, h3, h4, th, td, blockquote {
            font-family: "Times New Roman", Times, Georgia, serif !important;
          }
          .katex, .katex * {
            font-family: KaTeX_Main, KaTeX_Math, "Times New Roman", serif !important;
          }

          body { 
            background: white !important; 
            margin: 0 !important; 
            padding: 0 !important;
            font-size: 12pt;
            line-height: 1.7;
            color: #1a1a1a;
            width: 100%;
          }

          .md-preview {
            width: 100%;
            max-width: 100%;
            padding: 0;
            margin: 0;
          }

          /* Headings */
          .md-h1 { font-size: 22pt; font-weight: 800; margin: 1.2em 0 0.6em; border-bottom: 2px solid #1e293b; padding-bottom: 0.3em; }
          .md-h2 { font-size: 18pt; font-weight: 700; margin: 1em 0 0.5em; }
          .md-h3 { font-size: 15pt; font-weight: 700; margin: 0.8em 0 0.4em; }
          .md-h4 { font-size: 13pt; font-weight: 700; margin: 0.6em 0 0.3em; }

          /* Paragraphs */
          .md-paragraph { margin-bottom: 0.8em; line-height: 1.7; font-size: 12pt; text-align: justify; }

          /* Bold */
          strong { font-weight: 700; }

          /* Lists */
          .md-ul, .md-ol { margin: 0.8em 0; padding-left: 1.8em; font-size: 12pt; }
          .md-ul li, .md-ol li { margin-bottom: 0.4em; line-height: 1.7; }

          /* Math blocks */
          .md-math-block {
            page-break-inside: avoid;
            margin: 1em 0 !important;
            padding: 0.8em !important;
            background: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 6px !important;
            font-size: 11pt !important;
            overflow-x: hidden;
          }

          .md-math-block .katex-display, .md-math-block .katex {
            white-space: normal !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
          }

          /* Inline code */
          .md-code-inline {
            font-family: "Fira Code", "Consolas", monospace !important;
            background: #f1f5f9;
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 0.9em;
          }

          /* Code blocks */
          .md-code-block {
            font-family: "Fira Code", "Consolas", monospace !important;
            background: #1e293b;
            color: #e2e8f0;
            padding: 0.8em;
            border-radius: 6px;
            font-size: 10pt;
            margin: 1em 0;
            page-break-inside: avoid;
          }
          .md-code-block * { font-family: "Fira Code", "Consolas", monospace !important; }

          /* Tables */
          .md-table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 11pt; }
          .md-table th, .md-table td { border: 1px solid #cbd5e1; padding: 8px 12px; }
          .md-table th { background: #f1f5f9; font-weight: 700; }

          /* Blockquotes */
          .md-blockquote { border-left: 4px solid #94a3b8; margin: 1em 0; padding: 0.4em 1em; color: #475569; font-size: 12pt; }

          /* Page separators — content flows continuously, no forced page breaks */
          .md-page-separator {
            display: none !important;
            height: 0;
            margin: 0;
            padding: 0;
            visibility: hidden;
            border: none;
          }

          /* HR */
          .md-hr { border: none; border-top: 2px solid #cbd5e1; margin: 1.5em 0; }

          /* Images */
          .md-image {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 1em auto;
            display: block;
          }

          /* Image Placeholder */
          .md-image-placeholder {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 0.8em;
            margin: 1em auto;
            max-width: 300px;
            background-color: #f1f5f9;
            border: 2px dashed #cbd5e1;
            border-radius: 8px;
            color: #64748b;
            font-weight: 700;
            font-size: 9pt;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .md-image-placeholder svg {
            width: 16px;
            height: 16px;
          }

          /* Header/footer bar at top of print — hide it */
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="md-preview">
          ${printEl.innerHTML}
        </div>
        <script>
          window.onload = async () => {
            try {
              if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
              }
            } catch (e) {
              console.error("Error waiting for fonts", e);
            }
            
            setTimeout(() => {
              window.print();
              setTimeout(() => {
                window.frameElement.remove();
              }, 100);
            }, 500);
          };
        </script>
      </body>
    </html>
  `);
  iframeDoc.close();
}
