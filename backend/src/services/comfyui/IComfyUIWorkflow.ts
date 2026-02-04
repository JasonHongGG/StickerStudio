/**
 * Base interface for all ComfyUI workflow handlers.
 * Each workflow implementation loads a specific JSON template and executes it.
 * 
 * @template TInput - The input type for the workflow
 * @template TOutput - The output type for the workflow
 */
export interface IComfyUIWorkflow<TInput, TOutput> {
    /**
     * Human-readable name of the workflow
     */
    readonly name: string;

    /**
     * Path to the workflow JSON file (relative to workflows directory)
     */
    readonly workflowJsonPath: string;

    /**
     * Execute the workflow with the given input
     * @param input - The workflow-specific input data
     * @returns The workflow-specific output
     */
    execute(input: TInput): Promise<TOutput>;
}

/**
 * Standard input for image-to-image workflows
 */
export interface ImageWorkflowInput {
    /** Base64-encoded input image (without data URI prefix) */
    imageBase64: string;
    /** Optional filename hint */
    filename?: string;
}

/**
 * Standard output for image-generation workflows
 */
export interface ImageWorkflowOutput {
    /** Base64-encoded result image (without data URI prefix) */
    resultBase64: string;
    /** Processing time in milliseconds */
    processingTimeMs: number;
}
