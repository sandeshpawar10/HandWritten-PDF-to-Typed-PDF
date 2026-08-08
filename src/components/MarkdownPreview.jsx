import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ─────────────────────────────────────────────
//  HTML escape (for non-math text only)
// ─────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────
//  KaTeX renderer helpers
// ─────────────────────────────────────────────
function renderInlineMath(tex) {
  try {
    if (!katex) return `<code class="md-code-inline">${escapeHtml(tex)}</code>`;
    return katex.renderToString(tex, {
      throwOnError: true,
      displayMode: false, 
      output: "html" 
    });
  } catch (err) {
    console.error("KaTeX inline error:", err);
    return `<code class="md-code-inline">${escapeHtml(tex)}</code>`;
  }
}

function renderDisplayMath(tex) {
  const cleanTex = tex.trim();
  if (!cleanTex) return "";
  try {
    if (!katex) return `<div class="md-math-block p-4 bg-slate-50 font-mono text-xs">$$ ${escapeHtml(cleanTex)} $$</div>`;
    return `<div class="md-math-block">${katex.renderToString(cleanTex, {
      throwOnError: true,
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
function inlineFormat(raw) {
  if (!raw) return "";
  
  const segments = [];
  
  // Mistral can return either Markdown delimiters ($...$, $$...$$) or
  // standard LaTeX delimiters (\(...\), \[...\]). Support both forms.
  const mathRe = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;
  let lastIdx = 0;
  let m;

  while ((m = mathRe.exec(raw)) !== null) {
    if (m.index > lastIdx) {
      segments.push({ type: "text", content: raw.slice(lastIdx, m.index) });
    }
    const token = m[1];
    if (token.startsWith("$$") || token.startsWith("\\[")) {
      segments.push({ type: "math-display", content: token.slice(2, -2).trim() });
    } else {
      const delimiterLength = token.startsWith("\\(") ? 2 : 1;
      segments.push({ type: "math-inline", content: token.slice(delimiterLength, -delimiterLength).trim() });
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
function parseTable(tableLines) {
  if (tableLines.length < 2) return `<p class="md-paragraph">${tableLines.map(l => inlineFormat(l)).join("<br/>")}</p>`;
  
  const parseRow = (row) =>
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
function parseMarkdown(md) {
  let cleanMd = md;

  const lines = cleanMd.split("\n");
  const out = [];
  let i = 0;
  
  let inCodeBlock  = false;
  let codeContent = [];
  let codeLang     = "";
  
  let inMathBlock  = false;
  let mathContent = [];
  
  let inList = null;

  const closeList = () => {
    if (inList) { 
      out.push(inList === "ul" ? "</ul>" : "</ol>"); 
      inList = null; 
    }
  };

  const isAutoHeading = (text) =>
    /^\d+(?:\.\d+)+\s+.+$/.test(text) ||
    /^(?:[A-Z][A-Za-z0-9&/()'\-]*)(?:\s+[A-Z][A-Za-z0-9&/()'\-]*){0,7}$/.test(text);

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



    // Preserve un-fenced C-like code emitted by OCR, including its line breaks.
    if (/^(?:#include\b|main\s*\(|(?:void|int|float|double|char|bool)\b)/.test(trimmed)) {
      closeList();
      const codeLines = [];
      while (i < lines.length && lines[i].trim() !== "") {
        codeLines.push(lines[i]);
        i++;
      }
      out.push(`<pre class="md-code-block"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    // ── Display math block $$ (multi-line) ──
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

    // Standard LaTex display delimiters can be returned instead of $$...$$.
    if (trimmed === "\\[") {
      closeList();
      const mathLines = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "\\]") {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      out.push(renderDisplayMath(mathLines.join("\n")));
      continue;
    }

    // ── Raw LaTeX \begin{...} ... \end{...} ──
    if (trimmed.startsWith("\\begin{")) {
      closeList();
      const envMatch = trimmed.match(/^\\begin\{([^}]+)\}/);
      const envName = envMatch ? envMatch[1] : "";
      const endMarker = `\\end{${envName}}`;
      const mathLines = [line];

      // A common OCR form has both \begin and \end on the same line. The
      // previous parser ignored that closing marker and consumed every later
      // page as one invalid equation.
      if (envName && trimmed.includes(endMarker)) {
        out.push(renderDisplayMath(line));
        i++;
        continue;
      }

      i++;
      while (
        i < lines.length &&
        !lines[i].trim().includes(endMarker) &&
        !lines[i].trim().match(/^---\s*Page\s+\d+\s*---$/i)
      ) {
        mathLines.push(lines[i]); i++;
      }
      if (i < lines.length && lines[i].trim().includes(endMarker)) {
        mathLines.push(lines[i]);
        i++;
        out.push(renderDisplayMath(mathLines.join("\n")));
      } else {
        // Keep malformed OCR math visible without allowing it to swallow the
        // rest of the document or render as a large red KaTeX error.
        out.push(`<pre class="md-code-block"><code>${escapeHtml(mathLines.join("\n"))}</code></pre>`);
      }
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
      const tLines = [];
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

    // OCR commonly returns numbered headings as plain text, for example
    // "11.3 P, NP, and NP-complete Problems". Render those as section titles.
    const numberedHeading = trimmed.match(/^(\d+(?:\.\d+)+)\s+(.+)$/);
    if (numberedHeading) {
      closeList();
      out.push(`<h2 class="md-h2"><span class="md-section-number">${escapeHtml(numberedHeading[1])}</span> ${inlineFormat(numberedHeading[2])}</h2>`);
      i++; continue;
    }

    // Short Title Case lines are topic headings in handwritten notes.
    if (isAutoHeading(trimmed)) {
      closeList();
      out.push(`<h3 class="md-h3">${inlineFormat(trimmed)}</h3>`);
      i++; continue;
    }

    if (/^Types of Problems\s*:?$/i.test(trimmed)) {
      closeList();
      out.push(`<h3 class="md-h3">${inlineFormat(trimmed.replace(/\s*:?$/, ""))}</h3>`);
      i++; continue;
    }

    // Keep labels such as "Algorithm:", "Program:", and "Input:" distinct
    // from the explanatory text that follows.
    const labelLine = trimmed.match(/^(Algorithm|Program|Pseudocode|Input|Output|Example|Note|Step\s+\d+)\s*:\s*(.+)$/i);
    if (labelLine) {
      closeList();
      out.push(`<p class="md-paragraph"><strong>${escapeHtml(labelLine[1])}:</strong> ${inlineFormat(labelLine[2])}</p>`);
      i++; continue;
    }

    // ── Blockquote ──
    if (trimmed.startsWith(">")) {
      closeList();
      const qLines = [];
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
    const pLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      lines[i].trim() !== "$$" &&
       !lines[i].trim().match(/^#{1,6}\s/) &&
       !isAutoHeading(lines[i].trim()) &&
       !/^(?:#include\b|main\s*\(|(?:void|int|float|double|char|bool)\b)/.test(lines[i].trim()) &&
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
export function MarkdownPreview({ content }) {
  const html = useMemo(() => parseMarkdown(content), [content]);
  return <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}
