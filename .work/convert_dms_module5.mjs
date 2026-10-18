import fs from 'fs';
import dotenv from 'dotenv';
import { runGeminiOCR } from '../server/services/geminiOcrService.js';

dotenv.config({ path: '../.env' });

const input = 'C:/Users/admin/Downloads/DMS MODULE 5.pdf';
const resultPath = 'D:/typed-document-v2/.work/dms_module5_ocr_result.json';
const buffer = fs.readFileSync(input);
const base64 = buffer.toString('base64');

console.log(`Starting TypedDoc conversion: ${buffer.length} bytes`);
const result = await runGeminiOCR({
  document: {
    type: 'document_url',
    document_url: `data:application/pdf;base64,${base64}`
  }
}, (progress) => {
  if (progress?.message) console.log(`[${progress.stage || 'progress'}] ${progress.percent ?? ''}% ${progress.message}`);
});

fs.writeFileSync(resultPath, JSON.stringify({
  ...result,
  formatted_pdf: undefined,
  formattedPdf: undefined,
  formatted_docx: undefined,
  formattedDocx: undefined
}, null, 2));
console.log(JSON.stringify({
  resultPath,
  totalPages: result.totalPages || result.total_pages,
  pagesProcessed: result.pagesProcessed || result.pages_processed,
  textLength: result.text?.length,
  hasPdf: Boolean(result.formattedPdf || result.formatted_pdf),
  hasDocx: Boolean(result.formattedDocx || result.formatted_docx)
}, null, 2));
