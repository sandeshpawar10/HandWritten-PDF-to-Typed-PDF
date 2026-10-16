#!/usr/bin/env python3
"""
PaddleOCR script for document text extraction
Receives base64 image via stdin, outputs JSON to stdout
"""
import sys
import json
import base64
import io
from paddleocr import PaddleOCR
from PIL import Image
import fitz  # PyMuPDF for PDF handling

def main():
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)

        base64_image = data.get('image')
        if not base64_image:
            raise ValueError("Missing 'image' field in input")

        # Decode base64 image
        image_bytes = base64.b64decode(base64_image)

        # Check if it's a PDF by looking at magic bytes
        is_pdf = image_bytes[:4] == b'%PDF'

        if is_pdf:
            # Handle PDF: convert each page to image
            pdf_document = fitz.open(stream=image_bytes, filetype="pdf")

            # Initialize PaddleOCR once
            ocr = PaddleOCR(
                use_angle_cls=True,
                lang='en',
                show_log=False,
                use_gpu=False
            )

            pages_results = []

            for page_num in range(len(pdf_document)):
                page = pdf_document[page_num]

                # Render page to image (higher DPI for better OCR)
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x scale for better quality
                img_data = pix.tobytes("png")
                image = Image.open(io.BytesIO(img_data))

                # Run OCR on this page
                result = ocr.ocr(image, cls=True)

                # Extract text and confidence
                text_lines = []
                total_confidence = 0
                line_count = 0

                if result and result[0]:
                    for line in result[0]:
                        text = line[1][0]
                        confidence = line[1][1]
                        text_lines.append(text)
                        total_confidence += confidence
                        line_count += 1

                avg_confidence = total_confidence / line_count if line_count > 0 else 0
                full_text = '\n'.join(text_lines) if text_lines else "No text detected on this page"

                pages_results.append({
                    "text": full_text,
                    "markdown": full_text,
                    "confidence": round(avg_confidence, 3)
                })

            pdf_document.close()

            # Output JSON result with all pages
            output = {"pages": pages_results}

        else:
            # Handle regular image
            image = Image.open(io.BytesIO(image_bytes))

            # Initialize PaddleOCR
            ocr = PaddleOCR(
                use_angle_cls=True,
                lang='en',
                show_log=False,
                use_gpu=False
            )

            # Run OCR
            result = ocr.ocr(image, cls=True)

            # Extract text and confidence scores
            text_lines = []
            total_confidence = 0
            line_count = 0

            if result and result[0]:
                for line in result[0]:
                    text = line[1][0]
                    confidence = line[1][1]
                    text_lines.append(text)
                    total_confidence += confidence
                    line_count += 1

            avg_confidence = total_confidence / line_count if line_count > 0 else 0
            full_text = '\n'.join(text_lines) if text_lines else "No text detected in image"

            # Output JSON result
            output = {
                "pages": [
                    {
                        "text": full_text,
                        "markdown": full_text,
                        "confidence": round(avg_confidence, 3)
                    }
                ]
            }

        print(json.dumps(output))
        sys.exit(0)

    except Exception as e:
        error_output = {
            "error": str(e),
            "type": type(e).__name__
        }
        print(json.dumps(error_output), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
