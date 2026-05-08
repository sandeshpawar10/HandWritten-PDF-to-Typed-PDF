// import React, { useMemo } from 'react';
// import katex from 'katex';

// interface MarkdownPreviewProps {
//   content: string;
// }

// // Lightweight Markdown-to-HTML parser — handles tables, headings, lists, bold, italic, code, blockquotes
// function parseMarkdown(md: string): string {
//   const lines = md.split('\n');
//   const html: string[] = [];
//   let i = 0;
//   let inCodeBlock = false;
//   let inMathBlock = false;
//   let mathContent: string[] = [];
//   let codeContent: string[] = [];
//   let inList: 'ul' | 'ol' | null = null;

//   function closeList() {
//     if (inList) {
//       html.push(inList === 'ul' ? '</ul>' : '</ol>');
//       inList = null;
//     }
//   }

//   function inlineFormat(text: string): string {
//     text = escapeHtml(text);
//     // Code spans
//     text = text.replace(/`([^`]+)`/g, '<code class="md-code-inline">$1</code>');
    
//     // Inline Math
//     text = text.replace(/\$([^$]+)\$/g, (match, mathStr) => {
//       const unescaped = mathStr.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
//       try {
//         return katex.renderToString(unescaped, { throwOnError: false, displayMode: false });
//       } catch(e) {
//         return `<code>${mathStr}</code>`;
//       }
//     });

//     // Bold
//     text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
//     text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
//     // Italic
//     text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
//     text = text.replace(/_(.*?)_/g, '<em>$1</em>');
//     return text;
//   }

//   while (i < lines.length) {
//     const line = lines[i];
//     const trimmed = line.trim();

//     // Code blocks
//     if (trimmed.startsWith('```')) {
//       if (inCodeBlock) {
//         html.push(`<pre class="md-code-block"><code>${codeContent.join('\n')}</code></pre>`);
//         codeContent = [];
//         inCodeBlock = false;
//       } else {
//         closeList();
//         inCodeBlock = true;
//       }
//       i++;
//       continue;
//     }
//     if (inCodeBlock) {
//       codeContent.push(escapeHtml(line));
//       i++;
//       continue;
//     }

//     // Math blocks $$
//     if (trimmed === '$$') {
//       if (inMathBlock) {
//         try {
//           const htmlStr = katex.renderToString(mathContent.join('\n'), { displayMode: true, throwOnError: false });
//           html.push(`<div class="md-math-block overflow-x-auto py-2">${htmlStr}</div>`);
//         } catch(e) {
//           html.push(`<div class="md-math-error text-red-500">${escapeHtml(mathContent.join('\n'))}</div>`);
//         }
//         mathContent = [];
//         inMathBlock = false;
//       } else {
//         closeList();
//         inMathBlock = true;
//       }
//       i++;
//       continue;
//     }
//     if (inMathBlock) {
//       mathContent.push(line);
//       i++;
//       continue;
//     }

//     // Raw LaTeX begin{...} blocks
//     if (trimmed.startsWith('\\begin{')) {
//       closeList();
//       const mathLines = [line];
//       const beginType = trimmed.match(/^\\begin\{([^}]+)\}/)?.[1];
//       i++;
//       while(i < lines.length && !lines[i].trim().startsWith(`\\end{${beginType}}`)) {
//         mathLines.push(lines[i]);
//         i++;
//       }
//       if (i < lines.length) {
//         mathLines.push(lines[i]);
//         i++;
//       }
//       try {
//         const htmlStr = katex.renderToString(mathLines.join('\n'), { displayMode: true, throwOnError: false });
//         html.push(`<div class="md-math-block overflow-x-auto py-2">${htmlStr}</div>`);
//       } catch(e) {
//         html.push(`<div class="md-math-error text-red-500">${escapeHtml(mathLines.join('\n'))}</div>`);
//       }
//       continue;
//     }

//     // Page separator
//     if (trimmed.match(/^--- Page \d+ ---$/)) {
//       closeList();
//       const pageNum = trimmed.match(/\d+/)?.[0] || '';
//       html.push(`<div class="md-page-separator"><span>Page ${pageNum}</span></div>`);
//       i++;
//       continue;
//     }

