import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";

const getClient = () => {
    // 1. Try to get key from Local Storage (User setting)
    const localKey = localStorage.getItem('gemini_api_key');
    if (localKey && localKey.trim() !== '') {
        return new GoogleGenAI({ apiKey: localKey.trim() });
    }

    // 2. Fallback to Environment Variable (System setting)
    const envKey = process.env.API_KEY;
    if (envKey) {
        return new GoogleGenAI({ apiKey: envKey });
    }

    // 3. No key found
    throw new Error("找不到 Gemini API Key。請點擊右上角「設定」手動輸入您的 API Key。");
};

/**
 * Encodes a File object to base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
             // Remove the Data URL prefix (e.g., "data:image/png;base64,")
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const generateExpression = async (
    imageBase64: string,
    expressionInput: string,
    styleSuffix: string,
    theme: string,
    modelName: string = 'gemini-2.5-flash-image',
    refinePrompt: string = '' 
): Promise<string> => {
    try {
        const client = getClient();
        
        const themeContext = theme 
            ? `Context: The character is in a scenario related to "${theme}".` 
            : "";

        // Refinement logic: Focus on ADDING/MODIFYING specific elements without changing the base.
        const refinementInstruction = refinePrompt 
            ? `\n\n### ⚠️ EDITING INSTRUCTIONS ⚠️
            The user wants to REFINE the result with this specific detail: "${refinePrompt}".
            - **DO NOT CHANGE THE POSE** or framing unless the user explicitly asks for a different action.
            - If the user asks for an accessory (e.g., sunglasses, hat), add it naturally to the character's CURRENT pose.
            - Keep the anatomy consistent with the Reference Image.` 
            : "";

        const finalUserPrompt = `
**TASK**: Generate a high-quality LINE sticker based on the **Reference Image**.

**1. STRICT VISUAL CONSTRAINTS**:
*   **Framing**: Check the Reference Image. 
    - Is it cropped at the chest? -> Generate **Half-Body**.
    - Is it full body? -> Generate **Full-Body**.
    - **DO NOT** add unrequested limbs or change the camera distance significantly.
*   **Identity**: You MUST maintain the character's features (eyes, markings, color) exactly.
*   **Style**: Render ${styleSuffix || "keeping the original art style"}.

**2. CONTENT**:
*   **Expression/Action**: "${expressionInput}".
*   ${themeContext}
    ${refinementInstruction}

**3. TEXT RULES**:
*   IF User Input ("${expressionInput}") is a spoken phrase -> Add text bubble.
*   ELSE -> NO TEXT.

**4. FORMAT**:
*   Background: Solid Green #00FF00.
        `.trim();

        const response = await client.models.generateContent({
            model: modelName,
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/png', 
                            data: imageBase64
                        }
                    },
                    {
                        text: finalUserPrompt
                    }
                ]
            },
            config: {
               systemInstruction: SYSTEM_PROMPT
            }
        });

        const candidates = response.candidates;
        if (candidates && candidates.length > 0) {
            const parts = candidates[0].content.parts;
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    return part.inlineData.data;
                }
            }
        }
        
        throw new Error("No image generated.");
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
};