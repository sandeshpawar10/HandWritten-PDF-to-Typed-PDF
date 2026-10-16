#!/usr/bin/env python3
"""
Enhanced PaddleOCR with automatic document formatting
Generates formatted PDF and DOCX outputs
"""
import sys
import json
import base64
import io
import re
from paddleocr import PaddleOCR
from PIL import Image
import fitz  # PyMuPDF
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, PageBreak
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfgen import canvas
from io import BytesIO
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

# Global OCR instance
_ocr_instance = None

def get_ocr_instance():
    """Lazy-load OCR instance"""
    global _ocr_instance
    if _ocr_instance is None:
        _ocr_instance = PaddleOCR(
            use_angle_cls=True,
            lang='en',
            show_log=False,
            use_gpu=False,
            det_db_thresh=0.3,
            det_db_box_thresh=0.5,
            det_db_unclip_ratio=1.6,
            use_dilation=True,
            det_limit_side_len=960,
            rec_batch_num=6,
        )
    return _ocr_instance

def detect_text_structure(lines_data):
    """
    Analyze text structure and classify each line
    Returns: list of dicts with {type, text, confidence, size}
    """
    if not lines_data:
        return []

    sorted_lines = sorted(lines_data, key=lambda x: x['box'][0][1])
    structured_content = []

    for line in sorted_lines:
        text = line['text'].strip()
        confidence = line['confidence']
        box = line['box']

        # Calculate text height (approximate font size)
        height = box[2][1] - box[0][1]

        if not text:
            continue

        # Classify text type
        text_type = 'normal'

        # Detect heading (short, high confidence, possibly all caps)
        if len(text.split()) <= 10 and confidence > 0.85:
            if text.isupper() or (text[0].isupper() and height > 20):
                text_type = 'heading'

        # Detect subheading
        elif len(text.split()) <= 12 and text[0].isupper() and confidence > 0.8:
            text_type = 'subheading'

        # Detect bullet/list
        elif text.startswith(('•', '-', '*', '·')) or re.match(r'^\d+[\.)]\s', text):
            text_type = 'bullet'

        # Detect code (monospace indicators)
        elif re.search(r'[{}()\[\];]', text) and len(text) > 20:
            text_type = 'code'

        # Detect math/formula (contains symbols)
        elif re.search(r'[∫∑∏√±≤≥≠∞]|[a-z]\^[0-9]|\d+/\d+', text):
            text_type = 'formula'

        structured_content.append({
            'type': text_type,
            'text': text,
            'confidence': confidence,
            'height': height,
            'box': box
        })

    return structured_content

def escape_reportlab_text(text):
    """
    Escape XML special characters and handle non-ASCII characters safely for ReportLab
    """
    if not text:
        return ""
    # Escape XML entities
    text = (
        text.replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('"', '&quot;')
    )
    # Handle non-ASCII characters safely using XML numeric character references
    return text.encode('ascii', 'xmlcharrefreplace').decode('ascii')

