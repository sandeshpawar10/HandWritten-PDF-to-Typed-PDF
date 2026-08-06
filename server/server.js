import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/apiRoutes.js';

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
// Mistral OCR needs large payload limits for base64 images (up to 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api', apiRoutes);

app.listen(port, () => {
  console.log(`Backend proxy server running on http://localhost:${port}`);
});
