export interface StickerStyle {
    id: string;
    name: string;
    promptSuffix: string;
}

export interface ReferenceImage {
    id: string;
    file: File;
    previewUrl: string;
}

export interface Emotion {
    id: string;
    name: string; // Display name
    enName: string; // Prompt name
}

export interface Action {
    id: string;
    name: string; // Display name
    enName: string; // Prompt name
}

export interface StickerPlanItem {
    id: string;
    emotionId: string; // 'auto', 'same', specific ID, or 'custom-emotion'
    customEmotionText?: string; // If emotionId is 'custom'
    actionId: string; // 'auto', 'same', specific ID, or custom text
    customActionText?: string; // If actionId is 'custom'
    caption: string;
}

export interface GeneratedImage {
    id: string;
    expressionName: string; // Legacy field, now acts as a summary string
    // New fields for granular tracking
    planDetails?: {
        emotion: string;
        action: string;
        caption: string;
    };
    originalImageBlob: Blob; // The 370x320 transparent PNG
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
    // Grouping fields
    batchId: string;
    batchName: string; // User defined name for the pack
    styleName: string;
    createdAt: number;
    downloadOptions: {
        includeMain: boolean; // 240x240
        includeTab: boolean; // 96x74
    };
}

export interface StickerPackInfo {
    id: string;
    name: string;
    createdAt: number;
}
