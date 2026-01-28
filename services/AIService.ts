export type AIServiceType = 'gemini' | 'local';

export interface GenerateStickerRequest {
    imageBase64: string | null;
    characterDescription: string;
    plan: {
        emotionPrompt: string;
        actionPrompt: string;
        caption: string;
        emotionId: string;
        actionId: string;
    };
    styleSuffix: string;
    theme: string;
    refinePrompt?: string;
}

export interface IAIService {
    readonly name: string;
    readonly type: AIServiceType;
    generateSticker(request: GenerateStickerRequest): Promise<string>;
    validateConfig(): boolean;
}
