import { API_CONFIG, STORAGE_KEYS, SYSTEM_PROMPT } from '../constants';
import { IAIService, AIServiceType, GenerateStickerRequest } from "./AIService";
import { constructStickerPrompt } from "./promptUtils";

export class LocalAPIService implements IAIService {
    readonly name = 'Local API';
    readonly type: AIServiceType = 'local';

    private getBaseUrl(): string {
        const host = localStorage.getItem(STORAGE_KEYS.localApiHost) || API_CONFIG.local.defaultHost;
        const port = localStorage.getItem(STORAGE_KEYS.localApiPort) || API_CONFIG.local.defaultPort.toString();
        // Ensure protocol is present
        if (host.startsWith('http')) {
            return `${host}:${port}`;
        }
        return `http://${host}:${port}`;
    }

    validateConfig(): boolean {
        // Local API is always "valid" config-wise as it relies on simple host/port defaults
        return true;
    }

    async generateSticker(request: GenerateStickerRequest): Promise<string> {
        try {
            const baseUrl = this.getBaseUrl();
            const url = `${baseUrl}${API_CONFIG.local.endpoints.chat}`;

            const userPrompt = constructStickerPrompt(request);
            // Inject System Prompt for Local API
            const finalPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

            // The Python server expects: { prompt, model, ... }
            const payload: any = {
                prompt: finalPrompt,
                model: API_CONFIG.local.modelName,
                language: 'zh-TW', // Default language
            };

            if (request.imageBase64) {
                // Send raw base64. Server side needs to handle this (e.g. save to temp file or decode)
                payload.images = [request.imageBase64];
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

            // data format: { text: string, images: string[] }
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
        // 1. If it's a Data URI (data:image/png;base64,....)
        if (stringData.startsWith('data:image')) {
            return stringData.split(',')[1];
        }

        // 2. If it is likely a raw Base64 string (not a URL)
        // Simple check: doesn't start with http/https and is reasonably long
        if (!stringData.startsWith('http')) {
            return stringData;
        }

        // 3. If it is a URL, try to fetch it
        try {
            const response = await fetch(stringData);
            if (!response.ok) throw new Error(`Failed to download image from ${stringData}`);
            const blob = await response.blob();

            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    // Remove "data:image/png;base64," prefix
                    const base64 = result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
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
