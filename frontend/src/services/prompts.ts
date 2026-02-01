/**
 * ============================================================
 * PROMPT CONFIGURATION CENTER (Frontend Version)
 * ============================================================
 */

import { SAME_AS_REF_ID, AUTO_MATCH_ID, EMOTIONS, COMMON_ACTIONS } from "../constants";

// Define strict interfaces for frontend usage if not available elsewhere
// In frontend, we might pass these as part of the plan object


// ============================================================
// UTILITY: Resolve Emotion ID to English prompt text
// ============================================================
export const resolveEmotionPrompt = (emotionId: string, customText?: string): string => {
    if (emotionId === SAME_AS_REF_ID || emotionId === AUTO_MATCH_ID) {
        return "";
    }
    const emoObj = EMOTIONS.find(e => e.id === emotionId);
    if (emoObj) {
        return emoObj.enName;
    }
    // If not found in predefined list, treat as custom text
    return customText || emotionId;
};

// ============================================================
// UTILITY: Resolve Action ID to English prompt text
// ============================================================
export const resolveActionPrompt = (actionId: string, customText?: string): string => {
    if (actionId === SAME_AS_REF_ID || actionId === AUTO_MATCH_ID) {
        return "";
    }
    const actObj = COMMON_ACTIONS.find(a => a.id === actionId);
    if (actObj) {
        return actObj.enName;
    }
    // If not found in predefined list, treat as custom text
    return customText || actionId;
};
