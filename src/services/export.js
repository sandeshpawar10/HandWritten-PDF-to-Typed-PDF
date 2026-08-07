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

  // Clone the node and append it to the body (outside of React's overflow-hidden containers)
  const clone = printEl.cloneNode(true);
  clone.id = 'active-print-container';
  clone.className = 'md-preview'; // Reset classes to avoid Tailwind layout conflicts
  clone.style.display = 'block';
  clone.style.position = 'absolute';
  clone.style.top = '0';
  clone.style.left = '0';
  clone.style.width = '100%';
  clone.style.background = 'white';
  clone.style.zIndex = '999999';
  
  // Re-insert the title into the clone for printing
  clone.innerHTML = `
    <div class="print-header">
      <h1>${title}</h1>
    </div>
    ${printEl.innerHTML}
  `;

  document.body.appendChild(clone);

  // Inject print-specific CSS
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    /* Screen preview styling for the clone just in case it's visible for a split second */
    #active-print-container {
      padding: 20px;
      opacity: 0.01; /* Nearly invisible on screen but prints fine */
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

      /* Page setup */
      @page {
        size: A4;
        margin: 15mm 18mm;
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
        font-size: 12pt;
        line-height: 1.7;
      }

      .print-header h1 { font-size: 24pt; font-weight: 800; border-bottom: 2px solid black; padding-bottom: 0.3em; margin-bottom: 1em; }
      
      #active-print-container .md-h1 { font-size: 22pt; font-weight: 800; margin: 1.2em 0 0.6em; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
      #active-print-container .md-h2 { font-size: 18pt; font-weight: 700; margin: 1em 0 0.5em; }
      #active-print-container .md-h3 { font-size: 15pt; font-weight: 700; margin: 0.8em 0 0.4em; }
      #active-print-container .md-h4 { font-size: 13pt; font-weight: 700; margin: 0.6em 0 0.3em; }

      #active-print-container .md-paragraph { margin-bottom: 0.8em; text-align: justify; }
      #active-print-container strong { font-weight: bold; }
      
      #active-print-container .md-ul, #active-print-container .md-ol { margin: 0.8em 0; padding-left: 2em; }
      #active-print-container li { margin-bottom: 0.4em; }

      #active-print-container .md-math-block {
        page-break-inside: avoid;
        margin: 1em 0;
        padding: 0.8em;
        background: #f9f9f9 !important;
        border: 1px solid #ddd !important;
        border-radius: 4px;
        text-align: center;
      }
      
      #active-print-container .md-code-inline {
        font-family: monospace !important;
        background: #f1f1f1 !important;
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 0.9em;
      }
      
      #active-print-container .md-code-block {
        font-family: monospace !important;
        background: #f1f1f1 !important;
        padding: 1em;
        border-radius: 4px;
        font-size: 10pt;
        margin: 1em 0;
        page-break-inside: avoid;
      }
      #active-print-container .md-code-block * { font-family: monospace !important; }

      #active-print-container .md-table { width: 100%; border-collapse: collapse; margin: 1em 0; }
      #active-print-container .md-table th, #active-print-container .md-table td { border: 1px solid #ccc; padding: 8px; }
      #active-print-container .md-table th { background: #eee !important; font-weight: bold; }

      #active-print-container .md-blockquote { border-left: 4px solid #ccc; margin: 1em 0; padding-left: 1em; color: #555 !important; }
      #active-print-container .md-hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
      
      #active-print-container .md-image { max-width: 100%; height: auto; display: block; margin: 1em auto; }
      
      /* Hide top header/footer URLs that browsers insert */
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
  document.head.appendChild(styleEl);

  // Wait a moment for styles to apply
  await new Promise(r => setTimeout(r, 100));

  // Trigger the print dialog!
  window.print();

  // Cleanup after printing (using a timeout so the print dialog captures it before deletion)
  setTimeout(() => {
    if (document.body.contains(clone)) document.body.removeChild(clone);
    if (document.head.contains(styleEl)) document.head.removeChild(styleEl);
  }, 2000);
}
