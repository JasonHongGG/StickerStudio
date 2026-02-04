/**
 * Image Processing Service
 * Implements the specific Green Screen removal algorithms requested.
 */

// Helper: Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return { h: h * 360, s, l }; // h in 0-360, s/l in 0-1
}

// Helper: Parse Hex to RGB
function hexToRgb(hex: string): { r: number, g: number, b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 255, b: 0 }; // Default Green
}

export interface BackgroundRemovalOptions {
    fitToStickerSize?: boolean;
    keyColor?: string; // Hex code, e.g. "#00FF00"
    similarity?: number; // 0-100
    edgeErosionIterations?: number; // Step 8 iterations
    edgeShrinkIterations?: number; // Step 9 iterations
    edgeSmoothIterations?: number; // Step 10 iterations
}

// Core Removal Function
export async function removeBackground(imageSrc: string, options: BackgroundRemovalOptions = {}): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        // 1. Prepare Key Color in HSL
        const keyColorHex = options.keyColor || '#00FF00';
        const keyRgb = hexToRgb(keyColorHex);
        const keyHsl = rgbToHsl(keyRgb.r, keyRgb.g, keyRgb.b);

        // Parameters
        const userSimilarity = options.similarity !== undefined ? options.similarity : 40;
        const edgeErosionIterations = Math.max(0, Math.floor(options.edgeErosionIterations ?? 3));
        const edgeShrinkIterations = Math.max(0, Math.floor(options.edgeShrinkIterations ?? 1));
        const edgeSmoothIterations = Math.max(0, Math.floor(options.edgeSmoothIterations ?? 1));

        // Key color traits
        const keyIsNeutral = keyHsl.s < 0.15; // gray/black/white-ish
        const keyIsDark = keyHsl.l < 0.2;
        const keyIsLight = keyHsl.l > 0.85;

        // Hue Tolerance: How far from the Key Hue is allowed?
        // 40/100 similarity -> +/- 40 degrees? 
        // Original Green was ~60-185 (Range ~125, so +/- 60).
        // Let's base it on similarity. Max reasonable deviation is ~60 degrees.
        const hueTol = 20 + (userSimilarity * 0.6); // 20...80 degrees range

        // Saturation Threshold: How "colored" must it be?
        // Original Green was > 0.22. If Key is very pale, this should be lower.
        // If Key is highly saturated, we expect bg to be saturated.
        const satThresh = keyIsNeutral ? 0 : Math.max(0.1, keyHsl.s * 0.5); // allow low-sat if key is neutral

        // Lightness Range:
        // Original Green was 0.12 - 0.95.
        const lMin = keyIsDark ? 0 : (keyIsLight ? 0.6 : 0.1);
        const lMax = keyIsLight ? 1 : 0.98;

        img.onload = async () => {
            const canvas = document.createElement('canvas');

            // Determine dimensions
            let w, h, dx = 0, dy = 0, drawW, drawH;

            if (options.fitToStickerSize) {
                w = 370; h = 320;
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d')!;
                // Fill with key color
                ctx.fillStyle = keyColorHex;
                ctx.fillRect(0, 0, w, h);
                // Fit
                const imgRatio = img.width / img.height;
                const targetRatio = w / h;
                if (imgRatio > targetRatio) {
                    drawW = w; drawH = w / imgRatio; dx = 0; dy = (h - drawH) / 2;
                } else {
                    drawH = h; drawW = h * imgRatio; dy = 0; dx = (w - drawW) / 2;
                }
                ctx.drawImage(img, dx, dy, drawW, drawH);
            } else {
                w = img.width; h = img.height;
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0);
            }

            const ctx = canvas.getContext('2d')!;
            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;
            const len = w * h;

            const mask = new Uint8Array(len); // 0:unknown, 1:bg, 2:fg
            const queue: number[] = [];

            const yieldToMain = () => new Promise<void>((resolve) => {
                if (typeof requestAnimationFrame !== 'undefined') {
                    requestAnimationFrame(() => resolve());
                } else {
                    setTimeout(resolve, 0);
                }
            });

            // --- Shared Helpers ---
            let luma: Float32Array | null = null;
            const getLuma = (): Float32Array => {
                if (!luma) {
                    luma = new Float32Array(len);
                    for (let i = 0; i < len; i++) {
                        const r = data[i * 4];
                        const g = data[i * 4 + 1];
                        const b = data[i * 4 + 2];
                        luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
                    }
                }
                return luma;
            };

            // --- Text Protection Mask (Edge-based) ---
            // Use Sobel gradient to protect strong edges (text strokes)
            const edgeMask = new Uint8Array(len); // 1 = protect
            const buildEdgeMask = async () => {
                const l = getLuma();
                const edgeThreshold = (keyIsNeutral ? 28 : 20) + (userSimilarity * 0.2); // 28..48 for neutral

                for (let y = 1; y < h - 1; y++) {
                    if (y % 40 === 0) await yieldToMain();
                    for (let x = 1; x < w - 1; x++) {
                        const idx = y * w + x;
                        const i00 = (y - 1) * w + (x - 1);
                        const i01 = (y - 1) * w + x;
                        const i02 = (y - 1) * w + (x + 1);
                        const i10 = y * w + (x - 1);
                        const i12 = y * w + (x + 1);
                        const i20 = (y + 1) * w + (x - 1);
                        const i21 = (y + 1) * w + x;
                        const i22 = (y + 1) * w + (x + 1);

                        const gx =
                            -l[i00] + l[i02] +
                            -2 * l[i10] + 2 * l[i12] +
                            -l[i20] + l[i22];

                        const gy =
                            -l[i00] - 2 * l[i01] - l[i02] +
                            l[i20] + 2 * l[i21] + l[i22];

                        const mag = Math.abs(gx) + Math.abs(gy);

                        if (mag >= edgeThreshold) {
                            const r = data[idx * 4];
                            const g = data[idx * 4 + 1];
                            const b = data[idx * 4 + 2];
                            const nearKey =
                                Math.abs(r - keyRgb.r) +
                                Math.abs(g - keyRgb.g) +
                                Math.abs(b - keyRgb.b) < 60;
                            if (!nearKey) edgeMask[idx] = 1;
                        }
                    }
                }
            };

            // --- Neutral Key Specific Steps ---
            const applyNeutralEnclosedCleanup = async () => {
                const lumaAt = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
                const edgeThreshold = Math.max(4, 12 - (userSimilarity * 0.05)); // higher similarity -> more aggressive
                const neighborNearKeyThreshold = 6; // require majority of neighbors to be near key

                for (let y = 1; y < h - 1; y++) {
                    if (y % 40 === 0) await yieldToMain();
                    for (let x = 1; x < w - 1; x++) {
                        const idx = y * w + x;
                        if (data[idx * 4 + 3] === 0) continue; // already transparent

                        if (!isMatch(idx, true)) continue;

                        if (edgeMask[idx]) continue; // protect edges/eyes/linework

                        const i4 = idx * 4;
                        const cL = lumaAt(data[i4], data[i4 + 1], data[i4 + 2]);

                        const lL = lumaAt(data[i4 - 4], data[i4 - 3], data[i4 - 2]);
                        const rL = lumaAt(data[i4 + 4], data[i4 + 5], data[i4 + 6]);
                        const tL = lumaAt(data[i4 - w * 4], data[i4 - w * 4 + 1], data[i4 - w * 4 + 2]);
                        const bL = lumaAt(data[i4 + w * 4], data[i4 + w * 4 + 1], data[i4 + w * 4 + 2]);

                        const edgeStrength = Math.max(
                            Math.abs(cL - lL),
                            Math.abs(cL - rL),
                            Math.abs(cL - tL),
                            Math.abs(cL - bL)
                        );

                        const nearKey = (i: number) =>
                            Math.abs(data[i * 4] - keyRgb.r) +
                            Math.abs(data[i * 4 + 1] - keyRgb.g) +
                            Math.abs(data[i * 4 + 2] - keyRgb.b) < 80;

                        let nearCount = 0;
                        if (nearKey(idx - w - 1)) nearCount++;
                        if (nearKey(idx - w)) nearCount++;
                        if (nearKey(idx - w + 1)) nearCount++;
                        if (nearKey(idx - 1)) nearCount++;
                        if (nearKey(idx + 1)) nearCount++;
                        if (nearKey(idx + w - 1)) nearCount++;
                        if (nearKey(idx + w)) nearCount++;
                        if (nearKey(idx + w + 1)) nearCount++;

                        if (edgeStrength < edgeThreshold && nearCount >= neighborNearKeyThreshold) {
                            data[i4 + 3] = 0;
                        }
                    }
                }
            };

            const applyNeutralEdgeDecontamination = async () => {
                for (let y = 1; y < h - 1; y++) {
                    if (y % 40 === 0) await yieldToMain();
                    for (let x = 1; x < w - 1; x++) {
                        const idx = y * w + x;
                        const i4 = idx * 4;
                        if (data[i4 + 3] === 0) continue;

                        const hasTransparentNeighbor =
                            data[i4 - 4 + 3] === 0 || data[i4 + 4 + 3] === 0 ||
                            data[i4 - w * 4 + 3] === 0 || data[i4 + w * 4 + 3] === 0 ||
                            data[i4 - w * 4 - 4 + 3] === 0 || data[i4 - w * 4 + 4 + 3] === 0 ||
                            data[i4 + w * 4 - 4 + 3] === 0 || data[i4 + w * 4 + 4 + 3] === 0;

                        if (!hasTransparentNeighbor) continue;

                        const nearKey =
                            Math.abs(data[i4] - keyRgb.r) +
                            Math.abs(data[i4 + 1] - keyRgb.g) +
                            Math.abs(data[i4 + 2] - keyRgb.b) < 80;

                        if (!nearKey) continue;

                        let sumR = 0, sumG = 0, sumB = 0, count = 0;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx === 0 && dy === 0) continue;
                                const nIdx = (y + dy) * w + (x + dx);
                                const n4 = nIdx * 4;
                                if (data[n4 + 3] > 0) {
                                    sumR += data[n4];
                                    sumG += data[n4 + 1];
                                    sumB += data[n4 + 2];
                                    count++;
                                }
                            }
                        }

                        if (count > 0) {
                            data[i4] = sumR / count;
                            data[i4 + 1] = sumG / count;
                            data[i4 + 2] = sumB / count;
                        }
                    }
                }
            };

            const applyNeutralEdgeAlphaCleanup = async () => {
                const l = getLuma();
                const edgeThreshold2 = 10 + (userSimilarity * 0.1); // 10..20

                for (let y = 1; y < h - 1; y++) {
                    if (y % 40 === 0) await yieldToMain();
                    for (let x = 1; x < w - 1; x++) {
                        const idx = y * w + x;
                        const i4 = idx * 4;
                        if (data[i4 + 3] === 0) continue;

                        const hasTransparentNeighbor =
                            data[i4 - 4 + 3] === 0 || data[i4 + 4 + 3] === 0 ||
                            data[i4 - w * 4 + 3] === 0 || data[i4 + w * 4 + 3] === 0 ||
                            data[i4 - w * 4 - 4 + 3] === 0 || data[i4 - w * 4 + 4 + 3] === 0 ||
                            data[i4 + w * 4 - 4 + 3] === 0 || data[i4 + w * 4 + 4 + 3] === 0;

                        if (!hasTransparentNeighbor) continue;

                        const nearKey =
                            Math.abs(data[i4] - keyRgb.r) +
                            Math.abs(data[i4 + 1] - keyRgb.g) +
                            Math.abs(data[i4 + 2] - keyRgb.b) < 90;

                        if (!nearKey) continue;

                        const i00 = (y - 1) * w + (x - 1);
                        const i01 = (y - 1) * w + x;
                        const i02 = (y - 1) * w + (x + 1);
                        const i10 = y * w + (x - 1);
                        const i12 = y * w + (x + 1);
                        const i20 = (y + 1) * w + (x - 1);
                        const i21 = (y + 1) * w + x;
                        const i22 = (y + 1) * w + (x + 1);

                        const gx =
                            -l[i00] + l[i02] +
                            -2 * l[i10] + 2 * l[i12] +
                            -l[i20] + l[i22];

                        const gy =
                            -l[i00] - 2 * l[i01] - l[i02] +
                            l[i20] + 2 * l[i21] + l[i22];

                        const mag = Math.abs(gx) + Math.abs(gy);
                        if (mag < edgeThreshold2 && !edgeMask[idx]) {
                            data[i4 + 3] = 0;
                        }
                    }
                }
            };

            const applyKeyColorDecontamination = async () => {
                const keyDiffThreshold = 60 + (userSimilarity * 0.35); // 60..95
                const edgeAlphaThreshold = 12 + (userSimilarity * 0.1); // 12..22
                const l = getLuma();

                for (let y = 1; y < h - 1; y++) {
                    if (y % 40 === 0) await yieldToMain();
                    for (let x = 1; x < w - 1; x++) {
                        const idx = y * w + x;
                        const i4 = idx * 4;
                        if (data[i4 + 3] === 0) continue;

                        const hasTransparentNeighbor =
                            data[i4 - 4 + 3] === 0 || data[i4 + 4 + 3] === 0 ||
                            data[i4 - w * 4 + 3] === 0 || data[i4 + w * 4 + 3] === 0 ||
                            data[i4 - w * 4 - 4 + 3] === 0 || data[i4 - w * 4 + 4 + 3] === 0 ||
                            data[i4 + w * 4 - 4 + 3] === 0 || data[i4 + w * 4 + 4 + 3] === 0;

                        if (!hasTransparentNeighbor) continue;

                        const diff =
                            Math.abs(data[i4] - keyRgb.r) +
                            Math.abs(data[i4 + 1] - keyRgb.g) +
                            Math.abs(data[i4 + 2] - keyRgb.b);

                        if (diff > keyDiffThreshold) continue;

                        const i00 = (y - 1) * w + (x - 1);
                        const i01 = (y - 1) * w + x;
                        const i02 = (y - 1) * w + (x + 1);
                        const i10 = y * w + (x - 1);
                        const i12 = y * w + (x + 1);
                        const i20 = (y + 1) * w + (x - 1);
                        const i21 = (y + 1) * w + x;
                        const i22 = (y + 1) * w + (x + 1);

                        const gx =
                            -l[i00] + l[i02] +
                            -2 * l[i10] + 2 * l[i12] +
                            -l[i20] + l[i22];

                        const gy =
                            -l[i00] - 2 * l[i01] - l[i02] +
                            l[i20] + 2 * l[i21] + l[i22];

                        const mag = Math.abs(gx) + Math.abs(gy);

                        if (mag < edgeAlphaThreshold && !edgeMask[idx]) {
                            data[i4 + 3] = 0;
                            continue;
                        }

                        let sumR = 0, sumG = 0, sumB = 0, count = 0;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx === 0 && dy === 0) continue;
                                const nIdx = (y + dy) * w + (x + dx);
                                const n4 = nIdx * 4;
                                if (data[n4 + 3] > 0) {
                                    const nDiff =
                                        Math.abs(data[n4] - keyRgb.r) +
                                        Math.abs(data[n4 + 1] - keyRgb.g) +
                                        Math.abs(data[n4 + 2] - keyRgb.b);
                                    if (nDiff > keyDiffThreshold) {
                                        sumR += data[n4];
                                        sumG += data[n4 + 1];
                                        sumB += data[n4 + 2];
                                        count++;
                                    }
                                }
                            }
                        }

                        if (count > 0) {
                            data[i4] = sumR / count;
                            data[i4 + 1] = sumG / count;
                            data[i4 + 2] = sumB / count;
                        } else if (!edgeMask[idx]) {
                            data[i4 + 3] = 0;
                        }
                    }
                }
            };

            await buildEdgeMask();

            // Helper: Check Pixel
            const isMatch = (idx: number, isStrict: boolean = false): boolean => {
                const r = data[idx * 4];
                const g = data[idx * 4 + 1];
                const b = data[idx * 4 + 2];

                // 1. Fast Euclidean Pass for exact matches (speedup)
                // If it's very close in RGB, it's definitely a match.
                if (Math.abs(r - keyRgb.r) < 30 && Math.abs(g - keyRgb.g) < 30 && Math.abs(b - keyRgb.b) < 30) {
                    return true;
                }

                // 2. HSL Check
                const { h, s, l } = rgbToHsl(r, g, b);

                // If key color is neutral (black/white/gray), rely on lightness + saturation
                if (keyIsNeutral) {
                    const lTol = 0.12 + (userSimilarity / 100) * 0.25; // 0.12 ~ 0.37
                    const sTol = 0.2 + (userSimilarity / 100) * 0.2;  // 0.2 ~ 0.4

                    if (Math.abs(l - keyHsl.l) <= lTol && s <= sTol) return true;

                    // Extra allowance for very dark keys
                    if (keyIsDark && l <= (0.1 + (userSimilarity / 100) * 0.15)) return true;

                    return false;
                }

                // Check Lightness & Saturation bounds
                if (l < lMin || l > lMax) return false;
                if (s < satThresh) return false;

                // Check Hue Distance (Circular)
                let hueDist = Math.abs(h - keyHsl.h);
                if (hueDist > 180) hueDist = 360 - hueDist;

                const tolerance = isStrict ? hueTol * 0.7 : hueTol;
                return hueDist <= tolerance;
            };

            // Seed Queue with Borders
            for (let x = 0; x < w; x++) {
                queue.push(0 * w + x); // Top
                queue.push((h - 1) * w + x); // Bottom
            }
            for (let y = 0; y < h; y++) {
                queue.push(y * w + 0); // Left
                queue.push(y * w + (w - 1)); // Right
            }

            const visited = new Uint8Array(len);

            // --- 1. Flood Fill ---
            let floodCount = 0;
            while (queue.length > 0) {
                const idx = queue.shift()!;
                if (visited[idx]) continue;
                visited[idx] = 1;

                if (++floodCount % 5000 === 0) await yieldToMain();

                if (isMatch(idx)) {
                    mask[idx] = 1;
                    if (!edgeMask[idx]) data[idx * 4 + 3] = 0;

                    const x = idx % w;
                    const y = Math.floor(idx / w);

                    if (x > 0) queue.push(idx - 1);
                    if (x < w - 1) queue.push(idx + 1);
                    if (y > 0) queue.push(idx - w);
                    if (y < h - 1) queue.push(idx + w);
                } else {
                    mask[idx] = 2; // Edge/Foreground
                }
            }

            // --- 2. Enclosed Background Cleanup (Neutral Keys) ---
            // For black/gray/white keys, remove flat key-colored regions even if not connected to border
            if (keyIsNeutral) await applyNeutralEnclosedCleanup();

            // --- 3. Generic Spill Suppression ---
            // If edge pixel matches Hue somewhat, desaturate it.
            for (let i = 0; i < len; i++) {
                if (i % (w * 20) === 0) await yieldToMain();
                if (data[i * 4 + 3] === 0) continue;

                const x = i % w;
                const y = Math.floor(i / w);

                let isEdge = false;
                if (x > 0 && data[i * 4 - 4 + 3] === 0) isEdge = true;
                else if (x < w - 1 && data[i * 4 + 4 + 3] === 0) isEdge = true;
                else if (y > 0 && data[(i - w) * 4 + 3] === 0) isEdge = true;
                else if (y < h - 1 && data[(i + w) * 4 + 3] === 0) isEdge = true;

                if (isEdge) {
                    const r = data[i * 4];
                    const g = data[i * 4 + 1];
                    const b = data[i * 4 + 2];
                    const { h } = rgbToHsl(r, g, b); // We usually need s/l too but h is key

                    let hueDist = Math.abs(h - keyHsl.h);
                    if (hueDist > 180) hueDist = 360 - hueDist;

                    if (hueDist < 30) {
                        // Desaturate slightly
                        const gray = (r + g + b) / 3;
                        data[i * 4] = (data[i * 4] + gray) / 2;
                        data[i * 4 + 1] = (data[i * 4 + 1] + gray) / 2;
                        data[i * 4 + 2] = (data[i * 4 + 2] + gray) / 2;
                    }
                }
            }

            // --- 4. Edge Decontamination (Neutral Keys) ---
            // Reduce dark/gray fringe on protected edges by borrowing neighbor colors
            if (keyIsNeutral) await applyNeutralEdgeDecontamination();

            // --- 5. Feathering (Alpha Smoothing) ---
            const copyData = new Uint8ClampedArray(data);
            for (let y = 1; y < h - 1; y++) {
                if (y % 40 === 0) await yieldToMain();
                for (let x = 1; x < w - 1; x++) {
                    const idx = y * w + x;

                    let hasTransparent = false;
                    let hasOpaque = false;

                    if (copyData[(y - 1) * w * 4 + x * 4 + 3] === 0 || copyData[(y + 1) * w * 4 + x * 4 + 3] === 0 ||
                        copyData[y * w * 4 + (x - 1) * 4 + 3] === 0 || copyData[y * w * 4 + (x + 1) * 4 + 3] === 0) {
                        hasTransparent = true;
                    }
                    if (copyData[(y - 1) * w * 4 + x * 4 + 3] > 0 || copyData[(y + 1) * w * 4 + x * 4 + 3] > 0 ||
                        copyData[y * w * 4 + (x - 1) * 4 + 3] > 0 || copyData[y * w * 4 + (x + 1) * 4 + 3] > 0) {
                        hasOpaque = true;
                    }

                    if (hasTransparent && hasOpaque) {
                        let sumA = 0;
                        let c = 0;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                sumA += copyData[((y + dy) * w + (x + dx)) * 4 + 3];
                                c++;
                            }
                        }
                        data[idx * 4 + 3] = sumA / c;
                    }
                }
            }

            // --- 6. Edge Alpha Cleanup (Neutral Keys) ---
            // Remove fuzzy dark halos near transparency
            if (keyIsNeutral) await applyNeutralEdgeAlphaCleanup();

            // --- 7. Key Color Decontamination (All Keys) ---
            // Remove colored fringes (green/black/etc) on edges
            await applyKeyColorDecontamination();

            // --- 8. Key Color Edge Erosion (All Keys) ---
            // Final hard cleanup: remove remaining key-colored edge pixels
            {
                const keyDiffThreshold = 180; // extremely aggressive

                for (let pass = 0; pass < edgeErosionIterations; pass++) {
                    const copy = new Uint8ClampedArray(data);
                    for (let y = 1; y < h - 1; y++) {
                        if (y % 40 === 0) await yieldToMain();
                        for (let x = 1; x < w - 1; x++) {
                            const idx = y * w + x;
                            const i4 = idx * 4;
                            if (copy[i4 + 3] === 0) continue;

                            const hasTransparentNeighbor =
                                copy[i4 - 4 + 3] === 0 || copy[i4 + 4 + 3] === 0 ||
                                copy[i4 - w * 4 + 3] === 0 || copy[i4 + w * 4 + 3] === 0 ||
                                copy[i4 - w * 4 - 4 + 3] === 0 || copy[i4 - w * 4 + 4 + 3] === 0 ||
                                copy[i4 + w * 4 - 4 + 3] === 0 || copy[i4 + w * 4 + 4 + 3] === 0;

                            if (!hasTransparentNeighbor) continue;

                            const diff =
                                Math.abs(copy[i4] - keyRgb.r) +
                                Math.abs(copy[i4 + 1] - keyRgb.g) +
                                Math.abs(copy[i4 + 2] - keyRgb.b);

                            if (diff <= keyDiffThreshold) {
                                data[i4 + 3] = 0;
                            }
                        }
                    }
                }
            }

            // --- 9. Edge Shrink (All Keys) ---
            // Remove a thin outer rim regardless of color for a fully clean cutout
            {
                for (let pass = 0; pass < edgeShrinkIterations; pass++) {
                    const copy = new Uint8ClampedArray(data);

                    for (let y = 1; y < h - 1; y++) {
                        if (y % 40 === 0) await yieldToMain();
                        for (let x = 1; x < w - 1; x++) {
                            const idx = y * w + x;
                            const i4 = idx * 4;
                            if (copy[i4 + 3] === 0) continue;

                            const hasTransparentNeighbor =
                                copy[i4 - 4 + 3] === 0 || copy[i4 + 4 + 3] === 0 ||
                                copy[i4 - w * 4 + 3] === 0 || copy[i4 + w * 4 + 3] === 0 ||
                                copy[i4 - w * 4 - 4 + 3] === 0 || copy[i4 - w * 4 + 4 + 3] === 0 ||
                                copy[i4 + w * 4 - 4 + 3] === 0 || copy[i4 + w * 4 + 4 + 3] === 0;

                            if (hasTransparentNeighbor) {
                                data[i4 + 3] = 0;
                            }
                        }
                    }
                }
            }

            // --- 10. Edge Smoothing (All Keys) ---
            // Anti-alias edge lines using coverage + sharpening (no color blur)
            {
                const smoothLow = 0.35;
                const smoothHigh = 0.65;

                for (let pass = 0; pass < edgeSmoothIterations; pass++) {
                    const copy = new Uint8ClampedArray(data);

                    for (let y = 1; y < h - 1; y++) {
                        if (y % 40 === 0) await yieldToMain();
                        for (let x = 1; x < w - 1; x++) {
                            const idx = y * w + x;
                            const i4 = idx * 4;

                            let hasTransparent = false;
                            let hasOpaque = false;

                            if (copy[(y - 1) * w * 4 + x * 4 + 3] === 0 || copy[(y + 1) * w * 4 + x * 4 + 3] === 0 ||
                                copy[y * w * 4 + (x - 1) * 4 + 3] === 0 || copy[y * w * 4 + (x + 1) * 4 + 3] === 0) {
                                hasTransparent = true;
                            }
                            if (copy[(y - 1) * w * 4 + x * 4 + 3] > 0 || copy[(y + 1) * w * 4 + x * 4 + 3] > 0 ||
                                copy[y * w * 4 + (x - 1) * 4 + 3] > 0 || copy[y * w * 4 + (x + 1) * 4 + 3] > 0) {
                                hasOpaque = true;
                            }

                            if (!(hasTransparent && hasOpaque)) continue;

                            let sumA = 0;
                            let c = 0;
                            for (let dy = -1; dy <= 1; dy++) {
                                for (let dx = -1; dx <= 1; dx++) {
                                    sumA += copy[((y + dy) * w + (x + dx)) * 4 + 3];
                                    c++;
                                }
                            }

                            let a = (sumA / c) / 255;
                            a = Math.min(1, Math.max(0, (a - smoothLow) / (smoothHigh - smoothLow)));
                            a = a * a * (3 - 2 * a); // smoothstep for sharper edge
                            data[i4 + 3] = a * 255;
                        }
                    }
                }
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (e) => reject(e);
        img.src = imageSrc;
    });
}

// Helper to resize image
export async function resizeImage(blob: Blob, width: number, height: number): Promise<Blob> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Resize uses typical scaling, no green filling needed here as it's for download
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((b) => resolve(b!), 'image/png');
            }
        };
        img.src = URL.createObjectURL(blob);
    });
}
