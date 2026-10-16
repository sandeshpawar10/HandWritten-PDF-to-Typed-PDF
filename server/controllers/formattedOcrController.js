import { runFormattedOCR } from '../services/formattedOcrService.js';

export const handleFormattedOcr = async (req, res) => {
  try {
    console.log('Formatted OCR request received:', {
      hasDocument: !!req.body?.document,
      documentType: req.body?.document?.type,
      userId: req.user?.uid
    });

    const data = await runFormattedOCR(req.body);

    console.log('Formatted OCR processing successful:', {
      textLength: data.text?.length,
      hasPdf: !!data.formatted_pdf,
      hasDocx: !!data.formatted_docx,
      userId: req.user?.uid
    });

    res.json(data);
  } catch (error) {
    console.error('Formatted OCR Error:', {
      message: error.message || error,
      status: error.status,
      data: error.data,
      stack: error.stack,
      userId: req.user?.uid
    });

    const statusCode = error.status || 500;
    const errorMessage = error.data?.error || error.message || 'Internal Server Error';

    res.status(statusCode).json({
      error: errorMessage,
      type: error.data?.type || error.type,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV !== 'production' && {
        details: error.data,
      })
    });
  }
};