//     // Horizontal rule
//     if (trimmed.match(/^(---|\*\*\*|___)$/)) {
//       closeList();
//       html.push('<hr class="md-hr" />');
//       i++;
//       continue;
//     }

//     // Table detection: current line has | and next line is separator like |---|---|
//     if (trimmed.includes('|') && i + 1 < lines.length && lines[i + 1].trim().match(/^\|?[\s\-:|]+\|/)) {
//       closeList();
//       const tableLines: string[] = [];
//       while (i < lines.length && lines[i].trim().includes('|')) {
//         tableLines.push(lines[i].trim());
//         i++;
//       }
//       html.push(parseTable(tableLines));
//       continue;
//     }

//     // Headings
//     const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
//     if (headingMatch) {
//       closeList();
//       const level = headingMatch[1].length;
//       html.push(`<h${level} class="md-h${level}">${inlineFormat(headingMatch[2])}</h${level}>`);
//       i++;
//       continue;
//     }

//     // Blockquote
//     if (trimmed.startsWith('>')) {
//       closeList();
//       const quoteLines: string[] = [];
//       while (i < lines.length && lines[i].trim().startsWith('>')) {
//         quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
//         i++;
//       }
//       html.push(`<blockquote class="md-blockquote">${quoteLines.map(l => inlineFormat(l)).join('<br/>')}</blockquote>`);
//       continue;
//     }

//     // Unordered list
//     if (trimmed.match(/^[-*+]\s+/)) {
//       if (inList !== 'ul') {
//         closeList();
//         html.push('<ul class="md-ul">');
//         inList = 'ul';
//       }
//       html.push(`<li>${inlineFormat(trimmed.replace(/^[-*+]\s+/, ''))}</li>`);
//       i++;
//       continue;
//     }

//     // Ordered list
//     if (trimmed.match(/^\d+\.\s+/)) {
//       if (inList !== 'ol') {
//         closeList();
//         html.push('<ol class="md-ol">');
//         inList = 'ol';
//       }
//       html.push(`<li>${inlineFormat(trimmed.replace(/^\d+\.\s+/, ''))}</li>`);
//       i++;
//       continue;
//     }

//     // Empty line
//     if (trimmed === '') {
//       closeList();
//       i++;
//       continue;
//     }

//     // Regular paragraph
//     closeList();
//     html.push(`<p class="md-paragraph">${inlineFormat(trimmed)}</p>`);
//     i++;
//   }

//   closeList();

//   // Close any unclosed code block
//   if (inCodeBlock && codeContent.length > 0) {
//     html.push(`<pre class="md-code-block"><code>${codeContent.join('\n')}</code></pre>`);
//   }

//   return html.join('\n');
// }

// function parseTable(tableLines: string[]): string {
//   if (tableLines.length < 2) return `<p>${tableLines.join('<br/>')}</p>`;

//   const parseRow = (row: string): string[] => {
//     return row
//       .replace(/^\|/, '')
//       .replace(/\|$/, '')
//       .split('|')
//       .map(cell => cell.trim());
//   };

//   const headerCells = parseRow(tableLines[0]);

//   // Detect alignment from separator row
//   const sepCells = parseRow(tableLines[1]);
//   const alignments = sepCells.map(cell => {
//     const t = cell.trim();
//     if (t.startsWith(':') && t.endsWith(':')) return 'center';
//     if (t.endsWith(':')) return 'right';
//     return 'left';
//   });

//   const bodyRows = tableLines.slice(2).filter(l => !l.trim().match(/^\|?[\s\-:|]+\|?$/));

//   let html = '<div class="md-table-wrapper"><table class="md-table">';

//   // Header
//   html += '<thead><tr>';
//   headerCells.forEach((cell, idx) => {
//     const align = alignments[idx] || 'left';
//     html += `<th style="text-align:${align}">${inlineFormatStatic(cell)}</th>`;
//   });
//   html += '</tr></thead>';

