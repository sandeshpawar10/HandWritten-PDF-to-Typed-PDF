#!/bin/bash
# Render build script for TypedDoc (Node.js + Gemini Flash)
set -e

echo "📦 Installing Node.js dependencies (including build tools)..."
npm install --include=dev

echo "🔨 Building frontend assets..."
npm run build

echo "✅ Build completed successfully!"
