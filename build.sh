#!/bin/bash
# Render build script for PaddleOCR deployment

echo "📦 Installing Node.js dependencies..."
npm install

echo "🐍 Installing Python dependencies..."
pip3 install --upgrade pip
pip3 install -r requirements.txt

echo "✅ Build completed successfully!"
