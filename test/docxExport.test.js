import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createDocxBuffer } from '../server/services/docxExportService.js';

describe('Server-Side DOCX Export Service Tests', () => {
  const sampleMarkdown = `
# Data Structures: Hash Tables

## Collision Resolution
$$
h(k, i) = (h'(k) + c_1 i + c_2 i^2) \\bmod m
$$

\`\`\`c
int hash(int key, int table_size) {
    return key % table_size;
}
\`\`\`

| Method | Best Case | Worst Case |
|---|---|---|
| Chaining | O(1) | O(n) |
| Open Addressing | O(1) | O(n) |
`;

  test('should generate a valid DOCX Buffer from markdown', async () => {
    const docxBuffer = await createDocxBuffer('Hash Tables', sampleMarkdown);
    assert.ok(Buffer.isBuffer(docxBuffer));
    assert.ok(docxBuffer.length > 0);

    // Standard zip / docx magic header is PK (0x50 0x4B)
    assert.strictEqual(docxBuffer[0], 0x50);
    assert.strictEqual(docxBuffer[1], 0x4B);
  });
});
