import { GoogleGenAI } from "@google/genai";
import { API_CONFIG } from "../config/constants.js";
import { IAIService, AIServiceType, GenerateStickerRequest } from "./AIService.js";
import { SYSTEM_PROMPT, constructStickerPrompt } from "./prompts.js";

export class GeminiService implements IAIService {
    readonly name = 'Google Gemini';
    readonly type: AIServiceType = 'gemini';

    private getClient() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY environment variable is not set.");
        }
        return new GoogleGenAI({ apiKey });
    }

    validateConfig(): boolean {
        return !!process.env.GEMINI_API_KEY;
    }

    async generateSticker(request: GenerateStickerRequest): Promise<string> {
        try {
            const client = this.getClient();
            const finalUserPrompt = constructStickerPrompt(request);
            const { imageBase64, additionalImageBase64 } = request;

            // Prepare API Content
            const requestParts: any[] = [];

            // Add primary image (style sheet 1)
            if (imageBase64) {
                const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
                requestParts.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: base64Data
                    }
                });
            }

            // Add additional style sheets (sheets 2, 3, etc.)
            if (additionalImageBase64 && additionalImageBase64.length > 0) {
                for (const imgBase64 of additionalImageBase64) {
                    const base64Data = imgBase64.includes(',') ? imgBase64.split(',')[1] : imgBase64;
                    requestParts.push({
                        inlineData: {
                            mimeType: 'image/png',
                            data: base64Data
                        }
                    });
                }
            }

            requestParts.push({ text: finalUserPrompt });

            const response = await client.models.generateContent({
                model: API_CONFIG.gemini.modelName,
                contents: {
                    parts: requestParts
                },
                config: {
                    systemInstruction: SYSTEM_PROMPT
                }
            });

            const candidates = response.candidates;
            if (candidates && candidates.length > 0) {
                const parts = candidates[0].content?.parts;
                if (parts) {
                    for (const part of parts) {
                        if (part.inlineData && part.inlineData.data) {
                            return part.inlineData.data;
                        }
                    }
                }
            }

            throw new Error("No image generated.");
        } catch (error) {
            console.error("Gemini API Error:", error);
            throw error;
        }
    }
}
