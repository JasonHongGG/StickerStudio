import { IAIService, AIServiceType } from "./AIService.js";
import { GeminiService } from "./geminiService.js";
import { LocalAPIService } from "./localAPIService.js";

export class AIServiceFactory {

    /**
     * Get the currently selected AI Service instance based on environment variable.
     * Defaults to GeminiService if no selection is set.
     */
    static getCurrentService(): IAIService {
        const type = this.getServiceType();

        switch (type) {
            case 'local':
                return new LocalAPIService();
            case 'gemini':
            default:
                return new GeminiService();
        }
    }

    /**
     * Get the current service type from environment variable
     */
    static getServiceType(): AIServiceType {
        const envType = process.env.AI_SERVICE_TYPE;
        if (envType === 'local') {
            return 'local';
        }
        return 'gemini';
    }

    /**
     * Get a specific service instance regardless of current selection
     */
    static getService(type: AIServiceType): IAIService {
        switch (type) {
            case 'local':
                return new LocalAPIService();
            case 'gemini':
                return new GeminiService();
            default:
                return new GeminiService();
        }
    }
}
