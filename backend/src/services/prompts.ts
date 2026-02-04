/**
 * ============================================================
 * PROMPT CONFIGURATION CENTER
 * ============================================================
 * All AI prompt templates and generation logic are centralized here.
 * Modify this file to adjust how prompts are constructed for AI generation.
 */

import { GenerateStickerRequest } from "./AIService.js";
import { SAME_AS_REF_ID, AUTO_MATCH_ID, EMOTIONS, COMMON_ACTIONS } from "../config/constants.js";

// ============================================================
// SYSTEM PROMPT (sent as system instruction to AI)
// ============================================================
export const SYSTEM_PROMPT = `
You are an expert Sticker Artist.

**CRITICAL RULES:**
1. **Match Source Framing EXACTLY**:
   - IF the Reference Image is **Half-Body**, output **Half-Body**.
   - IF the Reference Image is **Full-Body**, output **Full-Body**.
   - Do NOT invent legs or change proportions unless the Style (e.g. Chibi) explicitly demands it.

2. **Character Identity**:
   - Maintain the character's species, eye shape, markings, and key features perfectly.

3. **Background**: Always Solid Green #00FF00.

4. **Composition Logic**:
   - **Expression**: Follows the user's specific instruction. If "Same as Reference", keep the face exactly as is.
   - **Pose/Action**: Follows the user's specific instruction. If "Same as Reference", keep the body exactly as is.
   - **Text**: Only add text if explicitly provided in the "Caption".

5. **Style Consistency**:
   - Apply the requested art style (e.g., Anime, 3D) while keeping the character recognizable.
`;

// ============================================================
// STYLE SHEET ANALYSIS PROMPT (for multi-image reference)
// ============================================================
const STYLE_SHEET_ANALYSIS_PROMPT = `
**STYLE SHEET ANALYSIS PROTOCOL**

You are looking at a CHARACTER STYLE SHEET containing multiple reference images of the SAME character.
Your goal is to DEEPLY INTERNALIZE every visual aspect so your output is INDISTINGUISHABLE from the original artist's work.

**MANDATORY ANALYSIS CHECKLIST**:

1. **LINE ART**
   - Line weight (thick/thin, consistent/variable)
   - Line quality (smooth vector, sketchy, textured)
   - Outline style (closed shapes, open strokes, tapered ends)

2. **COLOR PALETTE**
   - Extract EXACT colors for: skin/fur, eyes, hair, clothing, accents
   - Note any gradient usage or solid-fill preference
   - Identify highlight and shadow colors (not just darker/lighter)

3. **SHADING & LIGHTING**
   - Style: flat, cel-shaded, soft gradient, painterly
   - Shadow placement patterns (under chin, hair shadow on face, etc.)
   - Highlight placement (nose tip, cheek, hair shine)
   - Ambient occlusion usage

4. **PROPORTIONS & ANATOMY**
   - Head-to-body ratio
   - Eye size relative to face
   - Hand/paw style and detail level
   - Limb thickness and joint articulation

5. **FACIAL FEATURES**
   - Eye shape, pupil style, iris detail
   - Mouth/muzzle shape variations across expressions
   - Eyebrow style and expressiveness
   - Blush/emotion indicator style

6. **EXPRESSION LANGUAGE**
   - How does this artist convey happiness? (eye squint level, mouth shape)
   - How is anger shown? (eyebrow angle, mouth style)
   - Signature quirks (sweat drops, sparkles, motion lines)

7. **DETAIL PHILOSOPHY**
   - What gets detailed vs simplified?
   - Texture usage (fur texture, fabric folds)
   - Background element style (if any)

**YOUR OUTPUT MUST**:
- Look like the EXACT SAME ARTIST drew it
- Use the SAME color values (not approximations)
- Match the SAME line weight and shading style
- Preserve ALL signature quirks and style choices
`;

// ============================================================
// HELPER: Build Emotion Instruction
// ============================================================
function buildEmotionInstruction(emotionId: string, emotionPrompt: string): string {
    if (emotionId === SAME_AS_REF_ID) {
        return "Expression: **KEEP EXACTLY THE SAME** as the reference image.";
    }
    if (emotionId === AUTO_MATCH_ID) {
        return "Expression: Create an expression that naturally fits the requested Action.";
    }
    if (emotionPrompt && emotionPrompt.trim()) {
        return `Expression: **${emotionPrompt.trim()}**. This is the REQUIRED emotion - the character MUST show this expression clearly.`;
    }
    return "Expression: Use a neutral, friendly expression.";
}

