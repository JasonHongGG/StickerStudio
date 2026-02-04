import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import stickerRoutes from './routes/stickerRoutes.js';
import bgRemovalRoutes from './routes/bgRemovalRoutes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'];

app.use(cors({
    origin: corsOrigins,
    credentials: true
}));

// Increase payload limit for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/sticker', stickerRoutes);
app.use('/api/bg-removal', bgRemovalRoutes);

// Root health check
app.get('/', (_req, res) => {
    res.json({ message: 'AI Sticker Studio Backend is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📍 API endpoints:`);
    console.log(`   POST /api/sticker/generate    - Generate sticker`);
    console.log(`   GET  /api/sticker/health      - Sticker health check`);
    console.log(`   POST /api/bg-removal/ai       - AI background removal`);
    console.log(`   GET  /api/bg-removal/health   - ComfyUI health check`);
});
