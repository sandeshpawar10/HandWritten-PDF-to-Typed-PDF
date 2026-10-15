# Keep Render Backend Awake - Setup Guide

Your Render free tier backend sleeps after 15 minutes of inactivity. This guide shows how to keep it awake with automated health checks every 13 minutes.

## Option 1: GitHub Actions (Recommended - Free & Reliable)

GitHub Actions can ping your backend every 13 minutes for free.

### Setup Steps:

1. **The workflow file is already created** at `.github/workflows/keep-alive.yml`

2. **Enable GitHub Actions:**
   - Go to your GitHub repository: https://github.com/sandeshpawar10/HandWritten-PDF-to-Typed-PDF
   - Click **"Actions"** tab
   - If prompted, click **"Enable workflows"**

3. **Verify it's running:**
   - The workflow runs automatically every 13 minutes
   - Check the Actions tab to see ping logs
   - Each run shows: "✅ Backend is alive" or error details

### How it works:
- Runs every 13 minutes (cron: `*/13 * * * *`)
- Pings `https://typeddoc.onrender.com/health`
- Logs response time and status
- Completely free (GitHub Actions provides 2000 minutes/month free)

---

## Option 2: UptimeRobot (Free External Service)

A dedicated uptime monitoring service that also keeps your backend awake.

### Setup Steps:

1. **Sign up for free:**
   - Go to: https://uptimerobot.com/
   - Create a free account (no credit card required)

2. **Add a monitor:**
   - Click **"+ Add New Monitor"**
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** TypedDoc Backend
   - **URL:** `https://typeddoc.onrender.com/health`
   - **Monitoring Interval:** 5 minutes (free tier limit)

3. **Save and activate**

### Benefits:
- Email alerts if backend goes down
- Public status page option
- Better than 13 minutes (checks every 5 min)
- Web dashboard for monitoring

---

## Option 3: Cron-Job.org (Free Cron Service)

Another free service specifically for cron jobs.

### Setup Steps:

1. **Sign up:**
   - Go to: https://cron-job.org/
   - Create free account

2. **Create cron job:**
   - Click **"Create cronjob"**
   - **Title:** Keep TypedDoc Awake
   - **Address:** `https://typeddoc.onrender.com/health`
   - **Schedule:** Every 13 minutes
   - **Execution:** Enable

3. **Save**

---

## Option 4: Run Locally (Development Only)

If you want to test the keep-alive locally:

```bash
node keep-alive-cron.js
```

Or with PM2 (keeps running in background):

```bash
npm install -g pm2
pm2 start keep-alive-cron.js --name "render-keepalive"
pm2 logs render-keepalive
```

**Note:** This only works while your computer is on.

---

## Comparison

| Solution | Cost | Reliability | Setup Time | Alerts |
|----------|------|-------------|------------|--------|
| **GitHub Actions** | Free | ⭐⭐⭐⭐⭐ | 2 min | Logs only |
| **UptimeRobot** | Free | ⭐⭐⭐⭐⭐ | 5 min | Email alerts ✅ |
| **Cron-Job.org** | Free | ⭐⭐⭐⭐ | 3 min | Email alerts ✅ |
| **Local Script** | Free | ⭐⭐ (computer must be on) | 1 min | None |

---

## Recommended Setup

**Best combination:**
1. **GitHub Actions** (primary) - Always running, free
2. **UptimeRobot** (backup) - Alerts you if backend is down

This gives you:
- ✅ Backend stays awake 24/7
- ✅ Email alerts if something breaks
- ✅ Completely free
- ✅ No manual intervention needed

---

## Verify It's Working

After setup, check:

1. **GitHub Actions logs:**
   - Go to Actions tab in your repo
   - Should see successful runs every 13 minutes

2. **Backend logs in Render:**
   - Go to Render dashboard
   - Click on TypedDoc service
   - Check logs for health check requests

3. **Test cold start:**
   - Wait 20 minutes without using the app
   - Try to upload a document
   - Should be fast (no 50-second delay) if keep-alive is working

---

## Current Status

Your backend: `https://typeddoc.onrender.com`

Check if it's currently awake:
```bash
curl https://typeddoc.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-10-15T19:36:24.212Z",
  "uptime": 123.45
}
```
