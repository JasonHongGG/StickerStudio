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
 * Uses a pre-configured workflow JSON that includes a LoadImage node.
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
        const inputNodeId = this.resolveInputNodeId(this.workflowTemplate, input.inputNodeId);
        const promptGraph = this.injectInputImage(uploadedFilename, inputNodeId);

        if (input.parameter) {
            this.applyParameters(promptGraph, input.parameter);
        }

        // 4. Queue the prompt
        const promptId = await this.client.queuePrompt(promptGraph);

        // 5. Wait for completion
        const historyEntry = await this.client.waitForCompletion(promptId);

        // 6. Download the result image
        const outputNodeId = this.resolveOutputNodeId(promptGraph, input.outputNodeId);
        const resultBuffer = await this.client.downloadOutputImage(historyEntry, outputNodeId);

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
    private injectInputImage(filename: string, nodeId: string): Record<string, any> {
        // Deep clone the template
        const graph = JSON.parse(JSON.stringify(this.workflowTemplate));
        const nodeObj = graph[nodeId] as any;
        if (!nodeObj?.inputs) {
            throw new Error(`Input node ${nodeId} has no inputs`);
        }

        nodeObj.inputs.image = filename;
        console.log(`[ComfyUI] Injected image "${filename}" into LoadImage node "${nodeId}"`);

        return graph;
    }

    /**
     * Resolve which node to inject the input image into
     */
    private resolveInputNodeId(graph: Record<string, any>, preferredNodeId?: string): string {
        if (preferredNodeId && preferredNodeId.trim().length > 0) {
            return preferredNodeId.trim();
        }

        for (const [nodeId, node] of Object.entries(graph)) {
            const nodeObj = node as any;
            if (nodeObj.class_type === 'LoadImage') {
                return nodeId;
            }
        }

        throw new Error('No LoadImage node found in workflow template');
    }

    /**
     * Resolve which node to read outputs from
     */
    private resolveOutputNodeId(graph: Record<string, any>, preferredNodeId?: string): string {
        if (preferredNodeId && preferredNodeId.trim().length > 0) {
            return preferredNodeId.trim();
        }

        for (const [nodeId, node] of Object.entries(graph)) {
            const nodeObj = node as any;
            if (nodeObj.class_type === 'PreviewImage') {
                return nodeId;
            }
        }

        throw new Error('No PreviewImage node found in workflow template');
    }

    /**
     * Apply workflow-specific parameters to the prompt graph
     */
    private applyParameters(graph: Record<string, any>, parameter: Record<string, unknown>): void {
        if (typeof parameter.model === 'string' && parameter.model.trim().length > 0) {
            this.setNodeValue(graph, '1', 'inputs.model_name', parameter.model.trim());
        }
    }

    /**
     * Set a value on a node using a dot-separated path
     */
    private setNodeValue(
        graph: Record<string, any>,
        nodeId: string,
        path: string,
        value: unknown
    ): void {
        const node = graph[nodeId];
        if (!node) {
            throw new Error(`Node ${nodeId} not found in workflow template`);
        }

        const segments = path.split('.').filter(Boolean);
        if (segments.length === 0) {
            throw new Error('Path cannot be empty');
        }

        let current: any = node;
        for (let index = 0; index < segments.length - 1; index += 1) {
            const key = this.parsePathSegment(segments[index]);
            if (current[key] === undefined) {
                throw new Error(`Path not found on node ${nodeId}: ${path}`);
            }
            current = current[key];
        }

        const lastKey = this.parsePathSegment(segments[segments.length - 1]);
        if (current[lastKey] === undefined) {
            throw new Error(`Path not found on node ${nodeId}: ${path}`);
        }

        current[lastKey] = value;
    }

    /**
     * Parse a path segment into object key or array index
     */
    private parsePathSegment(segment: string): string | number {
        if (/^\d+$/.test(segment)) {
            return Number(segment);
        }
        return segment;
    }

    /**
     * Check if ComfyUI server is available
     */
    async healthCheck(): Promise<boolean> {
        return this.client.healthCheck();
    }
}

