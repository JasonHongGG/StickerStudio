import { Request, Response } from 'express';
import { RemoveBackgroundWorkflow } from '../services/comfyui/index.js';

const workflow = new RemoveBackgroundWorkflow();

/**
 * Process an image using ComfyUI AI background removal
 * POST /api/bg-removal/ai
 * Body: { imageBase64: string }
 */
export async function removeBackgroundAI(req: Request, res: Response): Promise<void> {
    try {
        const { imageBase64, inputNodeId, outputNodeId, parameter } = req.body;

        if (!imageBase64 || typeof imageBase64 !== 'string') {
            res.status(400).json({
                error: 'Missing or invalid imageBase64 in request body'
            });
            return;
        }

        // Remove data URI prefix if present
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        console.log(`[BG Removal] Starting AI processing...`);
        const startTime = Date.now();

        const resolvedInputNodeId =
            typeof inputNodeId === 'string' && inputNodeId.trim().length > 0
                ? inputNodeId.trim()
                : typeof inputNodeId === 'number' && Number.isFinite(inputNodeId)
                    ? String(inputNodeId)
                    : undefined;

        const resolvedOutputNodeId =
            typeof outputNodeId === 'string' && outputNodeId.trim().length > 0
                ? outputNodeId.trim()
                : typeof outputNodeId === 'number' && Number.isFinite(outputNodeId)
                    ? String(outputNodeId)
                    : undefined;

        const result = await workflow.execute({
            imageBase64: base64Data,
            inputNodeId: resolvedInputNodeId,
            outputNodeId: resolvedOutputNodeId,
            parameter: typeof parameter === 'object' && parameter !== null ? parameter : undefined,
        });

        console.log(`[BG Removal] Completed in ${result.processingTimeMs}ms`);

        res.json({
            success: true,
            resultBase64: result.resultBase64,
            processingTimeMs: result.processingTimeMs,
        });
    } catch (error) {
        console.error('[BG Removal] Error:', error);
        res.status(500).json({
            error: 'Failed to process image',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

/**
 * Health check for ComfyUI connectivity
 * GET /api/bg-removal/health
 */
export async function healthCheck(_req: Request, res: Response): Promise<void> {
    try {
        const isHealthy = await workflow.healthCheck();

        res.json({
            status: isHealthy ? 'ok' : 'degraded',
            comfyui: isHealthy ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        res.status(503).json({
            status: 'error',
            comfyui: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
