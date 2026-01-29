/**
 * Image Compositor Service
 * Composes multiple reference images into style sheets with adaptive grid layouts.
 * Preserves aspect ratio of each image (aspect-fit).
 */

/**
 * Determines the optimal grid layout based on image count.
 * Max 16 images per sheet (4x4).
 */
function getGridLayout(count: number): { cols: number; rows: number } {
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    if (count <= 12) return { cols: 4, rows: 3 };
    return { cols: 4, rows: 4 }; // Max 16
}

/**
 * Loads an image from a File and returns an HTMLImageElement.
 * Properly handles blob URL lifecycle to prevent memory leaks.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        // Validate file object is still valid
        if (!file || file.size === 0) {
            reject(new Error(`Invalid file: ${file?.name || 'unknown'} - file may be corrupted or no longer available`));
            return;
        }

        const img = new Image();
        let blobUrl: string | null = null;

        img.onload = () => {
            // Store the URL in the img.src for later cleanup
            resolve(img);
        };

        img.onerror = (event) => {
            // Clean up blob URL on error to prevent memory leak
            if (blobUrl) {
                URL.revokeObjectURL(blobUrl);
            }
            reject(new Error(`Failed to load image: ${file.name}`));
        };

        try {
            blobUrl = URL.createObjectURL(file);
            img.src = blobUrl;
        } catch (e) {
            reject(new Error(`Failed to create blob URL for: ${file.name}`));
        }
    });
}

/**
 * Draws an image into a cell with aspect-fit (no distortion).
 */
function drawImageAspectFit(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    cellX: number,
    cellY: number,
    cellWidth: number,
    cellHeight: number
) {
    const imgRatio = img.width / img.height;
    const cellRatio = cellWidth / cellHeight;

    let drawWidth: number;
    let drawHeight: number;

    if (imgRatio > cellRatio) {
        // Image is wider than cell - fit to width
        drawWidth = cellWidth;
        drawHeight = cellWidth / imgRatio;
    } else {
        // Image is taller than cell - fit to height
        drawHeight = cellHeight;
        drawWidth = cellHeight * imgRatio;
    }

    const offsetX = cellX + (cellWidth - drawWidth) / 2;
    const offsetY = cellY + (cellHeight - drawHeight) / 2;

    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

/**
 * Composes multiple images into style sheet(s).
 * Returns an array of Base64 PNG strings.
 * 
 * @param files - Array of image files to compose
 * @param sheetSize - Pixel size of output sheet (default 1024x1024)
 * @param maxPerSheet - Maximum images per sheet (default 16 for 4x4)
 */
export async function composeStyleSheets(
    files: File[],
    sheetSize: number = 1024,
    maxPerSheet: number = 16
): Promise<string[]> {
    if (files.length === 0) return [];

    // If only 1 image, just return it as-is (no composition needed)
    if (files.length === 1) {
        return [await fileToBase64(files[0])];
    }

    const sheets: string[] = [];

    // Split files into chunks of maxPerSheet
    for (let i = 0; i < files.length; i += maxPerSheet) {
        const chunk = files.slice(i, i + maxPerSheet);
        const sheetBase64 = await composeSheet(chunk, sheetSize);
        sheets.push(sheetBase64);
    }

    return sheets;
}

/**
 * Composes a single sheet from a chunk of files.
 */
async function composeSheet(files: File[], sheetSize: number): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = sheetSize;
    canvas.height = sheetSize;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Canvas context not available');
    }

    // Fill with white background for visibility
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sheetSize, sheetSize);

    const { cols, rows } = getGridLayout(files.length);
    const cellWidth = sheetSize / cols;
    const cellHeight = sheetSize / rows;

    // Load all images
    const images = await Promise.all(files.map(loadImage));

    // Draw each image in its cell
    for (let i = 0; i < images.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cellX = col * cellWidth;
        const cellY = row * cellHeight;

        drawImageAspectFit(ctx, images[i], cellX, cellY, cellWidth, cellHeight);

        // Clean up object URL
        URL.revokeObjectURL(images[i].src);
    }

    return canvas.toDataURL('image/png');
}

/**
 * Helper to convert a File to Base64 string (data URI).
 */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
