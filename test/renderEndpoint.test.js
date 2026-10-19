import { test, describe } from 'node:test';
import assert from 'node:assert';
import { handleRenderPdf } from '../server/controllers/renderController.js';
import { PDFDocument } from 'pdf-lib';

describe('Render PDF Controller Endpoint Tests', () => {
  function createMockRes() {
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(name, value) {
        this.headers[name] = value;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
      send(data) {
        this.body = data;
        return this;
      }
    };
    return res;
  }

  test('should return 400 when markdown content is missing', async () => {
    const req = { body: { title: 'Test Document' }, headers: {}, query: {} };
    const res = createMockRes();

    await handleRenderPdf(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.body.error.includes('content'));
  });

  test('should render markdown and return JSON with base64 PDF and telemetry', async () => {
    const req = {
      body: {
        title: 'Algorithms Lecture',
        content: '# Dijkstra Algorithm\n\nShortest path tree computation.',
        pageMode: 'clean-reflow'
      },
      headers: {},
      query: {}
    };
    const res = createMockRes();

    await handleRenderPdf(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.pdfSource, 'server-pdf');
    assert.strictEqual(res.body.renderer, 'pdf-lib');
    assert.strictEqual(res.body.pageMode, 'clean-reflow');
    assert.ok(typeof res.body.formattedPdf === 'string');
    assert.ok(res.body.formattedPdf.length > 0);

    // Verify the base64 can be loaded as a valid PDF with TypedDoc metadata
    const buffer = Buffer.from(res.body.formattedPdf, 'base64');
    const doc = await PDFDocument.load(buffer);
    assert.strictEqual(doc.getCreator(), 'TypedDoc Server PDF Engine');
  });

  test('should support binary PDF response when requested', async () => {
    const req = {
      body: {
        title: 'Binary Test',
        content: '# Test Content\n\nTesting binary stream.'
      },
      headers: { accept: 'application/pdf' },
      query: {}
    };
    const res = createMockRes();

    await handleRenderPdf(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['Content-Type'], 'application/pdf');
    assert.strictEqual(res.headers['X-TypedDoc-Creator'], 'TypedDoc Server PDF Engine');
    assert.ok(Buffer.isBuffer(res.body));
  });
});
