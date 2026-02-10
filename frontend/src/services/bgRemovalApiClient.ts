// @ts-ignore - Vite env
const API_BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || 'http://localhost:3001';

/**
 * Remove background from an image using ComfyUI AI
 * @param imageBase64 - Base64 encoded image (with or without data URI prefix)
 * @returns Base64 encoded result image (without prefix)
 */
export async function removeBackgroundWithAI(
    imageBase64: string,
    parameter?: Record<string, unknown>
): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/bg-removal/ai`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64, parameter }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.resultBase64;
}

/**
 * Check if ComfyUI server is available
 * @returns true if server is connected
 */
export async function checkComfyUIHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/bg-removal/health`);
        if (!response.ok) return false;
        const data = await response.json();
        return data.comfyui === 'connected';
    } catch {
        return false;
    }
}
