import { Request, Response } from 'express';
import { AIServiceFactory } from '../services/AIServiceFactory.js';
import { GenerateStickerRequest } from '../services/AIService.js';
import { resolveEmotionPrompt, resolveActionPrompt } from '../services/prompts.js';

interface GenerateRequestBody {
    imageBase64: string | null;
    additionalImageBase64?: string[];
    characterDescription: string;
    plan: {
        emotionPrompt?: string;
        actionPrompt?: string;
        caption: string;
        emotionId: string;
        actionId: string;
    };
    styleSuffix: string;
    theme: string;
    refinePrompt?: string;
}

export const generateSticker = async (req: Request, res: Response) => {
    try {
        const body = req.body as GenerateRequestBody;

        // Validate required fields
        if (!body.plan) {
            return res.status(400).json({ error: 'Missing plan in request body' });
        }

        // Resolve prompts from IDs on the backend
        const emotionPrompt = body.plan.emotionPrompt || resolveEmotionPrompt(body.plan.emotionId);
        const actionPrompt = body.plan.actionPrompt || resolveActionPrompt(body.plan.actionId);

        const request: GenerateStickerRequest = {
            imageBase64: body.imageBase64,
            additionalImageBase64: body.additionalImageBase64,
            characterDescription: body.characterDescription || '',
            plan: {
                emotionPrompt,
                actionPrompt,
                caption: body.plan.caption || '',
                emotionId: body.plan.emotionId,
                actionId: body.plan.actionId
            },
            styleSuffix: body.styleSuffix || '',
            theme: body.theme || '',
            refinePrompt: body.refinePrompt
        };

        const aiService = AIServiceFactory.getCurrentService();

        if (!aiService.validateConfig()) {
            return res.status(500).json({
                error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
            });
        }

        const generatedBase64 = await aiService.generateSticker(request);

        return res.json({
            success: true,
            imageBase64: generatedBase64
        });

    } catch (error) {
        console.error('Sticker generation error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        return res.status(500).json({ error: message });
    }
};

export const healthCheck = (_req: Request, res: Response) => {
    const aiService = AIServiceFactory.getCurrentService();
    const isConfigured = aiService.validateConfig();

    return res.json({
        status: 'ok',
        service: aiService.name,
        configured: isConfigured
    });
};
