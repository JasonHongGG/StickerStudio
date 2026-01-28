import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT, API_CONFIG, STORAGE_KEYS } from "../constants";
import { IAIService, AIServiceType, GenerateStickerRequest } from "./AIService";
import { constructStickerPrompt } from "./promptUtils";

/**
 * Encodes a File object to base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export class GeminiService implements IAIService {
    readonly name = 'Google Gemini';
    readonly type: AIServiceType = 'gemini';

    private getClient() {
        // 1. Try to get key from Local Storage (User setting)
        const localKey = localStorage.getItem(STORAGE_KEYS.geminiApiKey);
        if (localKey && localKey.trim() !== '') {
            return new GoogleGenAI({ apiKey: localKey.trim() });
        }

        // 2. Fallback to Environment Variable (System setting)
        const envKey = process.env.API_KEY;
        if (envKey) {
            return new GoogleGenAI({ apiKey: envKey });
        }

        // 3. No key found
        throw new Error("找不到 Gemini API Key。請點擊右上角「設定」手動輸入您的 API Key。");
    }

    validateConfig(): boolean {
        const localKey = localStorage.getItem(STORAGE_KEYS.geminiApiKey);
        const envKey = process.env.API_KEY;
        return !!(localKey?.trim() || envKey);
    }

    async generateSticker(request: GenerateStickerRequest): Promise<string> {
        try {
            const client = this.getClient();
            const finalUserPrompt = constructStickerPrompt(request);
            const { imageBase64 } = request;

            // Prepare API Content
            const requestParts: any[] = [];

            if (imageBase64) {
                requestParts.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: imageBase64
                    }
                });
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
                const parts = candidates[0].content.parts;
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.data) {
                        return part.inlineData.data;
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