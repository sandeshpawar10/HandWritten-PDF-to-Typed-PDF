import { test, describe } from 'node:test';
import assert from 'node:assert';
import { markdownToAst, astToMarkdown } from '../server/services/ocrAst.js';
import { verifyMathBlock, verifyTable, verifyPageAst } from '../server/services/ocrVerifier.js';

describe('OCR AST & Verification Tests', () => {
  const sampleMarkdown = `# Master Theorem
$$
T(n) = a T(n/b) + f(n)
$$

\`\`\`c
void solve() {}
\`\`\`

| Case | Condition | Result |
|---|---|---|
| 1 | f(n) < n^{\\log_b a} | \\Theta(n^{\\log_b a}) |
| 2 | f(n) = n^{\\log_b a} | \\Theta(n^{\\log_b a} \\log n) |
`;

  test('should parse markdown into canonical AST structure', () => {
    const ast = markdownToAst(sampleMarkdown, 1, { model: 'gemini-3.8-flash' });
    assert.strictEqual(ast.page, 1);
    assert.ok(Array.isArray(ast.blocks));
    assert.strictEqual(ast.blocks[0].type, 'heading');
    assert.strictEqual(ast.blocks[0].text, 'Master Theorem');
    assert.strictEqual(ast.blocks[1].type, 'math');
    assert.strictEqual(ast.blocks[2].type, 'code');
    assert.strictEqual(ast.blocks[3].type, 'table');
  });

  test('should convert AST back to markdown', () => {
    const ast = markdownToAst(sampleMarkdown, 1);
    const md = astToMarkdown(ast);
    assert.ok(md.includes('# Master Theorem'));
    assert.ok(md.includes('$$'));
    assert.ok(md.includes('solve()'));
  });

  test('should detect math syntax problems', () => {
    const validMath = 'x = \\frac{a + b}{c}';
    assert.strictEqual(verifyMathBlock(validMath).length, 0);

    const unbalancedBrace = 'x = \\frac{a + b{c}';
    const problems = verifyMathBlock(unbalancedBrace);
    assert.ok(problems.length > 0);
    assert.ok(problems.some(p => p.includes('curly brace')));

    const mismatchedEnv = '\\begin{aligned} a = 1 \\end{matrix}';
    const envProblems = verifyMathBlock(mismatchedEnv);
    assert.ok(envProblems.length > 0);
  });

  test('should detect table column count inconsistency', () => {
    const validRows = [
      ['Col1', 'Col2'],
      ['Val1', 'Val2'],
      ['Val3', 'Val4']
    ];
    assert.strictEqual(verifyTable(validRows).length, 0);

    const invalidRows = [
      ['Col1', 'Col2'],
      ['Val1', 'Val2', 'ExtraCol'], // 3 cols instead of 2
      ['Val3'] // 1 col instead of 2
    ];
    const problems = verifyTable(invalidRows);
    assert.ok(problems.length > 0);
    assert.ok(problems.some(p => p.includes('expected 2')));
  });

  test('verifyPageAst should compute confidence and report warnings', () => {
    const malformedMarkdown = `# Faulty Page
$$
x = {unclosed
$$
`;
    const ast = markdownToAst(malformedMarkdown, 1);
    const verification = verifyPageAst(ast);

    assert.strictEqual(verification.isValid, false);
    assert.ok(verification.totalWarnings > 0);
    assert.ok(verification.pageConfidence < 1.0);
    assert.ok(ast.blocks[1].warnings.length > 0);
  });
});
