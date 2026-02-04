import { GeneratedImage } from '../types';

const DB_NAME = 'StickerGeneratorDB';
const STORE_NAME = 'images';
const DB_VERSION = 1;

/**
 * Open the IndexedDB database
 */
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('batchId', 'batchId', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
};

/**
 * Save or Update an image record
 */
export const saveImageRecord = async (image: GeneratedImage): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(image);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Get all image records
 */
export const getAllImages = async (): Promise<GeneratedImage[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            // Sort by createdAt desc inside the app usually, but we return raw here
            resolve(request.result as GeneratedImage[]);
        };
        request.onerror = () => reject(request.error);
    });
};

/**
 * Delete an image record by ID
 */
export const deleteImageRecord = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Update the batchName for all images with a specific batchId
 */
export const updateBatchNameInDB = async (batchId: string, newName: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('batchId');
        const request = index.getAll(batchId);

        request.onsuccess = () => {
            const images: GeneratedImage[] = request.result;
            if (!images || images.length === 0) {
                resolve();
                return;
            }

            images.forEach(img => {
                const updatedImg = { ...img, batchName: newName };
                store.put(updatedImg);
            });

            resolve();
        };

        request.onerror = () => reject(request.error);
    });
};

/**
 * Update the batchId and batchName for a specific image
 */
export const updateImageBatchId = async (imageId: string, newBatchId: string, newBatchName: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(imageId);

        request.onsuccess = () => {
            const data = request.result as GeneratedImage;
            if (!data) {
                reject(new Error("Image not found"));
                return;
            }

            const updatedDoc = { ...data, batchId: newBatchId, batchName: newBatchName };
            const updateRequest = store.put(updatedDoc);

            updateRequest.onsuccess = () => resolve();
            updateRequest.onerror = () => reject(updateRequest.error);
        };

        request.onerror = () => reject(request.error);
    });
};

/**
 * Delete multiple images by IDs (helper)
 */
export const deleteImageRecords = async (ids: string[]): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        if (ids.length === 0) {
            resolve();
            return;
        }

        ids.forEach(id => {
            store.delete(id);
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};
