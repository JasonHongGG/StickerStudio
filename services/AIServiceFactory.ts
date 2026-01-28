import { STORAGE_KEYS } from '../constants';
import { IAIService, AIServiceType } from "./AIService";
import { GeminiService } from "./geminiService";
import { LocalAPIService } from "./LocalAPIService";

export class AIServiceFactory {

    /**
     * Get the currently selected AI Service instance.
     * Defaults to GeminiService if no selection is saved.
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
     * Get the current service type from storage
     */
    static getServiceType(): AIServiceType {
        const storedType = localStorage.getItem(STORAGE_KEYS.serviceType);
        if (storedType === 'local') {
            return 'local';
        }
        return 'gemini';
    }

    /**
     * Switch the active service type and save to storage
     */
    static setServiceType(type: AIServiceType): void {
        localStorage.setItem(STORAGE_KEYS.serviceType, type);
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
