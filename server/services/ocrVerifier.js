/**
 * server/services/ocrVerifier.js
 * Comprehensive accuracy validation and verification layer.
 * Inspects math, tables, code, diagrams, and detects omissions.
 */

/**
 * Validate math block syntax and balance.
 * @param {string} latex
 * @returns {string[]} Problems found
 */
export function verifyMathBlock(latex) {
  const problems = [];
  if (!latex || typeof latex !== 'string') return ['empty math block'];

  // Check balanced curly braces
  let openBraces = 0;
  for (let i = 0; i < latex.length; i++) {
    if (latex[i] === '{' && (i === 0 || latex[i - 1] !== '\\')) openBraces++;
    if (latex[i] === '}' && (i === 0 || latex[i - 1] !== '\\')) openBraces--;
    if (openBraces < 0) {
      problems.push('unbalanced closing curly brace in math');
      break;
    }
  }
  if (openBraces > 0) problems.push('unclosed opening curly brace in math');

  // Check balanced \begin{...} and \end{...}
  const begins = (latex.match(/\\begin\{([^}]+)\}/g) || []).map(b => b.replace(/\\begin\{|\}/g, ''));
  const ends = (latex.match(/\\end\{([^}]+)\}/g) || []).map(e => e.replace(/\\end\{|\}/g, ''));

  if (begins.length !== ends.length) {
    problems.push(`mismatched LaTeX environments (${begins.length} \\begin vs ${ends.length} \\end)`);
  } else if (begins.length > 0) {
    for (let k = 0; k < begins.length; k++) {
      if (begins[k] !== ends[ends.length - 1 - k]) {
        problems.push(`mismatched LaTeX environment: \\begin{${begins[k]}} vs \\end{${ends[ends.length - 1 - k]}}`);
        break;
      }
    }
  }

  return problems;
}

/**
 * Validate markdown table integrity.
 * @param {string[][]} rows
 * @returns {string[]} Problems found
 */
export function verifyTable(rows) {
  const problems = [];
  if (!rows || rows.length < 2) return ['table must have at least header and one data row'];

  const expectedCols = rows[0].length;
  if (expectedCols === 0) return ['empty table header'];

  for (let r = 1; r < rows.length; r++) {
    if (rows[r].length !== expectedCols) {
      problems.push(`row ${r + 1} has ${rows[r].length} columns; expected ${expectedCols}`);
    }
  }

  return problems;
}

/**
 * Perform comprehensive validation on a Page AST.
 * Attaches warnings and updates confidence on each block.
 * @param {Object} pageAst - Structured page AST from ocrAst.js
 * @returns {{ ast: Object, isValid: boolean, totalWarnings: number, pageConfidence: number }}
 */
export function verifyPageAst(pageAst) {
  if (!pageAst || !Array.isArray(pageAst.blocks)) {
    return { ast: pageAst, isValid: false, totalWarnings: 1, pageConfidence: 0.0 };
  }

  let totalWarnings = 0;

  for (const block of pageAst.blocks) {
    block.warnings = block.warnings || [];

    switch (block.type) {
      case 'math': {
        const mathProblems = verifyMathBlock(block.latex || block.content);
        if (mathProblems.length > 0) {
          block.warnings.push(...mathProblems);
          block.confidence = Math.max(0.6, (block.confidence || 0.95) - 0.2);
          totalWarnings += mathProblems.length;
        }
        break;
      }

      case 'table': {
        const tableProblems = verifyTable(block.rows);
        if (tableProblems.length > 0) {
          block.warnings.push(...tableProblems);
          block.confidence = Math.max(0.6, (block.confidence || 0.95) - 0.2);
          totalWarnings += tableProblems.length;
        }
        break;
      }

      case 'code':
      case 'diagram': {
        if (!block.lines || block.lines.length === 0) {
          block.warnings.push('empty code/diagram block');
          block.confidence = 0.7;
          totalWarnings++;
        }
        break;
      }

      case 'paragraph': {
        if (block.text && block.text.length < 3 && !/^[0-9A-Za-z.]$/.test(block.text)) {
          block.warnings.push('suspiciously short paragraph');
          block.confidence = 0.8;
          totalWarnings++;
        }
        break;
      }

      default:
        break;
    }
  }

  // Recalculate page-level confidence
  const confSum = pageAst.blocks.reduce((acc, b) => acc + (b.confidence || 0.95), 0);
  const pageConfidence = pageAst.blocks.length > 0
    ? Number((confSum / pageAst.blocks.length).toFixed(3))
    : 1.0;

  pageAst.metadata = {
    ...pageAst.metadata,
    confidence: pageConfidence,
    warningCount: totalWarnings,
    verified: true
  };

  return {
    ast: pageAst,
    isValid: totalWarnings === 0,
    totalWarnings,
    pageConfidence
  };
}
