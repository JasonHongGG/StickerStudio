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

        // Hue Tolerance: How far from the Key Hue is allowed?
        // 40/100 similarity -> +/- 40 degrees? 
        // Original Green was ~60-185 (Range ~125, so +/- 60).
        // Let's base it on similarity. Max reasonable deviation is ~60 degrees.
        const hueTol = 20 + (userSimilarity * 0.6); // 20...80 degrees range

        // Saturation Threshold: How "colored" must it be?
        // Original Green was > 0.22. If Key is very pale, this should be lower.
        // If Key is highly saturated, we expect bg to be saturated.
        const satThresh = Math.max(0.1, keyHsl.s * 0.5); // At least 10% saturation, or half of key

        // Lightness Range:
        // Original Green was 0.12 - 0.95.
        const lMin = 0.1;
        const lMax = 0.98;

        img.onload = () => {
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
            while (queue.length > 0) {
                const idx = queue.shift()!;
                if (visited[idx]) continue;
                visited[idx] = 1;

                if (isMatch(idx)) {
                    mask[idx] = 1;
                    data[idx * 4 + 3] = 0;

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

            // --- 3. Generic Spill Suppression ---
            // If edge pixel matches Hue somewhat, desaturate it.
            for (let i = 0; i < len; i++) {
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

            // --- 4. Feathering (Alpha Smoothing) ---
            const copyData = new Uint8ClampedArray(data);
            for (let y = 1; y < h - 1; y++) {
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
