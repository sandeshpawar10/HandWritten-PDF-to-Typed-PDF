import { saveAs } from 'file-saver';
import {
  Document as DocxDocument, Packer, Paragraph, TextRun,
  HeadingLevel, Table, TableRow, TableCell, WidthType,
  BorderStyle, AlignmentType
} from 'docx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

// ── Markdown parser helpers ──

interface ParsedBlock {
  type: 'heading' | 'paragraph' | 'table' | 'list-item' | 'blockquote' | 'code' | 'separator' | 'hr' | 'empty';
  level?: number;        // heading level 1-6
  ordered?: boolean;     // list type
  text?: string;         // text content
  rows?: string[][];     // table rows
  lines?: string[];      // code block lines
}

function parseMarkdownBlocks(content: string): ParsedBlock[] {
  const lines = content.split('\n');
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
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
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]);
        i++;
      }
      i++; // skip closing $$
      blocks.push({ type: 'code', lines: mathLines });
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
      blocks.push({ type: 'code', lines: mathLines });
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
      const tableLines: string[] = [];
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
      const qLines: string[] = [];
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

function stripInline(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function parseInlineRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_|[^*_`]+)/g;
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
    } else if (seg.length > 0) {
      runs.push(new TextRun({ text: seg, size: 24 }));
    }
  }
  return runs.length > 0 ? runs : [new TextRun({ text, size: 24 })];
}

// ── Export functions ──

export async function exportToTxt(title: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${title}.txt`);
}

export async function exportToDocx(title: string, content: string) {
  const blocks = parseMarkdownBlocks(content);
  const children: (Paragraph | Table)[] = [];

  // Add document title
  children.push(new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 48, color: '000000' })],
    heading: HeadingLevel.TITLE,
    spacing: { after: 400 },
  }));

  const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
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
        levels: [{ level: 0, format: 'decimal' as any, text: '%1.', alignment: AlignmentType.START }],
      }],
    },
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${title}.docx`);
}

export async function exportToPdf(title: string, _content: string) {
  // Use the native browser print engine for perfect Katex rendering and infinite document height support
  const originalTitle = document.title;
  document.title = title;
  
  setTimeout(() => {
    window.print();
    // Restore the original app title after the print dialog opens
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  }, 100);
}
