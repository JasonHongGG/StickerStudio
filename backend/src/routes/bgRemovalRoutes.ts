import { Router } from 'express';
import { removeBackgroundAI, healthCheck } from '../controllers/bgRemovalController.js';

const router = Router();

/**
 * POST /api/bg-removal/ai
 * Process an image using ComfyUI AI background removal
 */
router.post('/ai', removeBackgroundAI);

/**
 * GET /api/bg-removal/health
 * Check ComfyUI server connectivity
 */
router.get('/health', healthCheck);

export default router;
