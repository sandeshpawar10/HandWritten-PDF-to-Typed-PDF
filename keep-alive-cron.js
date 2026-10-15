#!/usr/bin/env node

/**
 * Keep-Alive Cron Job for Render Backend
 *
 * Pings the Render backend every 13 minutes to prevent it from sleeping
 * (Render free tier spins down after 15 minutes of inactivity)
 *
 * Usage:
 * - Run locally: node keep-alive-cron.js
 * - Run with PM2: pm2 start keep-alive-cron.js --name "render-keepalive"
 * - Or deploy as a separate cron service
 */

const BACKEND_URL = 'https://typeddoc.onrender.com';
const HEALTH_ENDPOINT = `${BACKEND_URL}/health`;
const PING_INTERVAL_MS = 13 * 60 * 1000; // 13 minutes in milliseconds

async function pingBackend() {
  const timestamp = new Date().toISOString();

  try {
    console.log(`[${timestamp}] Pinging ${HEALTH_ENDPOINT}...`);

    const response = await fetch(HEALTH_ENDPOINT, {
      method: 'GET',
      headers: {
        'User-Agent': 'KeepAlive-Cron/1.0'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[${timestamp}] ✅ Backend is alive - Status: ${data.status}, Uptime: ${data.uptime}s`);
    } else {
      console.error(`[${timestamp}] ⚠️ Backend responded with status ${response.status}`);
    }
  } catch (error) {
    console.error(`[${timestamp}] ❌ Failed to ping backend:`, error.message);
  }
}

// Initial ping
console.log('🚀 Keep-Alive Cron Job started');
console.log(`📡 Will ping ${HEALTH_ENDPOINT} every 13 minutes`);
pingBackend();

// Set up recurring ping
setInterval(pingBackend, PING_INTERVAL_MS);
