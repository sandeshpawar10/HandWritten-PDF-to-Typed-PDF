# Backend Deployment Guide

## Problem
The frontend is deployed on Firebase Hosting, but the backend API server is not deployed. This causes the error: "Unexpected token '<', '<!doctype '... is not valid JSON"

## Solution: Deploy Backend to Render.com (Free Tier)

### Step 1: Prepare Backend for Deployment

The backend is already configured in the `server/` directory. You just need to:

1. Create a `.env` file in the root directory with your Mistral API key:
   ```
   MISTRAL_API_KEY=your_actual_mistral_api_key
   FRONTEND_URL=https://typed-doc.web.app
   NODE_ENV=production
   ```

### Step 2: Deploy to Render

1. **Sign up for Render**: Go to https://render.com and sign up (free)

2. **Create a New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure the service:
     - **Name**: `typed-doc-backend` (or your choice)
     - **Runtime**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `node server/server.js`
     - **Instance Type**: Free

3. **Add Environment Variables** in Render dashboard:
   - `MISTRAL_API_KEY`: Your Mistral API key
   - `FRONTEND_URL`: `https://typed-doc.web.app`
   - `NODE_ENV`: `production`

4. **Deploy**: Click "Create Web Service"

5. **Get your backend URL**: After deployment, Render will give you a URL like:
   `https://typed-doc-backend.onrender.com`

### Step 3: Update Frontend to Use Backend URL

Update `src/services/mistral.js` to point to your deployed backend:

```javascript
const API_BASE = import.meta.env.PROD 
  ? "https://typed-doc-backend.onrender.com"  // Your Render backend URL
  : "http://localhost:3001";
```

Then rebuild and redeploy the frontend:
```bash
npm run build
firebase deploy
```

---

## Option 2: Deploy Backend to Railway (Alternative)

1. Go to https://railway.app
2. Create new project from GitHub repo
3. Add environment variables (same as Render)
4. Configure start command: `node server/server.js`
5. Get the deployed URL and update frontend

---

## Option 3: Use Firebase Cloud Functions (More Complex)

This requires converting the Express app to Firebase Functions format. Contact me if you want to go this route.

---

## Quick Test After Backend Deployment

1. Test backend health endpoint:
   ```bash
   curl https://your-backend-url.onrender.com/health
   ```
   Should return: `{"status":"ok","timestamp":"...","uptime":...}`

2. Update frontend and redeploy

3. Test the application - file uploads should now work!

---

## Important Notes

- **Free Tier Sleep**: Render free tier sleeps after 15 minutes of inactivity. First request after sleep takes ~30 seconds to wake up.
- **CORS**: Already configured in server.js to accept requests from your Firebase frontend
- **API Key Security**: Never commit your `.env` file with real API keys to GitHub
