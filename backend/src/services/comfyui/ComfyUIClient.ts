import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';

/**
 * Configuration for ComfyUI client
 */
export interface ComfyUIConfig {
    baseUrl: string;
    clientId?: string;
    timeout?: number;
    pollIntervalMs?: number;
    maxWaitTimeMs?: number;
}

/**
 * Image info returned from ComfyUI history
 */
export interface ComfyUIImageInfo {
    filename: string;
    subfolder: string;
    type: string;
}

/**
 * Output structure from ComfyUI history
 */
export interface ComfyUIOutput {
    images?: ComfyUIImageInfo[];
}

/**
 * History entry for a prompt
 */
export interface ComfyUIHistoryEntry {
    outputs: Record<string, ComfyUIOutput>;
    status?: {
        completed: boolean;
        status_str?: string;
    };
}

/**
 * Shared HTTP client for ComfyUI API interactions.
 * Handles image upload, prompt queueing, polling, and result download.
 */
export class ComfyUIClient {
    private readonly http: AxiosInstance;
    private readonly clientId: string;
    private readonly pollIntervalMs: number;
    private readonly maxWaitTimeMs: number;

    constructor(config: ComfyUIConfig) {
        const baseURL = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash

        this.http = axios.create({
            baseURL,
            timeout: config.timeout || 300000, // 5 minutes default
        });

        this.clientId = config.clientId || this.generateClientId();
        this.pollIntervalMs = config.pollIntervalMs || 500;
        this.maxWaitTimeMs = config.maxWaitTimeMs || 3600000; // 1 hour default
    }

    /**
     * Generate a unique client ID
     */
    private generateClientId(): string {
        return `client-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Upload an image to ComfyUI
     * @param imageBuffer - The image data as a Buffer
     * @param filename - The filename to use in ComfyUI
     * @returns The filename assigned by ComfyUI (may differ from input)
     */
    async uploadImage(imageBuffer: Buffer, filename: string): Promise<string> {
        const form = new FormData();
        form.append('image', imageBuffer, { filename });
        form.append('overwrite', 'true');

        const response = await this.http.post('/upload/image', form, {
            headers: form.getHeaders(),
        });

        return response.data.name;
    }

    /**
     * Queue a prompt for execution
     * @param promptGraph - The workflow prompt graph object
     * @returns The prompt ID for tracking
     */
    async queuePrompt(promptGraph: object): Promise<string> {
        const response = await this.http.post('/prompt', {
            prompt: promptGraph,
            client_id: this.clientId,
        });

        return response.data.prompt_id;
    }

    /**
     * Get the history/output for a specific prompt
     * @param promptId - The prompt ID to query
     */
    async getHistory(promptId: string): Promise<Record<string, ComfyUIHistoryEntry>> {
        const response = await this.http.get(`/history/${promptId}`);
        return response.data;
    }

    /**
     * Wait for a prompt to complete processing
     * @param promptId - The prompt ID to wait for
     * @returns The history entry once complete
     */
    async waitForCompletion(promptId: string): Promise<ComfyUIHistoryEntry> {
        const startTime = Date.now();

        while (true) {
            const elapsed = Date.now() - startTime;
            if (elapsed > this.maxWaitTimeMs) {
                throw new Error(`Timeout waiting for prompt ${promptId} after ${elapsed}ms`);
            }

            try {
                const history = await this.getHistory(promptId);
                const entry = history[promptId];

                if (entry && entry.outputs && Object.keys(entry.outputs).length > 0) {
                    return entry;
                }
            } catch (error) {
                // History not ready yet, continue polling
            }

            await this.sleep(this.pollIntervalMs);
        }
    }

    /**
     * Download an image from ComfyUI
     * @param imageInfo - The image info from history output
     * @returns The image data as a Buffer
     */
    async downloadImage(imageInfo: ComfyUIImageInfo): Promise<Buffer> {
        const response = await this.http.get('/view', {
            params: {
                filename: imageInfo.filename,
                subfolder: imageInfo.subfolder || '',
                type: imageInfo.type || 'output',
            },
            responseType: 'arraybuffer',
        });

        return Buffer.from(response.data);
    }

    /**
     * Find and download the first output image from a history entry
     * @param historyEntry - The completed history entry
     * @returns The first output image as a Buffer
     */
    async downloadFirstOutputImage(historyEntry: ComfyUIHistoryEntry): Promise<Buffer> {
        for (const [_nodeId, output] of Object.entries(historyEntry.outputs)) {
            if (output.images && output.images.length > 0) {
                return this.downloadImage(output.images[0]);
            }
        }
        throw new Error('No output images found in history entry');
    }

    /**
     * Check if ComfyUI server is reachable
     */
    async healthCheck(): Promise<boolean> {
        try {
            await this.http.get('/system_stats', { timeout: 5000 });
            return true;
        } catch {
            return false;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
