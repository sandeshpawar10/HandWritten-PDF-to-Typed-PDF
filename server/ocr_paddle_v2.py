#!/usr/bin/env python3
"""
Advanced OCR + Document Reconstruction System
Features:
- Text extraction with proper formatting
- Image preservation from PDF
- Math equation detection and boxing
- Code block detection and formatting
- Auto-generated formatted PDF output
"""
import sys
import json
import base64
import io
import re
import os
from paddleocr import PaddleOCR
from PIL import Image
import fitz  # PyMuPDF
from document_formatter import DocumentFormatter

_ocr_instance = None

def get_ocr_instance():
    global _ocr_instance
    if _ocr_instance is None:
        _ocr_instance = PaddleOCR(
            use_angle_cls=True,
            lang='en',
            show_log=False,
            use_gpu=False,
            det_db_thresh=0.3,
            det_limit_side_len=960,
            rec_batch_num=6,
        )
    return _ocr_instance

def extract_images_from_pdf(pdf_document):
    """Extract images from each PDF page"""
    images_by_page = []
    
    for page_num in range(len(pdf_document)):
        page = pdf_document[page_num]
        page_images = []
        image_list = page.get_images(full=True)
        
        for img_index, img_info in enumerate(image_list):
            try:
                xref = img_info[0]
                base_image = pdf_document.extract_image(xref)
                image_bytes = base_image["image"]
                page_images.append({'image': io.BytesIO(image_bytes)})
            except:
                continue
        
        images_by_page.append(page_images)
    
    return images_by_page

def format_text(lines_data):
    """Format OCR text with structure detection"""
    if not lines_data:
        return "No text detected"
    
    sorted_lines = sorted(lines_data, key=lambda x: x['box'][0][1])
    formatted = []
    last_y = 0
    
    for line in sorted_lines:
        y_pos = line['box'][0][1]
        text = line['text'].strip()
        
        if not text:
            continue
        
        # Add spacing for new sections
        if last_y > 0 and (y_pos - last_y) > 30:
            formatted.append('')
        
        formatted.append(text)
        last_y = y_pos + (line['box'][2][1] - line['box'][0][1])
    
    return '\n'.join(formatted)

def process_page(ocr, image):
    """Process single page with OCR"""
    result = ocr.ocr(image, cls=True)
    
    lines_data = []
    total_conf = 0
    count = 0
    
    if result and result[0]:
        for line in result[0]:
            box = line[0]
            text = line[1][0]
            conf = line[1][1]
            
            lines_data.append({
                'box': box,
                'text': text,
                'confidence': conf
            })
            
            total_conf += conf
            count += 1
    
    avg_conf = total_conf / count if count > 0 else 0
    formatted_text = format_text(lines_data)
    
    return {
        'text': formatted_text,
        'lines_data': lines_data,
        'confidence': round(avg_conf, 3),
        'line_count': count
    }

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
        pages_results = []
        images_by_page = []
        
        if is_pdf:
            pdf_doc = fitz.open(stream=image_bytes, filetype="pdf")
            images_by_page = extract_images_from_pdf(pdf_doc)
            
            max_pages = min(len(pdf_doc), 20)
            
            for page_num in range(max_pages):
                page = pdf_doc[page_num]
                pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
                img_data = pix.tobytes("png")
                image = Image.open(io.BytesIO(img_data))
                
                page_result = process_page(ocr, image)
                pages_results.append(page_result)
            
            pdf_doc.close()
        else:
            image = Image.open(io.BytesIO(image_bytes))
            page_result = process_page(ocr, image)
            pages_results.append(page_result)
        
        # Create formatted PDF
        formatted_pdf_base64 = None
        try:
            formatter = DocumentFormatter()
            output_path = '/tmp/formatted_output.pdf'
            formatter.create_formatted_pdf(pages_results, images_by_page, output_path)
            
            with open(output_path, 'rb') as f:
                pdf_bytes = f.read()
                formatted_pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
            
            os.remove(output_path)
        except Exception as e:
            print(f"PDF generation failed: {e}", file=sys.stderr)
        
        output = {
            "pages": pages_results,
            "formatted_pdf": formatted_pdf_base64
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
