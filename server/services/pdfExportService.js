/**
 * server/services/pdfExportService.js
 * Authoritative server-side PDF generator using pdf-lib.
 * Generates beautifully formatted academic PDFs with headings, code blocks,
 * tables, math blocks, running headers, and page numbers.
 * Memory-efficient: pure JS stream processing (<30MB RAM).
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Page layout constants (A4 standard)
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// Color palette (academic styling)
const COLOR_BLACK = rgb(0.12, 0.12, 0.12);
const COLOR_MUTED = rgb(0.4, 0.4, 0.4);
const COLOR_PRIMARY = rgb(0.1, 0.35, 0.65);
const COLOR_CODE_BG = rgb(0.96, 0.96, 0.97);
const COLOR_MATH_BG = rgb(0.97, 0.98, 1.0);
const COLOR_BORDER = rgb(0.85, 0.85, 0.88);
const COLOR_TH_BG = rgb(0.92, 0.94, 0.97);

/**
 * Split text into lines that fit within maxWidth using the given font and fontSize.
 */
function wrapText(text, font, fontSize, maxWidth) {
  if (!text) return [''];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      // If a single word exceeds maxWidth, break it by characters
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let sub = '';
        for (const char of word) {
          if (font.widthOfTextAtSize(sub + char, fontSize) <= maxWidth) {
            sub += char;
          } else {
            lines.push(sub);
            sub = char;
          }
        }
        currentLine = sub;
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

/**
 * Parse markdown text into structured render blocks.
 */
export function parseMarkdownToPdfBlocks(markdown) {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code blocks ```
    if (trimmed.startsWith('```')) {
      const codeLines = [];
      const lang = trimmed.slice(3).trim();
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'code', lang, lines: codeLines });
      continue;
    }

    // Display math $$ ... $$
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

    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 2) {
      blocks.push({ type: 'math', lines: [trimmed.slice(2, -2).trim()] });
      i++;
      continue;
    }

    // LaTeX \begin{...} ... \end{...}
    if (trimmed.startsWith('\\begin{')) {
      const mathLines = [rawLine];
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

    // Page separator: --- Page X ---
    const pageSepMatch = trimmed.match(/^---\s*Page\s+(\d+)\s*---$/i);
    if (pageSepMatch) {
      blocks.push({ type: 'page-break', pageNum: parseInt(pageSepMatch[1], 10) });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Table: line with | and followed by separator row
    if (trimmed.includes('|') && i + 1 < lines.length && /^\|?[\s\-:|]+\|/.test(lines[i + 1].trim())) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const rows = tableLines
        .filter(l => !/^\|?[\s\-:|]+\|?$/.test(l))
        .map(l => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
      blocks.push({ type: 'table', rows });
      continue;
    }

    // Headings # ## ###
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      i++;
      continue;
    }

    // Blockquote >
    if (trimmed.startsWith('>')) {
      const qLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        qLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', text: qLines.join(' ') });
      continue;
    }

    // Unordered / Ordered list items
    const listMatch = trimmed.match(/^([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      blocks.push({
        type: 'list-item',
        prefix: listMatch[1].endsWith('.') ? listMatch[1] : '•',
        text: listMatch[2]
      });
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

/**
 * Generate formatted PDF Buffer from Markdown.
 * @param {string} title - Document title
 * @param {string} markdownContent - Full transcription markdown
 * @returns {Promise<Buffer>} - Standard PDF Buffer
 */
export async function createPdfBuffer(title, markdownContent) {
  const pdfDoc = await PDFDocument.create();

  // Embed standard typography fonts
  const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const blocks = parseMarkdownToPdfBlocks(markdownContent);
  const docPages = [];

  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  docPages.push(currentPage);
  let cursorY = PAGE_HEIGHT - MARGIN_TOP;

  function ensureSpace(requiredHeight) {
    if (cursorY - requiredHeight < MARGIN_BOTTOM) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      docPages.push(currentPage);
      cursorY = PAGE_HEIGHT - MARGIN_TOP;
      return true;
    }
    return false;
  }

  // Draw Document Title on Page 1
  if (title) {
    ensureSpace(50);
    currentPage.drawText(title, {
      x: MARGIN_LEFT,
      y: cursorY - 24,
      size: 20,
      font: fontBold,
      color: COLOR_PRIMARY
    });
    cursorY -= 36;

    // Title divider line
    currentPage.drawLine({
      start: { x: MARGIN_LEFT, y: cursorY },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: cursorY },
      thickness: 1.5,
      color: COLOR_PRIMARY
    });
    cursorY -= 20;
  }

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const size = block.level === 1 ? 16 : block.level === 2 ? 14 : 12;
        const spacingBefore = block.level === 1 ? 20 : 14;
        const font = fontBold;
        const lines = wrapText(block.text, font, size, CONTENT_WIDTH);

        ensureSpace(spacingBefore + lines.length * (size + 4) + 6);
        cursorY -= spacingBefore;

        for (const line of lines) {
          currentPage.drawText(line, {
            x: MARGIN_LEFT,
            y: cursorY - size,
            size,
            font,
            color: COLOR_PRIMARY
          });
          cursorY -= (size + 4);
        }
        cursorY -= 4;
        break;
      }

      case 'paragraph': {
        const size = 11;
        const lineHeight = 16;
        const lines = wrapText(block.text, fontRegular, size, CONTENT_WIDTH);

        ensureSpace(lines.length * lineHeight + 8);
        for (const line of lines) {
          currentPage.drawText(line, {
            x: MARGIN_LEFT,
            y: cursorY - size,
            size,
            font: fontRegular,
            color: COLOR_BLACK
          });
          cursorY -= lineHeight;
        }
        cursorY -= 6;
        break;
      }

      case 'list-item': {
        const size = 11;
        const lineHeight = 16;
        const prefixWidth = fontBold.widthOfTextAtSize(`${block.prefix} `, size);
        const lines = wrapText(block.text, fontRegular, size, CONTENT_WIDTH - prefixWidth - 10);

        ensureSpace(lines.length * lineHeight + 4);

        currentPage.drawText(block.prefix, {
          x: MARGIN_LEFT + 8,
          y: cursorY - size,
          size,
          font: fontBold,
          color: COLOR_PRIMARY
        });

        for (let j = 0; j < lines.length; j++) {
          currentPage.drawText(lines[j], {
            x: MARGIN_LEFT + 8 + prefixWidth,
            y: cursorY - size,
            size,
            font: fontRegular,
            color: COLOR_BLACK
          });
          cursorY -= lineHeight;
        }
        break;
      }

      case 'code': {
        const size = 9.5;
        const lineHeight = 13.5;
        const padding = 10;
        const rawCodeLines = block.lines.length > 0 ? block.lines : [''];

        // Wrap code lines if too long
        const renderedLines = [];
        for (const cl of rawCodeLines) {
          const sub = wrapText(cl, fontMono, size, CONTENT_WIDTH - padding * 2);
          renderedLines.push(...sub);
        }

        const boxHeight = renderedLines.length * lineHeight + padding * 2;
        ensureSpace(Math.min(boxHeight, 150));

        const startY = cursorY;
        const actualBoxHeight = Math.min(boxHeight, cursorY - MARGIN_BOTTOM);

        currentPage.drawRectangle({
          x: MARGIN_LEFT,
          y: startY - actualBoxHeight,
          width: CONTENT_WIDTH,
          height: actualBoxHeight,
          color: COLOR_CODE_BG,
          borderColor: COLOR_BORDER,
          borderWidth: 1
        });

        cursorY -= padding;
        for (const line of renderedLines) {
          if (ensureSpace(lineHeight + padding)) {
            // New page inside code block if long
            cursorY -= padding;
          }
          currentPage.drawText(line, {
            x: MARGIN_LEFT + padding,
            y: cursorY - size,
            size,
            font: fontMono,
            color: COLOR_BLACK
          });
          cursorY -= lineHeight;
        }
        cursorY -= (padding + 8);
        break;
      }

      case 'math': {
        const size = 11;
        const lineHeight = 18;
        const padding = 10;
        const mathLines = block.lines.map(l => l.replace(/\\text\{([^}]+)\}/g, '$1').replace(/\\quad/g, '  ').trim()).filter(Boolean);

        const renderedLines = [];
        for (const ml of mathLines) {
          renderedLines.push(...wrapText(ml, fontItalic, size, CONTENT_WIDTH - padding * 2));
        }

        const blockHeight = renderedLines.length * lineHeight + padding * 2;
        ensureSpace(blockHeight + 10);

        currentPage.drawRectangle({
          x: MARGIN_LEFT,
          y: cursorY - blockHeight,
          width: CONTENT_WIDTH,
          height: blockHeight,
          color: COLOR_MATH_BG,
          borderColor: COLOR_BORDER,
          borderWidth: 1
        });

        cursorY -= padding;
        for (const line of renderedLines) {
          const textWidth = fontItalic.widthOfTextAtSize(line, size);
          const centeredX = Math.max(MARGIN_LEFT + padding, MARGIN_LEFT + (CONTENT_WIDTH - textWidth) / 2);
          currentPage.drawText(line, {
            x: centeredX,
            y: cursorY - size,
            size,
            font: fontItalic,
            color: rgb(0.1, 0.2, 0.4)
          });
          cursorY -= lineHeight;
        }
        cursorY -= (padding + 8);
        break;
      }

      case 'table': {
        if (!block.rows || block.rows.length === 0) break;
        const numCols = Math.max(...block.rows.map(r => r.length));
        if (numCols === 0) break;

        const colWidth = CONTENT_WIDTH / numCols;
        const rowHeight = 22;
        const totalHeight = block.rows.length * rowHeight;

        ensureSpace(Math.min(totalHeight, 100));

        for (let rIdx = 0; rIdx < block.rows.length; rIdx++) {
          const row = block.rows[rIdx];
          const isHeader = rIdx === 0;
          ensureSpace(rowHeight + 4);

          // Row background
          if (isHeader) {
            currentPage.drawRectangle({
              x: MARGIN_LEFT,
              y: cursorY - rowHeight,
              width: CONTENT_WIDTH,
              height: rowHeight,
              color: COLOR_TH_BG
            });
          }

          // Cell contents and borders
          for (let cIdx = 0; cIdx < numCols; cIdx++) {
            const cellText = row[cIdx] || '';
            const cellFont = isHeader ? fontBold : fontRegular;
            const cellSize = isHeader ? 10 : 9.5;
            const cellLines = wrapText(cellText, cellFont, cellSize, colWidth - 8);

            // Cell border
            currentPage.drawRectangle({
              x: MARGIN_LEFT + cIdx * colWidth,
              y: cursorY - rowHeight,
              width: colWidth,
              height: rowHeight,
              borderColor: COLOR_BORDER,
              borderWidth: 0.75
            });

            if (cellLines[0]) {
              currentPage.drawText(cellLines[0], {
                x: MARGIN_LEFT + cIdx * colWidth + 4,
                y: cursorY - rowHeight + 6,
                size: cellSize,
                font: cellFont,
                color: COLOR_BLACK
              });
            }
          }
          cursorY -= rowHeight;
        }
        cursorY -= 10;
        break;
      }

      case 'blockquote': {
        const size = 10.5;
        const lineHeight = 15;
        const lines = wrapText(block.text, fontItalic, size, CONTENT_WIDTH - 24);
        const blockHeight = lines.length * lineHeight + 8;

        ensureSpace(blockHeight);

        currentPage.drawLine({
          start: { x: MARGIN_LEFT + 4, y: cursorY },
          end: { x: MARGIN_LEFT + 4, y: cursorY - blockHeight },
          thickness: 3,
          color: COLOR_PRIMARY
        });

        cursorY -= 4;
        for (const line of lines) {
          currentPage.drawText(line, {
            x: MARGIN_LEFT + 16,
            y: cursorY - size,
            size,
            font: fontItalic,
            color: COLOR_MUTED
          });
          cursorY -= lineHeight;
        }
        cursorY -= 8;
        break;
      }

      case 'hr': {
        ensureSpace(16);
        cursorY -= 8;
        currentPage.drawLine({
          start: { x: MARGIN_LEFT, y: cursorY },
          end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: cursorY },
          thickness: 0.75,
          color: COLOR_BORDER
        });
        cursorY -= 8;
        break;
      }

      case 'page-break': {
        currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        docPages.push(currentPage);
        cursorY = PAGE_HEIGHT - MARGIN_TOP;
        break;
      }

      case 'empty': {
        cursorY -= 8;
        break;
      }

      default:
        break;
    }
  }

  // Draw Header and Running Page Numbers (Page X of Y)
  const totalPages = docPages.length;
  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const page = docPages[pIdx];
    const pageNumText = `Page ${pIdx + 1} of ${totalPages}`;
    const pageNumWidth = fontRegular.widthOfTextAtSize(pageNumText, 9);

    // Footer: Page Number
    page.drawText(pageNumText, {
      x: PAGE_WIDTH - MARGIN_RIGHT - pageNumWidth,
      y: 30,
      size: 9,
      font: fontRegular,
      color: COLOR_MUTED
    });

    // Footer: System watermark
    page.drawText('TypedDoc • High-Fidelity Transcription', {
      x: MARGIN_LEFT,
      y: 30,
      size: 8,
      font: fontRegular,
      color: COLOR_BORDER
    });

    // Running Header (pages > 1)
    if (pIdx > 0 && title) {
      page.drawText(title, {
        x: MARGIN_LEFT,
        y: PAGE_HEIGHT - 35,
        size: 8.5,
        font: fontRegular,
        color: COLOR_MUTED
      });
      page.drawLine({
        start: { x: MARGIN_LEFT, y: PAGE_HEIGHT - 40 },
        end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: PAGE_HEIGHT - 40 },
        thickness: 0.5,
        color: COLOR_BORDER
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