//   // Body
//   if (bodyRows.length > 0) {
//     html += '<tbody>';
//     bodyRows.forEach((row, rowIdx) => {
//       const cells = parseRow(row);
//       html += `<tr class="${rowIdx % 2 === 1 ? 'md-table-stripe' : ''}">`;
//       headerCells.forEach((_, idx) => {
//         const align = alignments[idx] || 'left';
//         const cell = cells[idx] || '';
//         html += `<td style="text-align:${align}">${inlineFormatStatic(cell)}</td>`;
//       });
//       html += '</tr>';
//     });
//     html += '</tbody>';
//   }

//   html += '</table></div>';
//   return html;
// }

// function inlineFormatStatic(text: string): string {
//   text = escapeHtml(text);
//   text = text.replace(/`([^`]+)`/g, '<code class="md-code-inline">$1</code>');
//   text = text.replace(/\$([^$]+)\$/g, (match, mathStr) => {
//     const unescaped = mathStr.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
//     try {
//       return katex.renderToString(unescaped, { throwOnError: false, displayMode: false });
//     } catch(e) {
//       return `<code>${mathStr}</code>`;
//     }
//   });
//   text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
//   text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
//   text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
//   text = text.replace(/_(.*?)_/g, '<em>$1</em>');
//   return text;
// }

// function escapeHtml(str: string): string {
//   return str
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')
//     .replace(/"/g, '&quot;');
// }

// export function MarkdownPreview({ content }: MarkdownPreviewProps) {
//   const html = useMemo(() => parseMarkdown(content), [content]);

//   return (
//     <div
//       className="md-preview"
//       dangerouslySetInnerHTML={{ __html: html }}
//     />
//   );
// }







import React, { useMemo } from 'react';
import katex from 'katex';
// katex/dist/katex.min.css is imported globally in main.tsx

interface MarkdownPreviewProps { content: string; }

// ─────────────────────────────────────────────
//  HTML escape (for non-math text only)
// ─────────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────
//  KaTeX renderer helpers
// ─────────────────────────────────────────────
function renderInlineMath(tex: string): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode: false, output: "html" });
  } catch {
    return `<code class="md-code-inline">${escapeHtml(tex)}</code>`;
  }
}

function renderDisplayMath(tex: string): string {
  try {
    return `<div class="md-math-block">${katex.renderToString(tex, { throwOnError: false, displayMode: true, output: "html" })}</div>`;
  } catch {
    return `<pre class="md-code-block"><code>${escapeHtml(tex)}</code></pre>`;
  }
}

