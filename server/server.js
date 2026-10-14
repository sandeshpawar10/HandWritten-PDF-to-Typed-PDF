import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/apiRoutes.js';

const app = express();
const port = process.env.PORT || 3001;

// CORS Configuration - supports dynamic origins via environment variables
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production') {
    // Production: Use environment variable or infer from Render
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

    console.log('✓ CORS allowed origins:', origins);
    return origins;
  }

  // Development: Allow common local dev servers
  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173', // Vite default
    'http://127.0.0.1:5173'
  ];
};

const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

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

// Routes
app.use('/api', apiRoutes);

// Issue #9: Validate environment on startup
const requiredEnvVars = ['MISTRAL_API_KEY'];
const missingVars = requiredEnvVars.filter(varName =>
  !process.env[varName] || process.env[varName] === 'your_mistral_api_key_here'
);

if (missingVars.length > 0) {
  console.error('✗ Missing required environment variables:', missingVars.join(', '));
  console.error('  Copy .env.example to .env and configure your API keys.');
  process.exit(1);
}

app.listen(port, () => {
  console.log(`✓ Backend server running on http://localhost:${port}`);
  console.log(`✓ Health check available at http://localhost:${port}/health`);
});
