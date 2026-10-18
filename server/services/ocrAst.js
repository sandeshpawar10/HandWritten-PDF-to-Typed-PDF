/**
 * server/services/ocrAst.js
 * Canonical document Abstract Syntax Tree (AST) parser and serializers.
 * Single source of truth for Markdown, DOCX, and PDF rendering.
 */

/**
 * Parse Markdown transcription into structured AST.
 * @param {string} markdown - Clean markdown text
 * @param {number} pageNum - Page number (1-based)
 * @param {Object} metadata - Optional page metadata (model, confidence, etc.)
 * @returns {Object} Structured Page AST
 */
export function markdownToAst(markdown, pageNum = 1, metadata = {}) {
  const blocks = [];
  if (!markdown) {
    return {
      page: pageNum,
      blocks: [],
      unresolvedRegions: [],
      metadata: { model: metadata.model || 'unknown', confidence: 1.0, verified: true }
    };
  }

  const lines = markdown.split('\n');
  let i = 0;
  let order = 1;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code blocks / ASCII diagrams
    if (trimmed.startsWith('```')) {
      const codeLines = [];
      const lang = trimmed.slice(3).trim() || 'text';
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const isDiagram = lang.includes('diagram') || lang.includes('ascii') || lang.includes('flowchart');
      blocks.push({
        id: `p${pageNum}-b${order}`,
        type: isDiagram ? 'diagram' : 'code',
        order: order++,
        lang,
        lines: codeLines,
        content: codeLines.join('\n'),
        confidence: 0.96,
        warnings: []
      });
      continue;
    }

    // Display Math $$ ... $$
    if (trimmed === '$$') {
      const mathLines = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]);
        i++;
      }
      i++; // skip closing $$
      const latex = mathLines.join('\n').trim();
      blocks.push({
        id: `p${pageNum}-b${order}`,
        type: 'math',
        order: order++,
        lines: mathLines,
        latex,
        content: `$$\n${latex}\n$$`,
        confidence: 0.97,
        warnings: []
      });
      continue;
    }

    // Single-line $$ ... $$
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 2) {
      const latex = trimmed.slice(2, -2).trim();
      blocks.push({
        id: `p${pageNum}-b${order}`,
        type: 'math',
        order: order++,
        lines: [latex],
        latex,
        content: trimmed,
        confidence: 0.98,
        warnings: []
      });
      i++;
      continue;
    }

    // Raw LaTeX \begin{...}
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
      const latex = mathLines.join('\n');
      blocks.push({
        id: `p${pageNum}-b${order}`,
        type: 'math',
        order: order++,
        lines: mathLines,
        latex,
        content: latex,
        confidence: 0.95,
        warnings: []
      });
      continue;
    }

    // Page separator: --- Page X ---
    const pageMatch = trimmed.match(/^---\s*Page\s+(\d+)\s*---$/i);
    if (pageMatch) {
      blocks.push({
        id: `p${pageNum}-b${order}`,
        type: 'separator',
        order: order++,
        pageNum: parseInt(pageMatch[1], 10),
        content: trimmed,
        confidence: 1.0,
        warnings: []
      });
      i++;
      continue;
    }

    // Horizontal Rule
    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      blocks.push({
        id: `p${pageNum}-b${order}`,
        type: 'hr',
        order: order++,
        content: '---',
        confidence: 1.0,
        warnings: []
      });
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
      blocks.push({
        id: `p${pageNum}-b${order}`,
        type: 'table',
        order: order++,
        rows,
        content: tableLines.join('\n'),
        confidence: 0.94,
        warnings: []
      });
      continue;
    }

    // Headings #
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        id: `p${pageNum}-b${order}`,
        type: 'heading',
        order: order++,
        level: headingMatch[1].length,
        text: headingMatch[2],
        content: trimmed,
        confidence: 0.99,
        warnings: []
      });
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
      blocks.push({
        id: `p${pageNum}-b${order}`,
        type: 'blockquote',
        order: order++,
        text: qLines.join('\n'),
        content: qLines.map(l => `> ${l}`).join('\n'),
        confidence: 0.97,
        warnings: []
      });
      continue;
    }

    // List item
    const listMatch = trimmed.match(/^([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      blocks.push({
        id: `p${pageNum}-b${order}`,
        type: 'list-item',
        order: order++,
        ordered: /^\d+\./.test(listMatch[1]),
        marker: listMatch[1],
        text: listMatch[2],
        content: trimmed,
        confidence: 0.98,
        warnings: []
      });
      i++;
      continue;
    }

    // Empty line
    if (trimmed === '') {
      i++;
      continue;
    }

    // Paragraph
    blocks.push({
      id: `p${pageNum}-b${order}`,
      type: 'paragraph',
      order: order++,
      text: trimmed,
      content: trimmed,
      confidence: 0.98,
      warnings: []
    });
    i++;
  }

  // Calculate composite page confidence
  const confSum = blocks.reduce((acc, b) => acc + (b.confidence || 0.95), 0);
  const avgConf = blocks.length > 0 ? Number((confSum / blocks.length).toFixed(3)) : 1.0;

  return {
    page: pageNum,
    blocks,
    unresolvedRegions: [],
    metadata: {
      model: metadata.model || 'gemini-3.8-flash',
      confidence: avgConf,
      verified: metadata.verified ?? true
    }
  };
}

/**
 * Serialize Page AST back into standard Markdown.
 * @param {Object} ast - Document or Page AST
 * @returns {string} Clean Markdown
 */
export function astToMarkdown(ast) {
  if (!ast || !ast.blocks) return '';
  const parts = [];

  for (const block of ast.blocks) {
    switch (block.type) {
      case 'heading':
        parts.push(`${'#'.repeat(block.level || 1)} ${block.text}`);
        break;
      case 'paragraph':
        parts.push(block.text || block.content);
        break;
      case 'code':
      case 'diagram':
        parts.push(`\`\`\`${block.lang || 'text'}\n${(block.lines || []).join('\n')}\n\`\`\``);
        break;
      case 'math':
        parts.push(`$$\n${block.latex || (block.lines || []).join('\n')}\n$$`);
        break;
      case 'table':
        if (block.rows && block.rows.length > 0) {
          const rows = block.rows.map(r => `| ${r.join(' | ')} |`);
          const sep = `| ${block.rows[0].map(() => '---').join(' | ')} |`;
          parts.push([rows[0], sep, ...rows.slice(1)].join('\n'));
        }
        break;
      case 'blockquote':
        parts.push((block.text || '').split('\n').map(l => `> ${l}`).join('\n'));
        break;
      case 'list-item':
        parts.push(`${block.marker || '•'} ${block.text || ''}`);
        break;
      case 'separator':
        parts.push(`--- Page ${block.pageNum || 1} ---`);
        break;
      case 'hr':
        parts.push('---');
        break;
      default:
        if (block.content) parts.push(block.content);
        break;
    }
  }

  return parts.join('\n\n');
}
