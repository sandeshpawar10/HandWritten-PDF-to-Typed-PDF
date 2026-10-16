#!/usr/bin/env python3
"""
Advanced Document Formatter
Converts OCR output to beautifully formatted PDF with:
- Proper headings, bold text, spacing
- Images preserved from original
- Math equations in boxes
- Code blocks with syntax highlighting
- Smart layout and margins
"""
import re
import io
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, Table, TableStyle, KeepTogether
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

class DocumentFormatter:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._create_custom_styles()

    def _create_custom_styles(self):
        """Create custom styles for different elements"""

        # Heading 1 - Main headings
        self.styles.add(ParagraphStyle(
            name='CustomHeading1',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=12,
            spaceBefore=16,
            fontName='Helvetica-Bold',
            alignment=TA_LEFT
        ))

        # Heading 2 - Sub headings
        self.styles.add(ParagraphStyle(
            name='CustomHeading2',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#2c3e50'),
            spaceAfter=10,
            spaceBefore=12,
            fontName='Helvetica-Bold',
            alignment=TA_LEFT
        ))

        # Bold text
        self.styles.add(ParagraphStyle(
            name='CustomBold',
            parent=self.styles['Normal'],
            fontSize=11,
            fontName='Helvetica-Bold',
            spaceAfter=6
        ))

        # Normal paragraph with justify
        self.styles.add(ParagraphStyle(
            name='CustomBody',
            parent=self.styles['Normal'],
            fontSize=11,
            leading=16,
            alignment=TA_JUSTIFY,
            spaceAfter=8,
            fontName='Helvetica'
        ))

        # Code block
        self.styles.add(ParagraphStyle(
            name='CustomCode',
            parent=self.styles['Code'],
            fontSize=9,
            fontName='Courier',
            textColor=colors.HexColor('#2c3e50'),
            backColor=colors.HexColor('#f8f9fa'),
            borderPadding=8,
            borderWidth=1,
            borderColor=colors.HexColor('#dee2e6'),
            leftIndent=10,
            rightIndent=10,
            spaceAfter=10
        ))

        # Math equation
        self.styles.add(ParagraphStyle(
            name='CustomMath',
            parent=self.styles['Normal'],
            fontSize=11,
            fontName='Courier',
            textColor=colors.HexColor('#0066cc'),
            backColor=colors.HexColor('#f0f7ff'),
            borderPadding=10,
            borderWidth=2,
            borderColor=colors.HexColor('#0066cc'),
            alignment=TA_CENTER,
            spaceAfter=12,
            spaceBefore=8
        ))

        # Bullet point
        self.styles.add(ParagraphStyle(
            name='CustomBullet',
            parent=self.styles['Normal'],
            fontSize=11,
            leftIndent=20,
            bulletIndent=10,
            spaceAfter=4
        ))

    def detect_content_type(self, text):
        """Detect what type of content this is"""
        text_stripped = text.strip()

        # Math equation indicators
        math_patterns = [
            r'[∫∑∏√∞≈≠≤≥±∂∇]',  # Math symbols
            r'\b(sin|cos|tan|log|ln|exp|lim|dx|dy)\b',  # Math functions
            r'[=<>]\s*\d+\.?\d*',  # Equations with numbers
            r'^\s*[\w\d]+\s*=\s*',  # Variable = expression
            r'\^|\[|\]|\{|\}',  # Common in math notation
        ]

        # Code indicators
        code_patterns = [
            r'^(def|class|function|var|let|const|public|private|void|int|string)\s',
            r'[\{\}\(\);].*[\{\}\(\);]',  # Multiple brackets/semicolons
            r'^[\s]*(if|for|while|return|print|cout|printf)',
            r'(==|!=|<=|>=|\|\||&&)',  # Programming operators
            r'^\s*#include|^\s*import|^\s*from\s+\w+\s+import'
        ]

        # Check for math
        math_score = sum(1 for pattern in math_patterns if re.search(pattern, text_stripped))
        if math_score >= 2:
            return 'math'

        # Check for code
        code_score = sum(1 for pattern in code_patterns if re.search(pattern, text_stripped, re.IGNORECASE))
        if code_score >= 2:
            return 'code'

        # Check for heading (short, uppercase start, high confidence context)
        if len(text_stripped.split()) <= 8 and text_stripped[0].isupper() and not text_stripped.endswith('.'):
            if any(word.isupper() for word in text_stripped.split()):
                return 'heading1'

        # Check for subheading (moderate length, starts with capital)
        if len(text_stripped.split()) <= 12 and text_stripped[0].isupper():
            if re.match(r'^\d+\.?\s+[A-Z]', text_stripped) or text_stripped.endswith(':'):
                return 'heading2'

        # Check for bold (all caps words, emphasis markers)
        if re.search(r'\b[A-Z]{2,}\b', text_stripped) or text_stripped.startswith('**'):
            return 'bold'

        # Check for bullet
        if re.match(r'^[\•\-\*·○●]\s+', text_stripped) or re.match(r'^\d+[\.)]\s+', text_stripped):
            return 'bullet'

        return 'normal'

    def format_text(self, text, content_type):
        """Format text based on content type"""
        text = text.strip()

        # Escape special characters for reportlab
        text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

        if content_type == 'bullet':
            # Clean bullet marker
            text = re.sub(r'^[\•\-\*·○●]\s+', '• ', text)
            text = re.sub(r'^\d+[\.)]\s+', lambda m: f'{m.group().strip()} ', text)

        return text

    def create_formatted_pdf(self, ocr_data, images_data, output_path):
        """
        Create formatted PDF from OCR data and images

        Args:
            ocr_data: List of pages with OCR results
            images_data: List of extracted images with positions
            output_path: Where to save the PDF
        """
        # Create PDF document
        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )

        story = []

        # Add title page
        title_style = self.styles['CustomHeading1']
        story.append(Paragraph("Formatted Document", title_style))
        story.append(Spacer(1, 0.2 * inch))

        # Process each page
        for page_num, page_data in enumerate(ocr_data):
            # Add page break (except for first page)
            if page_num > 0:
                story.append(PageBreak())

            # Get text lines
            lines = page_data.get('text', '').split('\n')

            for line in lines:
                if not line.strip():
                    story.append(Spacer(1, 0.1 * inch))
                    continue

                # Detect content type
                content_type = self.detect_content_type(line)
                formatted_text = self.format_text(line, content_type)

                # Add appropriate element
                if content_type == 'heading1':
                    story.append(Paragraph(formatted_text, self.styles['CustomHeading1']))

                elif content_type == 'heading2':
                    story.append(Paragraph(formatted_text, self.styles['CustomHeading2']))

                elif content_type == 'bold':
                    story.append(Paragraph(f'<b>{formatted_text}</b>', self.styles['CustomBody']))

                elif content_type == 'math':
                    # Math equation in box
                    story.append(self._create_math_box(formatted_text))

                elif content_type == 'code':
                    # Code block
                    story.append(self._create_code_block(formatted_text))

                elif content_type == 'bullet':
                    story.append(Paragraph(formatted_text, self.styles['CustomBullet']))

                else:
                    # Normal paragraph
                    story.append(Paragraph(formatted_text, self.styles['CustomBody']))

            # Add images for this page
            if images_data and page_num < len(images_data):
                for img_data in images_data[page_num]:
                    try:
                        img = Image(img_data['image'], width=4*inch, height=3*inch)
                        story.append(Spacer(1, 0.1 * inch))
                        story.append(img)
                        story.append(Spacer(1, 0.1 * inch))
                    except:
                        pass  # Skip if image fails

        # Build PDF
        doc.build(story)
        return output_path

    def _create_math_box(self, text):
        """Create formatted math equation in a box"""
        # Create table for bordered box
        data = [[text]]
        table = Table(data, colWidths=[6*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f0f7ff')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#0066cc')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), 'Courier'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#0066cc')),
        ]))
        return table

    def _create_code_block(self, text):
        """Create formatted code block"""
        data = [[text]]
        table = Table(data, colWidths=[6*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8f9fa')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2c3e50')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Courier'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#dee2e6')),
        ]))
        return table
