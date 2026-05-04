import React, { useMemo } from 'react';
import katex from 'katex';

interface MarkdownPreviewProps {
  content: string;
}

// Lightweight Markdown-to-HTML parser — handles tables, headings, lists, bold, italic, code, blockquotes
function parseMarkdown(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let i = 0;
  let inCodeBlock = false;
  let inMathBlock = false;
  let mathContent: string[] = [];
  let codeContent: string[] = [];
  let inList: 'ul' | 'ol' | null = null;

  function closeList() {
    if (inList) {
      html.push(inList === 'ul' ? '</ul>' : '</ol>');
      inList = null;
    }
  }

  function inlineFormat(text: string): string {
    text = escapeHtml(text);
    // Code spans
    text = text.replace(/`([^`]+)`/g, '<code class="md-code-inline">$1</code>');
    
    // Inline Math
    text = text.replace(/\$([^$]+)\$/g, (match, mathStr) => {
      const unescaped = mathStr.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
      try {
        return katex.renderToString(unescaped, { throwOnError: false, displayMode: false });
      } catch(e) {
        return `<code>${mathStr}</code>`;
      }
    });

    // Bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    return text;
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre class="md-code-block"><code>${codeContent.join('\n')}</code></pre>`);
        codeContent = [];
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
      }
      i++;
      continue;
    }
    if (inCodeBlock) {
      codeContent.push(escapeHtml(line));
      i++;
      continue;
    }

    // Math blocks $$
    if (trimmed === '$$') {
      if (inMathBlock) {
        try {
          const htmlStr = katex.renderToString(mathContent.join('\n'), { displayMode: true, throwOnError: false });
          html.push(`<div class="md-math-block overflow-x-auto py-2">${htmlStr}</div>`);
        } catch(e) {
          html.push(`<div class="md-math-error text-red-500">${escapeHtml(mathContent.join('\n'))}</div>`);
        }
        mathContent = [];
        inMathBlock = false;
      } else {
        closeList();
        inMathBlock = true;
      }
      i++;
      continue;
    }
    if (inMathBlock) {
      mathContent.push(line);
      i++;
      continue;
    }

    // Raw LaTeX begin{...} blocks
    if (trimmed.startsWith('\\begin{')) {
      closeList();
      const mathLines = [line];
      const beginType = trimmed.match(/^\\begin\{([^}]+)\}/)?.[1];
      i++;
      while(i < lines.length && !lines[i].trim().startsWith(`\\end{${beginType}}`)) {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        mathLines.push(lines[i]);
        i++;
      }
      try {
        const htmlStr = katex.renderToString(mathLines.join('\n'), { displayMode: true, throwOnError: false });
        html.push(`<div class="md-math-block overflow-x-auto py-2">${htmlStr}</div>`);
      } catch(e) {
        html.push(`<div class="md-math-error text-red-500">${escapeHtml(mathLines.join('\n'))}</div>`);
      }
      continue;
    }

    // Page separator
    if (trimmed.match(/^--- Page \d+ ---$/)) {
      closeList();
      const pageNum = trimmed.match(/\d+/)?.[0] || '';
      html.push(`<div class="md-page-separator"><span>Page ${pageNum}</span></div>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (trimmed.match(/^(---|\*\*\*|___)$/)) {
      closeList();
      html.push('<hr class="md-hr" />');
      i++;
      continue;
    }

    // Table detection: current line has | and next line is separator like |---|---|
    if (trimmed.includes('|') && i + 1 < lines.length && lines[i + 1].trim().match(/^\|?[\s\-:|]+\|/)) {
      closeList();
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      html.push(parseTable(tableLines));
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      html.push(`<h${level} class="md-h${level}">${inlineFormat(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      closeList();
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      html.push(`<blockquote class="md-blockquote">${quoteLines.map(l => inlineFormat(l)).join('<br/>')}</blockquote>`);
      continue;
    }

    // Unordered list
    if (trimmed.match(/^[-*+]\s+/)) {
      if (inList !== 'ul') {
        closeList();
        html.push('<ul class="md-ul">');
        inList = 'ul';
      }
      html.push(`<li>${inlineFormat(trimmed.replace(/^[-*+]\s+/, ''))}</li>`);
      i++;
      continue;
    }

    // Ordered list
    if (trimmed.match(/^\d+\.\s+/)) {
      if (inList !== 'ol') {
        closeList();
        html.push('<ol class="md-ol">');
        inList = 'ol';
      }
      html.push(`<li>${inlineFormat(trimmed.replace(/^\d+\.\s+/, ''))}</li>`);
      i++;
      continue;
    }

    // Empty line
    if (trimmed === '') {
      closeList();
      i++;
      continue;
    }

    // Regular paragraph
    closeList();
    html.push(`<p class="md-paragraph">${inlineFormat(trimmed)}</p>`);
    i++;
  }

  closeList();

  // Close any unclosed code block
  if (inCodeBlock && codeContent.length > 0) {
    html.push(`<pre class="md-code-block"><code>${codeContent.join('\n')}</code></pre>`);
  }

  return html.join('\n');
}

function parseTable(tableLines: string[]): string {
  if (tableLines.length < 2) return `<p>${tableLines.join('<br/>')}</p>`;

  const parseRow = (row: string): string[] => {
    return row
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(cell => cell.trim());
  };

  const headerCells = parseRow(tableLines[0]);

  // Detect alignment from separator row
  const sepCells = parseRow(tableLines[1]);
  const alignments = sepCells.map(cell => {
    const t = cell.trim();
    if (t.startsWith(':') && t.endsWith(':')) return 'center';
    if (t.endsWith(':')) return 'right';
    return 'left';
  });

  const bodyRows = tableLines.slice(2).filter(l => !l.trim().match(/^\|?[\s\-:|]+\|?$/));

  let html = '<div class="md-table-wrapper"><table class="md-table">';

  // Header
  html += '<thead><tr>';
  headerCells.forEach((cell, idx) => {
    const align = alignments[idx] || 'left';
    html += `<th style="text-align:${align}">${inlineFormatStatic(cell)}</th>`;
  });
  html += '</tr></thead>';

  // Body
  if (bodyRows.length > 0) {
    html += '<tbody>';
    bodyRows.forEach((row, rowIdx) => {
      const cells = parseRow(row);
      html += `<tr class="${rowIdx % 2 === 1 ? 'md-table-stripe' : ''}">`;
      headerCells.forEach((_, idx) => {
        const align = alignments[idx] || 'left';
        const cell = cells[idx] || '';
        html += `<td style="text-align:${align}">${inlineFormatStatic(cell)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
  }

  html += '</table></div>';
  return html;
}

function inlineFormatStatic(text: string): string {
  text = escapeHtml(text);
  text = text.replace(/`([^`]+)`/g, '<code class="md-code-inline">$1</code>');
  text = text.replace(/\$([^$]+)\$/g, (match, mathStr) => {
    const unescaped = mathStr.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    try {
      return katex.renderToString(unescaped, { throwOnError: false, displayMode: false });
    } catch(e) {
      return `<code>${mathStr}</code>`;
    }
  });
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.*?)_/g, '<em>$1</em>');
  return text;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div
      className="md-preview"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
