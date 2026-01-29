import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import stickerRoutes from './routes/stickerRoutes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
    credentials: true
}));

// Increase payload limit for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/sticker', stickerRoutes);

// Root health check
app.get('/', (_req, res) => {
    res.json({ message: 'AI Sticker Studio Backend is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📍 API endpoints:`);
    console.log(`   POST /api/sticker/generate - Generate sticker`);
    console.log(`   GET  /api/sticker/health   - Health check`);
});
