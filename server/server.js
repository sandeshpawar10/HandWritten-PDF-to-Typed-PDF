import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import apiRoutes from './routes/apiRoutes.js';

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3001;

// Validate environment on startup
const requiredEnvVars = ['NODE_ENV'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`⚠️  Warning: Missing optional environment variables: ${missingVars.join(', ')}`);
  console.warn('   The app will use default values, but production deployments should set these.');
}

// Check for Gemini API key configuration
const hasGeminiKey = Boolean(
  (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') ||
  Array.from({ length: 20 }, (_, i) => process.env[`GEMINI_KEY_${String(i + 1).padStart(2, '0')}`])
    .some(k => k && k.trim() && k !== 'your_gemini_api_key_here')
);

if (!hasGeminiKey) {
  console.warn('⚠️  Warning: No Gemini API keys found in environment (GEMINI_API_KEY or GEMINI_KEY_01..20).');
  console.warn('   Server-side OCR endpoints will require valid keys to process documents.');
}

// CORS Configuration - supports dynamic origins via environment variables
const getAllowedOrigins = () => {
  // Production origins (always include these)
  const origins = [
    'https://typed-doc.web.app',  // Firebase Hosting domain
    'https://ai-studio-applet-webapp-a82b5.web.app',  // Firebase project domain
    'https://ai-studio-applet-webapp-a82b5.firebaseapp.com'  // Firebase app domain
  ];

  // Add custom frontend URL from env
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }

  // Add Render URLs if available
  if (process.env.RENDER_EXTERNAL_URL) {
    origins.push(process.env.RENDER_EXTERNAL_URL);
  }

  // Development: Add localhost only in development mode
  if (process.env.NODE_ENV !== 'production') {
    origins.push(
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:5173', // Vite default
      'http://127.0.0.1:5173'
    );
  }

  return origins;
};

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    const allowed = getAllowedOrigins();
    if (allowed.includes(origin)) return callback(null, true);

    // In development mode, allow local network IPs for mobile testing (e.g. http://192.168.x.x:3000)
    if (process.env.NODE_ENV !== 'production') {
      const isLocalNetwork = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin);
      if (isLocalNetwork) return callback(null, true);
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.firebaseapp.com", "https://*.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false // Allow cross-origin resources
}));

// Enable CORS
app.use(cors(corsOptions));

// Enable response compression (gzip/brotli)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Don't compress SSE streams - compression buffers responses
    // and breaks real-time event delivery for chunked OCR
    if (req.path.includes('/ocr/chunked')) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // Balance between compression ratio and CPU usage
}));

// Payload size limits - balance between functionality and memory safety
// Base64-encoded PDFs can be large, but we need to prevent OOM crashes
// on low-memory environments (Render free tier = 512MB RAM)
// Limit: 25MB allows most documents while preventing memory exhaustion
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Issue #25: Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes - API v1
app.use('/api/v1', apiRoutes);

// Backward compatibility - redirect /api to /api/v1
app.use('/api', apiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      'POST /api/v1/ocr',
      'POST /api/v1/ocr/formatted',
      'POST /api/v1/ocr/chunked',
      'GET /health'
    ]
  });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const server = app.listen(port, () => {
  console.log(`✓ Backend server running on http://localhost:${port}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ API Version: v1`);
  console.log(`✓ Health check: http://localhost:${port}/health`);
  console.log(`✓ Gemini Flash OCR: Cloud multimodal processing enabled`);
});

// Graceful shutdown handler
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    console.log('✓ HTTP server closed');
    console.log('✓ Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
