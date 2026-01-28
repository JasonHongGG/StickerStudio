import { GenerateStickerRequest } from "./AIService";
import { SAME_AS_REF_ID, AUTO_MATCH_ID } from "../constants";

export const constructStickerPrompt = (request: GenerateStickerRequest): string => {
    const { imageBase64, characterDescription, plan, styleSuffix, theme, refinePrompt } = request;

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

    return finalUserPrompt;
};
