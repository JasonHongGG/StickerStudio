import { API_CONFIG } from '../config/constants.js';
import { IAIService, AIServiceType, GenerateStickerRequest } from "./AIService.js";
import { SYSTEM_PROMPT, constructStickerPrompt } from "./prompts.js";

export class LocalAPIService implements IAIService {
    readonly name = 'Local API';
    readonly type: AIServiceType = 'local';

    private getBaseUrl(): string {
        const host = process.env.LOCAL_API_HOST || API_CONFIG.local.defaultHost;
        const port = process.env.LOCAL_API_PORT || API_CONFIG.local.defaultPort.toString();
        if (host.startsWith('http')) {
            return `${host}:${port}`;
        }
        return `http://${host}:${port}`;
    }

    validateConfig(): boolean {
        return true;
    }

    async generateSticker(request: GenerateStickerRequest): Promise<string> {
        try {
            const baseUrl = this.getBaseUrl();
            const url = `${baseUrl}${API_CONFIG.local.endpoints.chat}`;

            const userPrompt = constructStickerPrompt(request);
            const finalPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

            const payload: any = {
                prompt: finalPrompt,
                model: API_CONFIG.local.modelName,
                language: 'zh-TW',
            };

            // Collect all style sheet images
            const allImages: string[] = [];
            if (request.imageBase64) {
                const base64Data = request.imageBase64.includes(',')
                    ? request.imageBase64.split(',')[1]
                    : request.imageBase64;
                allImages.push(base64Data);
            }
            if (request.additionalImageBase64 && request.additionalImageBase64.length > 0) {
                for (const imgBase64 of request.additionalImageBase64) {
                    const base64Data = imgBase64.includes(',') ? imgBase64.split(',')[1] : imgBase64;
                    allImages.push(base64Data);
                }
            }

            if (allImages.length > 0) {
                payload.images = allImages;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Local API Error (${response.status}): ${errorText}`);
            }

            const data = await response.json();

            if (data.images && Array.isArray(data.images) && data.images.length > 0) {
                const imageUrl = data.images[0];
                return await this.fetchImageAsBase64(imageUrl);
            }

            throw new Error("Local API succeeded but returned no images.");

        } catch (error) {
            console.error("Local APIService Error:", error);
            throw error;
        }
    }

    private async fetchImageAsBase64(stringData: string): Promise<string> {
        if (stringData.startsWith('data:image')) {
            return stringData.split(',')[1];
        }

        if (!stringData.startsWith('http')) {
            return stringData;
        }

        try {
            const response = await fetch(stringData);
            if (!response.ok) throw new Error(`Failed to download image from ${stringData}`);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            return buffer.toString('base64');
        } catch (e) {
            console.error("Failed to convert image result to base64:", e);
            throw e;
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            const baseUrl = this.getBaseUrl();
            const url = `${baseUrl}${API_CONFIG.local.endpoints.health}`;
            const response = await fetch(url);
            return response.ok;
        } catch (e) {
            return false;
        }
    }
}
