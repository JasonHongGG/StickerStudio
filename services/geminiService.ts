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
        
        // Construct a smart prompt with stricter rules for Text vs Action
        const finalUserPrompt = `
**Reference Image**: Provided is the character design.

**Sticker Request Details**:
1.  **Art Style**: ${styleSuffix || "Keep original style"}. 
    *Instruction*: Apply this art style **STRONGLY** and vividly. Re-render the character to match this aesthetic perfectly.
    
2.  **Theme (Optional)**: ${theme ? `Theme context: ${theme} (Add relevant costumes/props).` : "None."}

3.  **User Input**: "${expressionInput}"

4.  **Critical Rules for Content Generation**:
    *   **IF Input contains Chinese characters (e.g., "璦妮~~") or is a quote**:
        - You **MUST WRITE THE TEXT** verbatim in the image.
        - **LEGIBILITY IS KEY**: Ensure Chinese characters are written with **CORRECT STROKE ORDER and STRUCTURE**. Do not generate pseudo-language or garbled shapes. The text must be sharp and readable, like a professional sticker caption.
        - Text style should match the art style (e.g., Hand-drawn, Brush, or Pop font).
    
    *   **IF Input is an English description of an Action/Emotion (e.g., "Happy", "Running", "Eating")**:
        - **DO NOT ADD ANY TEXT**. Absolutely NO text overlays, NO speech bubbles, NO sound effects.
        - JUST DRAW the character performing the action or showing the emotion.

5.  **Output Requirements**:
    - High-quality sticker art.
    - **Background MUST be Solid Green #00FF00**.
    - **Composition**: Ensure the character fits well within the frame without being cut off.
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