def create_formatted_pdf(structured_content, images_data=None):
    """
    Create a beautifully formatted PDF using ReportLab
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )

    # Custom styles
    styles = getSampleStyleSheet()

    # Title style
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor='#1a1a1a',
        spaceAfter=12,
        alignment=TA_LEFT,
        fontName='Helvetica-Bold'
    )

    # Heading style
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor='#2c3e50',
        spaceAfter=10,
        spaceBefore=14,
        fontName='Helvetica-Bold'
    )

    # Subheading style
    subheading_style = ParagraphStyle(
        'CustomSubheading',
        parent=styles['Heading3'],
        fontSize=12,
        textColor='#34495e',
        spaceAfter=8,
        spaceBefore=10,
        fontName='Helvetica-Bold'
    )

    # Normal text style
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=11,
        textColor='#2c3e50',
        spaceAfter=6,
        alignment=TA_JUSTIFY,
        leading=14
    )

    # Bullet style
    bullet_style = ParagraphStyle(
        'CustomBullet',
        parent=styles['Normal'],
        fontSize=11,
        textColor='#2c3e50',
        leftIndent=20,
        spaceAfter=4,
        bulletIndent=10
    )

    # Code style
    code_style = ParagraphStyle(
        'CustomCode',
        parent=styles['Code'],
        fontSize=9,
        fontName='Courier',
        textColor='#c7254e',
        backColor='#f9f2f4',
        leftIndent=20,
        rightIndent=20,
        spaceAfter=6,
        spaceBefore=6
    )

    # Formula style (boxed)
    formula_style = ParagraphStyle(
        'CustomFormula',
        parent=styles['Normal'],
        fontSize=11,
        fontName='Courier',
        textColor='#2c3e50',
        backColor='#ecf0f1',
        leftIndent=30,
        rightIndent=30,
        spaceAfter=8,
        spaceBefore=8,
        borderColor='#95a5a6',
        borderWidth=1,
        borderPadding=8
    )

    # Build document
    story = []
    first_heading = True

    # Normalize input: if structured_content is a list of pages (lists), flatten with page breaks
    flat_content = []
    if structured_content and isinstance(structured_content[0], list):
        for idx, page_items in enumerate(structured_content):
            if idx > 0:
                flat_content.append({'type': 'page_break', 'text': ''})
            flat_content.extend(page_items)
    else:
        flat_content = structured_content

    for item in flat_content:
        text_type = item.get('type')

        # Add page breaks between pages
        if text_type == 'page_break':
            story.append(PageBreak())
            continue

        text = item.get('text', '')
        if not text:
            continue

        if text_type == 'bullet':
            # Clean bullet point
            text = re.sub(r'^[•\-*·]\s*', '', text)

        # Escape special characters and handle non-ASCII safely for ReportLab
        text = escape_reportlab_text(text)

        if text_type == 'heading':
            if first_heading:
                story.append(Paragraph(text, title_style))
                first_heading = False
            else:
                story.append(Spacer(1, 0.2*inch))
                story.append(Paragraph(text, heading_style))

        elif text_type == 'subheading':
            story.append(Paragraph(text, subheading_style))

        elif text_type == 'bullet':
            story.append(Paragraph(f'&bull; {text}', bullet_style))

        elif text_type == 'code':
            story.append(Paragraph(text, code_style))

        elif text_type == 'formula':
            story.append(Paragraph(text, formula_style))

        else:  # normal
            story.append(Paragraph(text, normal_style))

    # Add images if provided
    if images_data:
        for img_data in images_data:
            try:
                img = RLImage(BytesIO(base64.b64decode(img_data)), width=4*inch, height=3*inch)
                story.append(Spacer(1, 0.2*inch))
                story.append(img)
                story.append(Spacer(1, 0.2*inch))
            except:
                pass

    # Build PDF
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    return base64.b64encode(pdf_bytes).decode('utf-8')

def create_formatted_docx(structured_content, images_data=None):
    """
    Create a formatted DOCX document
    """
    doc = Document()

    # Set default font
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Calibri'
    font.size = Pt(11)

    first_heading = True

    # Normalize input: if structured_content is a list of pages (lists), flatten with page breaks
    flat_content = []
    if structured_content and isinstance(structured_content[0], list):
        for idx, page_items in enumerate(structured_content):
            if idx > 0:
                flat_content.append({'type': 'page_break', 'text': ''})
            flat_content.extend(page_items)
    else:
        flat_content = structured_content

    for item in flat_content:
        text_type = item.get('type')

        # Add page breaks between pages
        if text_type == 'page_break':
            doc.add_page_break()
            continue

        text = item.get('text', '')
        if not text:
            continue

        if text_type == 'heading':
            if first_heading:
                heading = doc.add_heading(text, level=1)
                first_heading = False
            else:
                doc.add_paragraph()  # Add space
                heading = doc.add_heading(text, level=2)

        elif text_type == 'subheading':
            heading = doc.add_heading(text, level=3)

        elif text_type == 'bullet':
            text = re.sub(r'^[•\-*·]\s*', '', text)
            try:
                doc.add_paragraph(text, style='List Bullet')
            except Exception:
                doc.add_paragraph(f'• {text}')

        elif text_type == 'code':
            p = doc.add_paragraph()
            run = p.add_run(text)
            run.font.name = 'Courier New'
            run.font.size = Pt(9)
            p.paragraph_format.left_indent = Inches(0.5)
            p.paragraph_format.space_after = Pt(6)

        elif text_type == 'formula':
            p = doc.add_paragraph()
            run = p.add_run(text)
            run.font.name = 'Courier New'
            run.font.color.rgb = RGBColor(44, 62, 80)
            p.paragraph_format.left_indent = Inches(0.75)
            p.paragraph_format.space_after = Pt(8)

        else:  # normal
            p = doc.add_paragraph(text)
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    # Add images if provided
    if images_data:
        for img_data in images_data:
            try:
                img_stream = BytesIO(base64.b64decode(img_data))
                doc.add_picture(img_stream, width=Inches(4.5))
            except:
                pass

    # Save to bytes
    buffer = BytesIO()
    doc.save(buffer)
    docx_bytes = buffer.getvalue()
    buffer.close()

    return base64.b64encode(docx_bytes).decode('utf-8')

def process_document(ocr, image, extract_images=True):
    """Process document and return structured data with formatting"""
    result = ocr.ocr(image, cls=True)

    lines_data = []

    if result and result[0]:
        for line in result[0]:
            box = line[0]
            text = line[1][0]
            confidence = line[1][1]

            lines_data.append({
                'box': box,
                'text': text,
                'confidence': confidence
            })

    # Detect structure
    structured_content = detect_text_structure(lines_data)

    # Extract images from original (if PDF)
    images_data = []
    # TODO: Extract embedded images from PDF pages

    return structured_content, images_data

def main():
    try:
        input_data = sys.stdin.read()
        data = json.loads(input_data)

        base64_image = data.get('image')
        if not base64_image:
            raise ValueError("Missing 'image' field")

        image_bytes = base64.b64decode(base64_image)
        is_pdf = image_bytes[:4] == b'%PDF'

        ocr = get_ocr_instance()
        all_structured_content = []
        all_images = []

        if is_pdf:
            pdf_doc = fitz.open(stream=image_bytes, filetype="pdf")
            page_count = len(pdf_doc)
            max_pages = min(page_count, 20)
            is_truncated = page_count > max_pages

            if is_truncated:
                print(json.dumps({"type": "warning", "message": f"Processing first {max_pages} of {page_count} pages"}), file=sys.stderr)

            for page_num in range(max_pages):
                page = pdf_doc[page_num]
                pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
                img_data = pix.tobytes("png")
                image = Image.open(io.BytesIO(img_data))

                structured_content, images = process_document(ocr, image)
                if page_num > 0:
                    all_structured_content.append({'type': 'page_break', 'text': ''})
                all_structured_content.extend(structured_content)
                all_images.extend(images)

            pdf_doc.close()
            pages_processed = max_pages
        else:
            image = Image.open(io.BytesIO(image_bytes))
            all_structured_content, all_images = process_document(ocr, image)
            pages_processed = 1
            is_truncated = False
            page_count = 1

        # Generate formatted outputs
        formatted_pdf = create_formatted_pdf(all_structured_content, all_images)
        formatted_docx = create_formatted_docx(all_structured_content, all_images)

        # Generate plain text for compatibility
        plain_text = '\n'.join([item['text'] for item in all_structured_content if item.get('text')])

        output = {
            "text": plain_text,
            "structured_content": all_structured_content,
            "formatted_pdf": formatted_pdf,
            "formatted_docx": formatted_docx,
            "page_count": pages_processed
        }

        if is_truncated:
            output["truncated"] = True
            output["total_actual_pages"] = page_count

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
