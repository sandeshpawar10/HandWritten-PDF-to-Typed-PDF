import { saveAs } from 'file-saver';
import {
  Document as DocxDocument, Packer, Paragraph, TextRun,
  HeadingLevel, Table, TableRow, TableCell, WidthType,
  BorderStyle, AlignmentType
} from 'docx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

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
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: stripInline(headingMatch[2]) });
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
      blocks.push({ type: 'blockquote', text: qLines.map(stripInline).join('\n') });
      continue;
    }

    // Unordered list
    if (trimmed.match(/^[-*+]\s+/)) {
      blocks.push({ type: 'list-item', ordered: false, text: stripInline(trimmed.replace(/^[-*+]\s+/, '')) });
      i++;
      continue;
    }

    // Ordered list
    if (trimmed.match(/^\d+\.\s+/)) {
      blocks.push({ type: 'list-item', ordered: true, text: stripInline(trimmed.replace(/^\d+\.\s+/, '')) });
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
    blocks.push({ type: 'paragraph', text: stripInline(trimmed) });
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
        children.push(new Paragraph({
          children: [new TextRun({ text: block.text || '', color: '999999', size: 18 })],
          spacing: { before: 400, after: 200 },
        }));
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

export async function exportToPdf(title: string, content: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const blocks = parseMarkdownBlocks(content);

  const mL = 15, mR = 15, mT = 20, mB = 20;
  const pW = doc.internal.pageSize.getWidth();
  const pH = doc.internal.pageSize.getHeight();
  const usable = pW - mL - mR;
  const lh = 7, fs = 11;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, mL, mT);
  doc.setFontSize(fs);
  doc.setFont('helvetica', 'normal');

  let y = mT + 12;

  function checkPage(needed: number) {
    if (y + needed > pH - mB) { doc.addPage(); y = mT; }
  }

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const sizes: Record<number, number> = { 1: 18, 2: 15, 3: 13, 4: 12, 5: 11, 6: 11 };
        const sz = sizes[block.level || 1] || 12;
        checkPage(sz);
        doc.setFontSize(sz);
        doc.setFont('helvetica', 'bold');
        doc.text(block.text || '', mL, y);
        doc.setFontSize(fs);
        doc.setFont('helvetica', 'normal');
        y += sz * 0.6 + 4;
        break;
      }
      case 'table': {
        if (block.rows && block.rows.length > 0) {
          const head = [block.rows[0]];
          const body = block.rows.slice(1);
          (doc as any).autoTable({
            startY: y,
            head,
            body,
            margin: { left: mL, right: mR },
            styles: { fontSize: 9, cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.3 },
            headStyles: { fillColor: [232, 237, 245], textColor: [30, 30, 30], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 249] },
            theme: 'grid',
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }
        break;
      }
      case 'list-item': {
        checkPage(lh);
        const prefix = block.ordered ? '•  ' : '•  ';
        const wrapped = doc.splitTextToSize(prefix + (block.text || ''), usable - 6) as string[];
        for (const wl of wrapped) { checkPage(lh); doc.text(wl, mL + 4, y); y += lh; }
        break;
      }
      case 'blockquote': {
        checkPage(lh);
        doc.setTextColor(120, 120, 120);
        doc.setFont('helvetica', 'italic');
        const wrapped = doc.splitTextToSize(block.text || '', usable - 15) as string[];
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.8);
        const startY = y;
        for (const wl of wrapped) { checkPage(lh); doc.text(wl, mL + 8, y); y += lh; }
        doc.line(mL + 3, startY - 4, mL + 3, y - 2);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        y += 3;
        break;
      }
      case 'code': {
        doc.setFont('courier', 'normal');
        doc.setFontSize(9);
        for (const cl of block.lines || []) {
          checkPage(6);
          doc.setFillColor(245, 245, 245);
          doc.rect(mL, y - 4, usable, 6, 'F');
          doc.text(cl, mL + 3, y);
          y += 6;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fs);
        y += 3;
        break;
      }
      case 'separator': {
        checkPage(lh + 4);
        doc.setDrawColor(200, 200, 200);
        doc.line(mL, y + 2, pW - mR, y + 2);
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(9);
        doc.text(block.text || '', mL, y + 6);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(fs);
        y += lh + 4;
        break;
      }
      case 'paragraph': {
        const wrapped = doc.splitTextToSize(block.text || '', usable) as string[];
        for (const wl of wrapped) { checkPage(lh); doc.text(wl, mL, y); y += lh; }
        y += 2;
        break;
      }
      case 'hr': {
        checkPage(6);
        doc.setDrawColor(200, 200, 200);
        doc.line(mL, y, pW - mR, y);
        y += 6;
        break;
      }
      default:
        y += 3;
        break;
    }
  }

  doc.save(`${title}.pdf`);
}
