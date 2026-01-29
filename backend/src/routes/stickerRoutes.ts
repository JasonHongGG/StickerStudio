import { Router } from 'express';
import { generateSticker, healthCheck } from '../controllers/stickerController.js';

const router = Router();

// POST /api/sticker/generate - Generate a sticker
router.post('/generate', generateSticker);

// GET /api/sticker/health - Health check
router.get('/health', healthCheck);

export default router;