// ============================================================
// HELPER: Build Action Instruction
// ============================================================
function buildActionInstruction(actionId: string, actionPrompt: string): string {
    if (actionId === SAME_AS_REF_ID) {
        return "Pose/Action: **KEEP EXACTLY THE SAME** as the reference image. Do not change the pose.";
    }
    if (actionId === AUTO_MATCH_ID) {
        return "Pose/Action: Create a pose that naturally emphasizes the requested Expression.";
    }
    if (actionPrompt && actionPrompt.trim()) {
        return `Pose/Action: **${actionPrompt.trim()}**. The character MUST be doing this action.`;
    }
    return "Pose/Action: Use a natural standing or sitting pose.";
}

// ============================================================
// HELPER: Build Caption/Text Instruction
// ============================================================
function buildCaptionInstruction(caption: string): string {
    if (caption && caption.trim()) {
        return `Text/Speech Bubble: Add a text bubble with the exact content: "${caption}". Ensure the text is legible.`;
    }
    return `Text/Speech Bubble: **NO TEXT**. Do not add any speech bubbles or written words.`;
}

// ============================================================
// HELPER: Build Base Identity Prompt (based on input mode)
// ============================================================
function buildBaseIdentityPrompt(
    hasImage: boolean,
    hasMultipleImages: boolean,
    characterDescription: string
): string {
    if (hasMultipleImages) {
        // MULTI-IMAGE STYLE SHEET MODE
        return `
**TASK**: Generate a high-quality LINE sticker based on the **Character Style Sheet(s)** provided.

${STYLE_SHEET_ANALYSIS_PROMPT}

${characterDescription ? `**ADDITIONAL TEXT DESCRIPTION**: "${characterDescription}"` : ""}
        `;
    }

    if (hasImage && characterDescription) {
        // HYBRID MODE (single image + text)
        return `
**TASK**: Generate a high-quality LINE sticker based on the **Reference Image** combined with the **Text Description**.
**1. CHARACTER IDENTITY**:
   - Primary Visuals: Take species, colors, and key markings from the Reference Image.
   - Modifications: Apply these details from the text: "${characterDescription}".
        `;
    }

    if (hasImage) {
        // IMAGE ONLY MODE (single image)
        return `
**TASK**: Generate a high-quality LINE sticker based on the **Reference Image**.
**1. CHARACTER IDENTITY**:
   - Maintain the character's species, eye shape, markings, and key features perfectly from the image.
   - **Framing**: Check the Reference Image. If cropped at chest -> Generate Half-Body. If full body -> Generate Full-Body.
        `;
    }

    // TEXT ONLY MODE
    return `
**TASK**: Generate a high-quality LINE sticker based on the **Text Description**.
**1. CHARACTER IDENTITY**:
   - Create a character based exactly on this description: "${characterDescription}".
   - Ensure consistent design across all generations.
    `;
}

// ============================================================
// MAIN EXPORT: Construct the complete sticker prompt
// ============================================================
export const constructStickerPrompt = (request: GenerateStickerRequest): string => {
    const { imageBase64, additionalImageBase64, characterDescription, plan, styleSuffix, theme, refinePrompt } = request;

    const hasImage = !!imageBase64;
    const hasMultipleImages: boolean = hasImage && Boolean(additionalImageBase64 && additionalImageBase64.length > 0);

    // Build individual sections
    const baseIdentityPrompt = buildBaseIdentityPrompt(hasImage, hasMultipleImages, characterDescription);
    const emotionInstruction = buildEmotionInstruction(plan.emotionId, plan.emotionPrompt);
    const actionInstruction = buildActionInstruction(plan.actionId, plan.actionPrompt);
    const captionInstruction = buildCaptionInstruction(plan.caption);

    // Theme context
    const themeContext = theme
        ? `Context/Theme: The character is in a scenario related to "${theme}". Add relevant props if they fit the action.`
        : "";

    // Refinement instruction
    const refinementInstruction = refinePrompt
        ? `

### ⚠️ EDITING INSTRUCTIONS ⚠️
The user wants to REFINE the result with this specific detail: "${refinePrompt}".
- Keep the anatomy consistent with the Reference Image.`
        : "";

    // Assemble final prompt
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
