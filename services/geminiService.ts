import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT, SAME_AS_REF_ID, AUTO_MATCH_ID, MODEL_CONFIG } from "../constants";

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
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const generateSticker = async (
    imageBase64: string | null,
    characterDescription: string,
    plan: {
        emotionPrompt: string;
        actionPrompt: string;
        caption: string;
        emotionId: string; // for logic checks
        actionId: string; // for logic checks
    },
    styleSuffix: string,
    theme: string,
    refinePrompt: string = '' 
): Promise<string> => {
    try {
        const client = getClient();
        
        const themeContext = theme 
            ? `Context/Theme: The character is in a scenario related to "${theme}". Add relevant props if they fit the action.` 
            : "";

        // Refinement Instruction
        const refinementInstruction = refinePrompt 
            ? `\n\n### ⚠️ EDITING INSTRUCTIONS ⚠️
            The user wants to REFINE the result with this specific detail: "${refinePrompt}".
            - Keep the anatomy consistent with the Reference Image.` 
            : "";

        // Construct the 3-Step Logic
        let emotionInstruction = "";
        let actionInstruction = "";
        
        // 1. Emotion Logic
        if (plan.emotionId === SAME_AS_REF_ID) {
            emotionInstruction = "Expression: **KEEP EXACTLY THE SAME** as the reference image.";
        } else if (plan.emotionId === AUTO_MATCH_ID) {
            emotionInstruction = "Expression: Create an expression that naturally fits the requested Action.";
        } else {
            emotionInstruction = `Expression: ${plan.emotionPrompt}`;
        }

        // 2. Action Logic
        if (plan.actionId === SAME_AS_REF_ID) {
            actionInstruction = "Pose/Action: **KEEP EXACTLY THE SAME** as the reference image. Do not change the pose.";
        } else if (plan.actionId === AUTO_MATCH_ID) {
            actionInstruction = "Pose/Action: Create a pose that naturally emphasizes the requested Expression.";
        } else {
            actionInstruction = `Pose/Action: ${plan.actionPrompt}`;
        }

        // 3. Caption Logic
        const captionInstruction = plan.caption 
            ? `Text/Speech Bubble: Add a text bubble with the exact content: "${plan.caption}". Ensure the text is legible.`
            : `Text/Speech Bubble: **NO TEXT**. Do not add any speech bubbles or written words.`;

        // --- Build Core Prompt based on Input Mode ---
        let baseIdentityPrompt = "";
        
        if (imageBase64 && characterDescription) {
            // HYBRID MODE
            baseIdentityPrompt = `
**TASK**: Generate a high-quality LINE sticker based on the **Reference Image** combined with the **Text Description**.
**1. CHARACTER IDENTITY**:
   - Primary Visuals: Take species, colors, and key markings from the Reference Image.
   - Modifications: Apply these details from the text: "${characterDescription}".
            `;
        } else if (imageBase64) {
            // IMAGE ONLY MODE
            baseIdentityPrompt = `
**TASK**: Generate a high-quality LINE sticker based on the **Reference Image**.
**1. CHARACTER IDENTITY**:
   - Maintain the character's species, eye shape, markings, and key features perfectly from the image.
   - **Framing**: Check the Reference Image. If cropped at chest -> Generate Half-Body. If full body -> Generate Full-Body.
            `;
        } else {
            // TEXT ONLY MODE
            baseIdentityPrompt = `
**TASK**: Generate a high-quality LINE sticker based on the **Text Description**.
**1. CHARACTER IDENTITY**:
   - Create a character based exactly on this description: "${characterDescription}".
   - Ensure consistent design across all generations.
            `;
        }

        const finalUserPrompt = `
${baseIdentityPrompt}

**2. STYLE**:
   - Render ${styleSuffix || "in a clean, high-quality digital sticker style"}.

**3. STICKER CONTENT CONFIGURATION**:
*   ${emotionInstruction}
*   ${actionInstruction}
*   ${captionInstruction}

**4. CONTEXT**:
*   ${themeContext}
    ${refinementInstruction}

**5. OUTPUT FORMAT**:
*   Background: Solid Green #00FF00.
        `.trim();

        // Prepare API Content
        const requestParts: any[] = [];
        
        if (imageBase64) {
            requestParts.push({
                inlineData: {
                    mimeType: 'image/png', 
                    data: imageBase64
                }
            });
        }
        
        requestParts.push({ text: finalUserPrompt });

        const response = await client.models.generateContent({
            model: MODEL_CONFIG.modelName,
            contents: {
                parts: requestParts
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