import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ComfyUIClient, ComfyUIConfig } from '../ComfyUIClient.js';
import { IComfyUIWorkflow, ImageWorkflowInput, ImageWorkflowOutput } from '../IComfyUIWorkflow.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Background removal workflow using ComfyUI.
 * Uses a pre-configured workflow JSON that expects a LoadImage node at position "1".
 */
export class RemoveBackgroundWorkflow implements IComfyUIWorkflow<ImageWorkflowInput, ImageWorkflowOutput> {
    readonly name = 'Remove Background';
    readonly workflowJsonPath = 'data/remove_background.json';

    private readonly client: ComfyUIClient;
    private readonly workflowTemplate: Record<string, any>;

    constructor(config?: ComfyUIConfig) {
        // Use environment variable or default URL
        const baseUrl = config?.baseUrl || process.env.COMFYUI_URL || 'https://gpu1.trytryalberthong.dpdns.org';

        this.client = new ComfyUIClient({
            baseUrl,
            ...config,
        });

        // Load the workflow template (must exist)
        const workflowPath = join(__dirname, this.workflowJsonPath);
        try {
            const content = readFileSync(workflowPath, 'utf-8');
            this.workflowTemplate = JSON.parse(content);
        } catch (error) {
            throw new Error(
                `Workflow JSON not found at ${workflowPath}. ` +
                `Please export your ComfyUI workflow using "Save (API Format)" and place it at: ` +
                `backend/src/services/comfyui/workflows/data/remove_background.json`
            );
        }
    }

    /**
     * Execute the background removal workflow
     * @param input - The input image as base64
     * @returns The processed image as base64
     */
    async execute(input: ImageWorkflowInput): Promise<ImageWorkflowOutput> {
        const startTime = Date.now();

        // 1. Convert base64 to buffer
        const imageBuffer = Buffer.from(input.imageBase64, 'base64');
        const filename = input.filename || `input_${Date.now()}.png`;

        // 2. Upload image to ComfyUI
        const uploadedFilename = await this.client.uploadImage(imageBuffer, filename);

        // 3. Clone workflow and inject the uploaded filename
        const promptGraph = this.injectInputImage(uploadedFilename);

        // 4. Queue the prompt
        const promptId = await this.client.queuePrompt(promptGraph);

        // 5. Wait for completion
        const historyEntry = await this.client.waitForCompletion(promptId);

        // 6. Download the result image
        const resultBuffer = await this.client.downloadFirstOutputImage(historyEntry);

        // 7. Convert to base64
        const resultBase64 = resultBuffer.toString('base64');

        return {
            resultBase64,
            processingTimeMs: Date.now() - startTime,
        };
    }

    /**
     * Inject the uploaded image filename into the workflow template
     */
    private injectInputImage(filename: string): Record<string, any> {
        // Deep clone the template
        const graph = JSON.parse(JSON.stringify(this.workflowTemplate));

        // Find the LoadImage node by class_type and update its image field
        let found = false;
        for (const [nodeId, node] of Object.entries(graph)) {
            const nodeObj = node as any;
            if (nodeObj.class_type === 'LoadImage' && nodeObj.inputs) {
                nodeObj.inputs.image = filename;
                found = true;
                console.log(`[ComfyUI] Injected image "${filename}" into LoadImage node "${nodeId}"`);
                break;
            }
        }

        if (!found) {
            throw new Error('No LoadImage node found in workflow template');
        }

        return graph;
    }

    /**
     * Check if ComfyUI server is available
     */
    async healthCheck(): Promise<boolean> {
        return this.client.healthCheck();
    }
}

