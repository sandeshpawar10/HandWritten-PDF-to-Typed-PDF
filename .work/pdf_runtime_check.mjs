import { createPdfBuffer } from './server/services/pdfExportService.js';
import { PDFDocument } from 'pdf-lib';
const md='# Audit\n\nParagraph with **formatting**.\n\n$$x^2 + y^2$$\n\n| A | B |\n|---|---|\n| 1 | 2 |';
for (const mode of ['clean-reflow','faithful','preserve-source-pages']) {
  const b=await createPdfBuffer('Audit '+mode, md, {pageMode:mode, sourcePageCount:2});
  const d=await PDFDocument.load(b,{updateMetadata:false});
  console.log(JSON.stringify({mode,bytes:b.length,pages:d.getPageCount(),creator:d.getCreator(),producer:d.getProducer(),title:d.getTitle(),sourcePageCount:b.sourcePageCount,ratio:b.expansionRatio}));
}
