#!/bin/bash
# Render build script for PaddleOCR deployment
set -e

echo "📦 Installing Node.js dependencies..."
npm install

echo "🐍 Upgrading pip and build tools..."
pip3 install --upgrade pip setuptools wheel

echo "🐍 Installing Python dependencies (no cache)..."
pip3 install --no-cache-dir -r requirements.txt

echo "✅ Verifying installations..."
python3 --version
python3 -c "import paddle; print(f'PaddlePaddle {paddle.__version__} installed')" || echo "⚠️ PaddlePaddle verification failed"
python3 -c "from paddleocr import PaddleOCR; print('PaddleOCR installed successfully')" || echo "⚠️ PaddleOCR verification failed"

echo "⬇️ Pre-downloading PaddleOCR models..."
python3 -c "
from paddleocr import PaddleOCR
ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False, use_gpu=False)
print('PaddleOCR models downloaded and cached successfully')
" || echo "⚠️ PaddleOCR model pre-download failed (models will download on first request)"

echo "✅ Build completed successfully!"
