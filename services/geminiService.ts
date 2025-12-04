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
    modelName: string = 'gemini-2.5-flash-image'
): Promise<string> => {
    try {
        const client = getClient();
        
        // Optimize the prompt: Prioritize Image Quality > Action > Text Rules
        const themeContext = theme 
            ? `Context: The character is in a scenario related to "${theme}" (Costumes/Props).` 
            : "";

        const finalUserPrompt = `
**TASK**: Generate a high-quality LINE sticker based on the **Reference Image**.

**1. CHARACTER & STYLE (Highest Priority)**:
*   **Reference**: You MUST maintain the character's key features (species, eye shape, color palette, markings) from the Reference Image. Do not create a random character.
*   **Style**: Re-render the character ${styleSuffix || "keeping the original art style"}.
*   **Quality**: Ensure clean lines, vibrant colors, and professional sticker aesthetics.

**2. CONTENT**:
*   **Action/Emotion**: The character is acting out: "${expressionInput}".
*   ${themeContext}

**3. TEXT RULES (Strict)**:
*   **General Rule**: Do NOT write the Theme name, Style name, or Emotion name on the image.
*   **Dialogue Logic**: 
    - IF the User Input ("${expressionInput}") looks like a spoken phrase (e.g., "Hello", "Sorry", Chinese text like "你好"):
      -> **Add the text** nicely in the negative space (bubble or stylized text). 
      -> Do NOT cover the face.
    - ELSE (if it describes an action like "Running", "Happy"):
      -> **NO TEXT**. Draw the illustration only.

**4. FORMAT**:
*   **Background**: Solid Green #00FF00.
*   **Composition**: Full body or upper body, centered, fit within frame.
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