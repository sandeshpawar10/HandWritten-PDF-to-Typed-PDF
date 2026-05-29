import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MarkdownPreviewProps {
  content: string;
}

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
    if (!katex) return `<code class="md-code-inline">${escapeHtml(tex)}</code>`;
    return katex.renderToString(tex, { 
      throwOnError: false, 
      displayMode: false, 
      output: "html" 
    });
  } catch (err) {
    console.error("KaTeX inline error:", err);
    return `<code class="md-code-inline">${escapeHtml(tex)}</code>`;
  }
}

function renderDisplayMath(tex: string): string {
  const cleanTex = tex.trim();
  if (!cleanTex) return "";
  try {
    if (!katex) return `<div class="md-math-block p-4 bg-slate-50 font-mono text-xs">$$ ${escapeHtml(cleanTex)} $$</div>`;
    return `<div class="md-math-block">${katex.renderToString(cleanTex, { 
      throwOnError: false, 
      displayMode: true, 
      output: "html" 
    })}</div>`;
  } catch (err) {
    console.error("KaTeX display error:", err);
    return `<div class="md-math-block p-4 border border-red-100 bg-red-50/50 text-slate-600 font-mono text-xs whitespace-pre-wrap">$$ ${escapeHtml(cleanTex)} $$</div>`;
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
  if (!raw) return "";
  
  const segments: Array<{ type: "math-display" | "math-inline" | "text"; content: string }> = [];
  
  // Pattern: $$...$$ (display) | $...$ (inline)
  // We use [\s\S]+? to allow multiline math if the input string contains newlines (from paragraph joining)
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
    
    // Bold **text** or __text__  (non-greedy)
    t = t.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/__([^_\n]+?)__/g,     "<strong>$1</strong>");
    
    // Italic *text* or _text_  — guard against math underscores
    t = t.replace(/\*([^*\n]+?)\*/g, "<em>$1</em>");
    t = t.replace(/(?<![a-zA-Z0-9])_([^_\n]+?)_(?![a-zA-Z0-9])/g, "<em>$1</em>");
    
    // Images: Replace ![alt](src) with the actual image if base64 data exists, otherwise show placeholder
    t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
      if (src.startsWith('data:image') || src.startsWith('http')) {
        return `<img src="${src}" alt="${alt}" class="md-image rounded-xl my-6 max-w-full shadow-sm mx-auto block" />`;
      }
      return `
        <div class="md-image-placeholder flex items-center justify-center gap-3 p-4 my-6 mx-auto max-w-sm rounded-2xl bg-slate-100 border border-slate-200 border-dashed text-slate-500 font-bold text-[13px] uppercase tracking-widest shadow-sm">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span>Diagram Omitted</span>
        </div>
      `;
    });

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
  let cleanMd = md;

  const lines = cleanMd.split("\n");
  const out: string[] = [];
  let i = 0;
  
  let inCodeBlock  = false;
  let codeContent: string[] = [];
  let codeLang     = "";
  
  let inMathBlock  = false;
  let mathContent: string[] = [];
  
  let inList: "ul" | "ol" | null = null;

  const closeList = () => {
    if (inList) { 
      out.push(inList === "ul" ? "</ul>" : "</ol>"); 
      inList = null; 
    }
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
    if (inCodeBlock) { codeContent.push(line); i++; continue; }

    // ── Display math block $$ (must be exactly $$ to start/end block mode) ──
    if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length >= 4) {
      closeList();
      out.push(renderDisplayMath(trimmed.slice(2, -2).trim()));
      i++; continue;
    }
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
      const envMatch = trimmed.match(/^\\begin\{([^}]+)\}/);
      const envName = envMatch ? envMatch[1] : "";
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
      lines[i].trim() !== "$$" &&
      !lines[i].trim().match(/^#{1,6}\s/) &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith("\\begin{") &&
      !lines[i].trim().startsWith(">") &&
      !lines[i].trim().match(/^(\s*)[-*+]\s+/) &&
      !lines[i].trim().match(/^(\s*)\d+\.\s+/) &&
      !lines[i].trim().match(/^\|?[\s\-:|]+\|/) &&
      !lines[i].trim().match(/^(-{3,}|\*{3,}|_{3,})$/) &&
      !lines[i].trim().match(/^---\s*Page\s+\d+\s*---$/i) &&
      !(lines[i].trim().includes("|") && i + 1 < lines.length && lines[i + 1]?.trim().match(/^\|?[\s\-:|]+\|/))
    ) {
      pLines.push(lines[i].trim());
      i++;
    }
    
    if (pLines.length > 0) {
      // JOIN LINES FIRST, then apply inline formatting to handle multiline math blocks inside paragraphs
      out.push(`<p class="md-paragraph">${inlineFormat(pLines.join(" "))}</p>`);
    } else {
      // Safety increment for rogue lines
      out.push(`<p class="md-paragraph">${inlineFormat(lines[i].trim())}</p>`);
      i++;
    }
  }

  closeList();
  
  // Handle unclosed blocks
  if (inCodeBlock && codeContent.length > 0) {
    out.push(`<pre class="md-code-block"><code>${codeContent.join("\n")}</code></pre>`);
  }
  if (inMathBlock && mathContent.length > 0) {
    out.push(renderDisplayMath(mathContent.join("\n")));
  }

  return out.join("\n");
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = useMemo(() => parseMarkdown(content), [content]);
  return <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}