// ─────────────────────────────────────────────
//  Inline formatter
//  ORDER IS CRITICAL:
//    1. Extract math segments FIRST (before any escaping)
//    2. Escape HTML on plain-text segments only
//    3. Apply bold/italic/code on plain segments
// ─────────────────────────────────────────────
function inlineFormat(raw: string): string {
  // Tokenise the line into math and non-math segments
  // Pattern: $$...$$ (display, inline occurrence) | $...$ (inline)
  const segments: Array<{ type: "math-display" | "math-inline" | "text"; content: string }> = [];
  let rest = raw;

  // We'll do a single-pass extraction using a regex that captures both delimiters
  const mathRe = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = mathRe.exec(raw)) !== null) {
    if (m.index > lastIdx) {
      segments.push({ type: "text", content: raw.slice(lastIdx, m.index) });
    }
    const token = m[1];
    if (token.startsWith("$$")) {
      segments.push({ type: "math-display", content: token.slice(2, -2).trim() });
    } else {
      segments.push({ type: "math-inline", content: token.slice(1, -1).trim() });
    }
    lastIdx = m.index + token.length;
  }
  if (lastIdx < raw.length) {
    segments.push({ type: "text", content: raw.slice(lastIdx) });
  }

  return segments.map(seg => {
    if (seg.type === "math-inline")   return renderInlineMath(seg.content);
    if (seg.type === "math-display")  return renderDisplayMath(seg.content);

    // Plain text segment — escape then apply Markdown formatting
    let t = escapeHtml(seg.content);
    // Inline code (before bold/italic so backticks aren't processed inside)
    t = t.replace(/`([^`]+)`/g, '<code class="md-code-inline">$1</code>');
    // Bold+italic ***
    t = t.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    // Bold **text** or __text__  (non-greedy, no newlines)
    t = t.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/__([^_\n]+?)__/g,     "<strong>$1</strong>");
    // Italic *text* or _text_  — guard against math underscores
    t = t.replace(/\*([^*\n]+?)\*/g, "<em>$1</em>");
    t = t.replace(/(?<![a-zA-Z0-9])_([^_\n]+?)_(?![a-zA-Z0-9])/g, "<em>$1</em>");
    // Links
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link" target="_blank" rel="noreferrer">$1</a>');
    return t;
  }).join("");
}

// ─────────────────────────────────────────────
//  Table parser
// ─────────────────────────────────────────────
function parseTable(tableLines: string[]): string {
  if (tableLines.length < 2) return `<p class="md-paragraph">${tableLines.map(l => inlineFormat(l)).join("<br/>")}</p>`;
  const parseRow = (row: string) =>
    row.replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());

  const headers = parseRow(tableLines[0]);
  const aligns  = parseRow(tableLines[1]).map(c => {
    if (c.startsWith(":") && c.endsWith(":")) return "center";
    if (c.endsWith(":"))   return "right";
    return "left";
  });
  const bodyRows = tableLines.slice(2).filter(l => !l.trim().match(/^\|?[\s\-:|]+\|?$/));

  let html = '<div class="md-table-wrapper"><table class="md-table"><thead><tr>';
  headers.forEach((h, i) => {
    html += `<th style="text-align:${aligns[i] || "left"}">${inlineFormat(h)}</th>`;
  });
  html += "</tr></thead>";

  if (bodyRows.length > 0) {
    html += "<tbody>";
    bodyRows.forEach((row, ri) => {
      const cells = parseRow(row);
      html += `<tr class="${ri % 2 === 1 ? "md-table-stripe" : ""}">`;
      headers.forEach((_, i) => {
        html += `<td style="text-align:${aligns[i] || "left"}">${inlineFormat(cells[i] || "")}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody>";
  }
  return html + "</table></div>";
}

