# PaddleOCR Deployment Guide for Render

This guide explains how to deploy your typed-document backend with PaddleOCR on Render.

## Overview

Your backend now uses **PaddleOCR** (free, open-source OCR) running via Python subprocess. No API keys or external services required.

## Prerequisites

- Render account (free tier works)
- GitHub repository connected to Render
- Firebase credentials configured in Render environment variables

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Add PaddleOCR with Render deployment config"
   git push
   ```

2. **Create new Web Service on Render**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml`

3. **Verify configuration**
   - Service name: `typed-document-backend`
   - Environment: `node`
   - Build command: `npm install && pip3 install -r requirements.txt`
   - Start command: `npm run server`

4. **Add environment variables** (if needed)
   - `FIREBASE_SERVICE_ACCOUNT` - Your Firebase admin credentials (JSON)
   - `FRONTEND_URL` - Your frontend URL for CORS
   - `NODE_ENV` - Already set to `production` in render.yaml

5. **Deploy**
   - Click "Create Web Service"
   - Wait 5-10 minutes for initial build

### Option 2: Manual Setup

1. **Create new Web Service**
   - Go to Render Dashboard → New + → Web Service
   - Connect repository

2. **Configure build settings**
   - **Name**: `typed-document-backend`
   - **Region**: Oregon (or closest to your users)
   - **Branch**: `main`
   - **Root Directory**: Leave empty
   - **Environment**: `Node`
   - **Build Command**: `./build.sh`
   - **Start Command**: `npm run server`

3. **Add environment variables**
   - `PYTHON_VERSION` = `3.11`
   - `NODE_ENV` = `production`
   - `FIREBASE_SERVICE_ACCOUNT` = Your Firebase JSON credentials
   - `FRONTEND_URL` = Your frontend URL

4. **Deploy**

## Files Added for Deployment

- **`requirements.txt`** - Python dependencies (PaddleOCR, Pillow)
- **`render.yaml`** - Render service configuration
- **`build.sh`** - Build script for installing dependencies
- **`server/ocr_paddle.py`** - Python OCR script
- **`server/services/paddleOcrService.js`** - Node.js wrapper

## Verifying Deployment

1. **Check build logs**
   - Look for "Installing Python dependencies..."
   - Confirm PaddleOCR installation succeeded

2. **Test health endpoint**
   ```bash
   curl https://your-service.onrender.com/health
   ```
   
   Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2026-10-15T18:48:11.951Z",
     "uptime": 123.45
   }
   ```

3. **Test OCR endpoint** (requires authentication)
   - Send a POST request to `/api/ocr` with a base64 image
   - Should return OCR text results

## Performance Expectations

### Free Tier (512MB RAM, 0.5 vCPU)
- **Processing time**: 2-5 seconds per page
- **Capacity**: ~2-3 requests/minute
- **Cold start**: 15-20 seconds after 15 min idle
- **Suitable for**: Personal projects, prototypes

### Starter Plan ($7/mo)
- **Always on**: No cold starts
- **Same specs**: 512MB RAM, 0.5 vCPU
- **Better for**: Low-traffic production apps

### Standard Plan ($25/mo)
- **RAM**: 2GB (better for concurrent requests)
- **vCPU**: 1.0 dedicated
- **Capacity**: ~10-15 requests/minute
- **Better for**: Production apps with multiple users

## Troubleshooting

### Build fails with "pip3: command not found"
- Render should have Python 3.11 pre-installed
- Check build logs for Python version
- Try setting `PYTHON_VERSION=3.11` in environment variables

### "PaddleOCR service unavailable"
- Python dependencies failed to install
- Check build logs for pip install errors
- Verify `requirements.txt` is in root directory

### Out of memory errors
- Free tier has 512MB RAM limit
- PaddleOCR uses ~300-500MB when loaded
- Solution: Upgrade to Standard plan ($25/mo) with 2GB RAM

### Slow first request (cold start)
- Expected on free tier after 15 min idle
- PaddleOCR model loads on first use (~5-10 seconds)
- Solution: Upgrade to Starter plan ($7/mo) for always-on

### OCR accuracy issues
- PaddleOCR best for printed text
- For handwritten text, accuracy may vary
- Ensure images are high resolution (300+ DPI)

## Monitoring

- **View logs**: Render Dashboard → Your Service → Logs
- **Check metrics**: Dashboard → Metrics tab
- **Health checks**: Render pings `/health` every 60 seconds

## Cost Estimate

- **Free tier**: $0/month (750 hours free compute)
- **Starter**: $7/month (always-on, no cold starts)
- **Standard**: $25/month (2GB RAM, better performance)

## Next Steps

1. Deploy to Render using steps above
2. Test OCR functionality with your frontend
3. Monitor performance and upgrade plan if needed
4. Consider adding:
   - Request queuing (Bull/BullMQ with Redis)
   - Result caching in Firestore
   - Rate limiting per user

## Support

- [Render Documentation](https://render.com/docs)
- [PaddleOCR GitHub](https://github.com/PaddlePaddle/PaddleOCR)
- Check Render build logs for detailed error messages
