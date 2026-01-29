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

    return { h: h * 360, s, l };
}

// Check if a pixel matches the Green Screen criteria
function isGreenPixel(r: number, g: number, b: number): boolean {
    // 1. Pure Green Fast Pass: Euclidean distance to (0, 255, 0) < 18
    const dist = Math.sqrt(Math.pow(r - 0, 2) + Math.pow(g - 255, 2) + Math.pow(b - 0, 2));
    if (dist < 18) return true;

    // 2. Loose Conditions
    const { h, s, l } = rgbToHsl(r, g, b);

    const isHueMatch = h >= 60 && h <= 185;
    const isSatMatch = s >= 0.22;
    const isLightMatch = l >= 0.12 && l <= 0.95;
    const isGreenDominant = (g > r + 12) && (g > b + 12);

    if (isHueMatch && isSatMatch && isLightMatch && isGreenDominant) {
        return true;
    }

    return false;
}

// Core Removal Function
export async function removeBackground(imageSrc: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const w = 370; // Fixed output size requirement
            const h = 320;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject('Canvas context not available');
                return;
            }

            // --- FIX: Aspect Fit Logic ---
            // 1. Fill the canvas with pure Green (#00FF00) first.
            //    This ensures that any letterboxing (empty space) from aspect ratio preservation
            //    merges with the model's green background and gets removed by the algorithm.
            ctx.fillStyle = '#00FF00';
            ctx.fillRect(0, 0, w, h);

            // 2. Calculate dimensions to fit the image within 370x320 maintaining aspect ratio
            const imgRatio = img.width / img.height;
            const targetRatio = w / h;
            let drawW, drawH, dx, dy;

            if (imgRatio > targetRatio) {
                // Image is wider than target (fit to width)
                drawW = w;
                drawH = w / imgRatio;
                dx = 0;
                dy = (h - drawH) / 2;
            } else {
                // Image is taller than target (fit to height)
                drawH = h;
                drawW = h * imgRatio;
                dy = 0;
                dx = (w - drawW) / 2;
            }

            // 3. Draw image centered
            ctx.drawImage(img, dx, dy, drawW, drawH);

            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;

            // --- 1. Flood Fill from Borders ---
            // We will mark background pixels in a mask.
            // 0 = unknown, 1 = background, 2 = foreground
            const mask = new Uint8Array(w * h);
            const queue: number[] = [];

            // Add border pixels to queue
            for (let x = 0; x < w; x++) {
                queue.push(0 * w + x); // Top row
                queue.push((h - 1) * w + x); // Bottom row
            }
            for (let y = 0; y < h; y++) {
                queue.push(y * w + 0); // Left col
                queue.push(y * w + (w - 1)); // Right col
            }

            const visited = new Uint8Array(w * h); // track visited for BFS

            while (queue.length > 0) {
                const idx = queue.shift()!;
                if (visited[idx]) continue;
                visited[idx] = 1;

                const r = data[idx * 4];
                const g = data[idx * 4 + 1];
                const b = data[idx * 4 + 2];

                if (isGreenPixel(r, g, b)) {
                    mask[idx] = 1; // It is background
                    data[idx * 4 + 3] = 0; // Make transparent immediately

                    // Add neighbors
                    const x = idx % w;
                    const y = Math.floor(idx / w);

                    if (x > 0) queue.push(idx - 1);
                    if (x < w - 1) queue.push(idx + 1);
                    if (y > 0) queue.push(idx - w);
                    if (y < h - 1) queue.push(idx + w);
                } else {
                    mask[idx] = 2; // It is foreground
                }
            }

            // --- 1.5. Island Removal (Holes) ---
            // Scan for isolated green parts (e.g. gaps between arms) that weren't reached by border fill
            for (let i = 0; i < w * h; i++) {
                if (mask[i] === 1) continue; // Already removed

                const r = data[i * 4];
                const g = data[i * 4 + 1];
                const b = data[i * 4 + 2];

                // Seed check: Must be relatively pure green to start a hole removal
                // This prevents accidental deletion of green-ish clothing parts unless they are very green
                const dist = Math.sqrt(Math.pow(r - 0, 2) + Math.pow(g - 255, 2) + Math.pow(b - 0, 2));

                if (dist < 35) { // Threshold for recognizing a green hole seed
                    queue.push(i);

                    while (queue.length > 0) {
                        const idx = queue.shift()!;
                        if (mask[idx] === 1) continue;

                        const cr = data[idx * 4];
                        const cg = data[idx * 4 + 1];
                        const cb = data[idx * 4 + 2];

                        if (isGreenPixel(cr, cg, cb)) {
                            mask[idx] = 1;
                            data[idx * 4 + 3] = 0;

                            const x = idx % w;
                            const y = Math.floor(idx / w);

                            if (x > 0 && mask[idx - 1] !== 1) queue.push(idx - 1);
                            if (x < w - 1 && mask[idx + 1] !== 1) queue.push(idx + 1);
                            if (y > 0 && mask[idx - w] !== 1) queue.push(idx - w);
                            if (y < h - 1 && mask[idx + w] !== 1) queue.push(idx + w);
                        }
                    }
                }
            }

            // --- 2. White Stroke Protection & Spill Suppression ---
            // Iterate through the whole image to fix edges
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = y * w + x;

                    // If it was marked as foreground (or not reached by flood fill but is inside), check for spill
                    if (mask[idx] !== 1) {
                        const r = data[idx * 4];
                        const g = data[idx * 4 + 1];
                        const b = data[idx * 4 + 2];
                        const a = data[idx * 4 + 3];

                        if (a === 0) continue; // Already removed

                        // Is this pixel on the edge of transparency?
                        let isEdge = false;
                        // Check neighbors for transparency
                        if (x > 0 && data[(idx - 1) * 4 + 3] === 0) isEdge = true;
                        else if (x < w - 1 && data[(idx + 1) * 4 + 3] === 0) isEdge = true;
                        else if (y > 0 && data[(idx - w) * 4 + 3] === 0) isEdge = true;
                        else if (y < h - 1 && data[(idx + w) * 4 + 3] === 0) isEdge = true;

                        if (isEdge) {
                            // Spill Suppression: 
                            // If Green is still dominant or reflecting, reduce G or boost R/B
                            if (g > r && g > b) {
                                // Simple spill removal: set G to average of R and B
                                // Or reduce G to max(R, B)
                                data[idx * 4 + 1] = Math.max(r, b);
                            }
                        }
                    }
                }
            }

            // --- 3. Feathering (Alpha Smoothing) ---
            // Simple box blur on alpha channel for edges
            // We'll create a copy to read from
            const copyData = new Uint8ClampedArray(data);

            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = y * w + x;

                    // Only smooth if we are near the edge (0 vs 255 transition)
                    // To detect edge, look at neighbors in copyData
                    let hasTransparentNeighbor = false;
                    let hasOpaqueNeighbor = false;

                    const neighbors = [
                        (y - 1) * w + x, (y + 1) * w + x, y * w + (x - 1), y * w + (x + 1)
                    ];

                    for (const nIdx of neighbors) {
                        if (copyData[nIdx * 4 + 3] === 0) hasTransparentNeighbor = true;
                        else hasOpaqueNeighbor = true;
                    }

                    if (hasTransparentNeighbor && hasOpaqueNeighbor) {
                        // Apply simple smoothing to alpha
                        // Average alpha of 3x3 kernel
                        let sumA = 0;
                        let count = 0;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                const nIdx = (y + dy) * w + (x + dx);
                                sumA += copyData[nIdx * 4 + 3];
                                count++;
                            }
                        }
                        data[idx * 4 + 3] = sumA / count;
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