// ─────────────────────────────────────────────
//  Main parser
// ─────────────────────────────────────────────
function parseMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  let inCodeBlock  = false;
  let codeContent: string[] = [];
  let codeLang     = "";
  let inMathBlock  = false;
  let mathContent: string[] = [];
  let inList: "ul" | "ol" | null = null;

  const closeList = () => {
    if (inList) { out.push(inList === "ul" ? "</ul>" : "</ol>"); inList = null; }
  };

  while (i < lines.length) {
    const line    = lines[i];
    const trimmed = line.trim();

    // ── Fenced code block ──
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        out.push(`<pre class="md-code-block"><code${codeLang ? ` class="language-${escapeHtml(codeLang)}"` : ""}>${codeContent.join("\n")}</code></pre>`);
        codeContent = []; codeLang = ""; inCodeBlock = false;
      } else {
        closeList();
        codeLang = trimmed.slice(3).trim();
        inCodeBlock = true;
      }
      i++; continue;
    }
    if (inCodeBlock) { codeContent.push(escapeHtml(line)); i++; continue; }

    // ── Display math block $$ ... $$ ──
    if (trimmed === "$$") {
      if (inMathBlock) {
        out.push(renderDisplayMath(mathContent.join("\n")));
        mathContent = []; inMathBlock = false;
      } else {
        closeList(); inMathBlock = true;
      }
      i++; continue;
    }
    if (inMathBlock) { mathContent.push(line); i++; continue; }

    // ── Raw LaTeX \begin{...} ... \end{...} ──
    if (trimmed.startsWith("\\begin{")) {
      closeList();
      const envName = trimmed.match(/^\\begin\{([^}]+)\}/)?.[1] ?? "";
      const mathLines = [line]; i++;
      while (i < lines.length && !lines[i].trim().startsWith(`\\end{${envName}}`)) {
        mathLines.push(lines[i]); i++;
      }
      if (i < lines.length) { mathLines.push(lines[i]); i++; }
      out.push(renderDisplayMath(mathLines.join("\n")));
      continue;
    }

    // ── Page separator ──
    if (trimmed.match(/^---\s*Page\s+\d+\s*---$/i)) {
      closeList();
      const n = trimmed.match(/\d+/)?.[0] ?? "";
      out.push(`<div class="md-page-separator"><span>Page ${n}</span></div>`);
      i++; continue;
    }

    // ── Horizontal rule ──
    if (trimmed.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      closeList();
      out.push('<hr class="md-hr" />');
      i++; continue;
    }

    // ── Table ──
    if (trimmed.includes("|") && i + 1 < lines.length && lines[i + 1].trim().match(/^\|?[\s\-:|]+\|/)) {
      closeList();
      const tLines: string[] = [];
      while (i < lines.length && lines[i].trim().includes("|")) { tLines.push(lines[i].trim()); i++; }
      out.push(parseTable(tLines));
      continue;
    }

    // ── Heading ──
    const hm = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      closeList();
      const lvl = hm[1].length;
      out.push(`<h${lvl} class="md-h${lvl}">${inlineFormat(hm[2])}</h${lvl}>`);
      i++; continue;
    }

    // ── Blockquote ──
    if (trimmed.startsWith(">")) {
      closeList();
      const qLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        qLines.push(lines[i].trim().replace(/^>\s?/, "")); i++;
      }
      out.push(`<blockquote class="md-blockquote">${qLines.map(inlineFormat).join("<br/>")}</blockquote>`);
      continue;
    }

    // ── Unordered list ──
    const ulm = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (ulm) {
      if (inList !== "ul") { closeList(); out.push('<ul class="md-ul">'); inList = "ul"; }
      out.push(`<li>${inlineFormat(ulm[2])}</li>`);
      i++; continue;
    }

    // ── Ordered list ──
    const olm = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olm) {
      if (inList !== "ol") { closeList(); out.push('<ol class="md-ol">'); inList = "ol"; }
      out.push(`<li>${inlineFormat(olm[2])}</li>`);
      i++; continue;
    }

    // ── Empty line ──
    if (trimmed === "") { closeList(); i++; continue; }

    // ── Paragraph (collect consecutive plain lines) ──
    closeList();
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().match(/^#{1,6}\s/) &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith("$$") &&
      !lines[i].trim().startsWith("\\begin{") &&
      !lines[i].trim().startsWith(">") &&
      !lines[i].trim().match(/^[-*+]\s/) &&
      !lines[i].trim().match(/^\d+\.\s/) &&
      !lines[i].trim().match(/^\|?[\s\-:|]+\|/) &&
      !lines[i].trim().match(/^(-{3,}|\*{3,}|_{3,})$/) &&
      !lines[i].trim().match(/^---\s*Page\s+\d+\s*---$/i) &&
      !(lines[i].trim().includes("|") && i + 1 < lines.length && lines[i + 1]?.trim().match(/^\|?[\s\-:|]+\|/))
    ) {
      pLines.push(lines[i].trim()); i++;
    }
    if (pLines.length > 0) {
      out.push(`<p class="md-paragraph">${pLines.map(inlineFormat).join(" ")}</p>`);
    } else {
      // Safeguard against infinite loops: if a line bypassed all block parsers 
      // but also failed the paragraph condition (e.g. a rogue table separator), force it.
      out.push(`<p class="md-paragraph">${inlineFormat(lines[i].trim())}</p>`);
      i++;
    }
  }

  closeList();
  if (inCodeBlock && codeContent.length > 0)
    out.push(`<pre class="md-code-block"><code>${codeContent.join("\n")}</code></pre>`);
  if (inMathBlock && mathContent.length > 0)
    out.push(renderDisplayMath(mathContent.join("\n")));

  return out.join("\n");
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = useMemo(() => parseMarkdown(content), [content]);
  return <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}
