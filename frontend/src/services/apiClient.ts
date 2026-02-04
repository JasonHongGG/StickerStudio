/**
 * API Client for Backend Communication
 * All AI-related calls go through this service to the backend
 */

export interface GenerateStickerRequestDTO {
    imageBase64: string | null;
    additionalImageBase64?: string[];
    characterDescription: string;
    plan: {
        caption: string;
        emotionId: string;
        actionId: string;
        emotionPrompt: string;
        actionPrompt: string;
    };
    styleSuffix: string;
    theme: string;
    refinePrompt?: string;
}

export interface GenerateStickerResponseDTO {
    success: boolean;
    imageBase64?: string;
    error?: string;
}

export interface HealthCheckResponseDTO {
    status: string;
    service: string;
    configured: boolean;
}

const API_BASE = '/api/sticker';

/**
 * Generate a sticker using the backend AI service
 */
export async function generateSticker(request: GenerateStickerRequestDTO): Promise<string> {
    const response = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data: GenerateStickerResponseDTO = await response.json();

    if (!data.success || !data.imageBase64) {
        throw new Error(data.error || 'No image returned from API');
    }

    return data.imageBase64;
}

/**
 * Check backend health and configuration
 */
export async function checkHealth(): Promise<HealthCheckResponseDTO> {
    const response = await fetch(`${API_BASE}/health`);

    if (!response.ok) {
        throw new Error(`Health check failed: HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Validate that the backend is configured and ready
 */
export async function validateBackendConfig(): Promise<boolean> {
    try {
        const health = await checkHealth();
        return health.configured;
    } catch {
        return false;
    }
}
