# Deployment Guide

## Render Deployment

This backend uses Node.js with Python for PaddleOCR processing.

### Build Process

The build script (`build.sh`) installs both Node.js and Python dependencies:

1. Node.js dependencies via `npm install`
2. Python dependencies via `pip3 install -r requirements.txt`

### Python Dependencies

- **PaddlePaddle 2.6.1** - Stable version compatible with Render's free tier
- **PaddleOCR 2.7.3** - OCR library for handwriting recognition
- **Pillow 10.3.0** - Image processing

### Troubleshooting

#### OCR 500 Errors

If you see errors like:
```
Server error: OCR error: /opt/render/project/src/.venv/lib/python3.11/site-packages/paddle/utils/cpp_extension/extension_util
```

This indicates PaddlePaddle installation failed. Check:

1. **Render Build Logs** - Look for Python installation errors
2. **Python Version** - Ensure Python 3.11 is being used
3. **Memory Issues** - Free tier has 512MB RAM limit

#### Common Solutions

1. **Redeploy** - Sometimes a clean deployment fixes transient issues
2. **Check Build Logs** - Verify Python packages installed successfully
3. **Memory Optimization** - PaddleOCR runs in CPU mode to reduce memory usage

### Manual Deployment Steps

If automatic deployment fails:

1. Go to Render Dashboard
2. Select your service
3. Click "Manual Deploy" → "Deploy latest commit"
4. Monitor build logs for errors

### Environment Variables

Required environment variables are set in `render.yaml`:
- `NODE_ENV=production`
- `PORT=3001`
- `PYTHON_VERSION=3.11`
- `PIP_NO_CACHE_DIR=1`

### Health Check

The service exposes a `/health` endpoint for Render's health checks.

### Logs

To view server logs:
1. Go to Render Dashboard
2. Select your service
3. Click "Logs" tab
4. Filter by "Server" to see application logs

### Testing OCR Locally

To test PaddleOCR locally:

```bash
# Install Python dependencies
pip3 install -r requirements.txt

# Start the server
npm run server

# Test OCR endpoint (requires authentication token)
curl -X POST http://localhost:3001/api/v1/ocr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"document":{"image_url":"data:image/jpeg;base64,..."}}'
```

### Performance Notes

- First OCR request after cold start takes 30-60 seconds (PaddleOCR initialization)
- Subsequent requests are faster (2-10 seconds depending on image size)
- Free tier may sleep after 15 minutes of inactivity
- Keep-alive cron job prevents sleep: `keep-alive.yml` workflow
