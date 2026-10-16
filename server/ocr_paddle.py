#!/usr/bin/env python3
"""
PaddleOCR script for document text extraction
Optimized for speed and formatted output
"""
import sys
import json
import base64
import io
import re
from paddleocr import PaddleOCR
from PIL import Image
import fitz  # PyMuPDF for PDF handling

# Global OCR instance (reusable across calls if process is kept alive)
_ocr_instance = None

def get_ocr_instance():
    """Lazy-load and reuse OCR instance for performance"""
    global _ocr_instance
    if _ocr_instance is None:
        _ocr_instance = PaddleOCR(
            use_angle_cls=True,
            lang='en',
            show_log=False,
            use_gpu=False,
            # Performance optimizations
            det_db_thresh=0.3,        # Detection threshold (lower = faster, less accurate)
            det_db_box_thresh=0.5,    # Box threshold
            det_db_unclip_ratio=1.6,  # Text region expansion
            use_dilation=True,        # Better text detection
            det_limit_side_len=960,   # Max side length (balance speed/quality)
            rec_batch_num=6,          # Process 6 text regions at once (faster)
        )
    return _ocr_instance

def format_text_lines(lines_data):
    """
    Format OCR output into neat, readable paragraphs
    Groups lines by vertical position and adds proper spacing
    """
    if not lines_data:
        return "No text detected"

    # Sort lines by vertical position (top to bottom)
    sorted_lines = sorted(lines_data, key=lambda x: x['box'][0][1])

    formatted_text = []
    current_paragraph = []
    last_y = 0
    line_height_threshold = 30  # Pixels between lines to start new paragraph

    for line in sorted_lines:
        y_pos = line['box'][0][1]
        text = line['text'].strip()

        if not text:
            continue

        # Check if this is a new paragraph (large vertical gap)
        if last_y > 0 and (y_pos - last_y) > line_height_threshold:
            # Finish current paragraph
            if current_paragraph:
                formatted_text.append(' '.join(current_paragraph))
                current_paragraph = []

        current_paragraph.append(text)
        last_y = y_pos + (line['box'][2][1] - line['box'][0][1])

    # Add final paragraph
    if current_paragraph:
        formatted_text.append(' '.join(current_paragraph))

    # Join paragraphs with double newlines
    return '\n\n'.join(formatted_text)

def detect_structure(lines_data):
    """
    Detect document structure (headings, lists, etc.)
    Returns formatted markdown
    """
    if not lines_data:
        return "No text detected"

    sorted_lines = sorted(lines_data, key=lambda x: x['box'][0][1])

    markdown_lines = []
    last_y = 0

    for line in sorted_lines:
        y_pos = line['box'][0][1]
        text = line['text'].strip()
        confidence = line['confidence']

        if not text:
            continue

        # Detect headings (shorter, higher confidence, possibly larger font)
        is_heading = (
            len(text.split()) <= 8 and
            confidence > 0.85 and
            text[0].isupper()
        )

        # Detect bullet points
        is_bullet = text.startswith(('•', '-', '*', '·')) or re.match(r'^\d+[\.)]\s', text)

        # Add spacing for new sections
        if last_y > 0 and (y_pos - last_y) > 40:
            markdown_lines.append('')

        # Format based on detection
        if is_heading:
            markdown_lines.append(f'## {text}')
        elif is_bullet:
            # Clean up bullet point
            text = re.sub(r'^[•\-*·]\s*', '- ', text)
            text = re.sub(r'^\d+[\.)]\s*', lambda m: f'{m.group()[:-1]}. ', text)
            markdown_lines.append(text)
        else:
            markdown_lines.append(text)

        last_y = y_pos + (line['box'][2][1] - line['box'][0][1])

    return '\n'.join(markdown_lines)

def process_page(ocr, image):
    """Process a single page and return structured data"""
    result = ocr.ocr(image, cls=True)

    lines_data = []
    total_confidence = 0
    line_count = 0

    if result and result[0]:
        for line in result[0]:
            box = line[0]  # Bounding box coordinates
            text = line[1][0]
            confidence = line[1][1]

            lines_data.append({
                'box': box,
                'text': text,
                'confidence': confidence
            })

            total_confidence += confidence
            line_count += 1

    avg_confidence = total_confidence / line_count if line_count > 0 else 0

    # Generate both plain and markdown formatted versions
    plain_text = format_text_lines(lines_data)
    markdown_text = detect_structure(lines_data)

    return {
        'text': plain_text,
        'markdown': markdown_text,
        'confidence': round(avg_confidence, 3),
        'line_count': line_count
    }

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

        # Check if it's a PDF
        is_pdf = image_bytes[:4] == b'%PDF'

        # Get OCR instance
        ocr = get_ocr_instance()

        if is_pdf:
            # Handle PDF: convert each page to image
            pdf_document = fitz.open(stream=image_bytes, filetype="pdf")
            pages_results = []
            page_count = len(pdf_document)

            # Limit pages to prevent timeout (max 20 pages)
            max_pages = min(page_count, 20)
            if page_count > max_pages:
                print(json.dumps({"type": "warning", "message": f"Processing first {max_pages} of {page_count} pages"}), file=sys.stderr)

            for page_num in range(max_pages):
                page = pdf_document[page_num]

                # Optimized rendering: 1.5x scale, good balance
                # Use 2.0x for better quality but slower processing
                pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
                img_data = pix.tobytes("png")
                image = Image.open(io.BytesIO(img_data))

                # Optional: Convert to grayscale for faster processing
                # Uncomment if speed is more important than color accuracy
                # image = image.convert('L')

                # Process page
                page_result = process_page(ocr, image)
                pages_results.append(page_result)

            pdf_document.close()

            # Output JSON result with all pages
            output = {"pages": pages_results}
            if page_count > max_pages:
                output["truncated"] = True
                output["total_actual_pages"] = page_count

        else:
            # Handle regular image
            image = Image.open(io.BytesIO(image_bytes))

            # Optional: Enhance image quality for better OCR
            # from PIL import ImageEnhance
            # enhancer = ImageEnhance.Contrast(image)
            # image = enhancer.enhance(1.5)

            # Process image
            page_result = process_page(ocr, image)
            output = {"pages": [page_result]}

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
