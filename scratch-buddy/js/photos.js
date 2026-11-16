const DB_NAME = "scratch-buddy-preview";
const STORE = "ticket-photos";
const VERSION = 1;

export const PHOTO_DB_NAME = DB_NAME;

let currentDb = null;

function openDb() {
    return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            reject(new Error("Photo storage is not available in this browser."));
            return;
        }
        const request = indexedDB.open(DB_NAME, VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: "id" });
            }
        };
        request.onsuccess = () => {
            currentDb = request.result;
            currentDb.onversionchange = () => {
                currentDb.close();
                currentDb = null;
            };
            resolve(currentDb);
        };
        request.onerror = () => reject(request.error || new Error("Photo storage could not be opened."));
    });
}

export function closePhotoDb() {
    if (currentDb) {
        currentDb.close();
        currentDb = null;
    }
}

function run(storeName, mode, work) {
    return openDb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = work(store);
        tx.oncomplete = () => resolve(request ? request.result : undefined);
        tx.onerror = () => reject(tx.error || new Error("Photo storage failed."));
    }));
}

export function isImageFile(file) {
    return Boolean(file && typeof file.type === "string" && file.type.startsWith("image/"));
}

// Re-encode through a canvas so hidden camera data (EXIF, including GPS) is not stored.
export async function encodePhotoWithoutExif(file, { maxEdge = 1600, quality = 0.9 } = {}) {
    if (!isImageFile(file)) throw new Error("Choose a photo of the ticket (an image file).");
    if (typeof createImageBitmap !== "function") {
        throw new Error("This browser cannot re-encode the photo without camera data.");
    }
    const bitmap = await createImageBitmap(file);
    try {
        const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("The photo could not be re-encoded.");
        ctx.drawImage(bitmap, 0, 0, width, height);
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(
                (next) => next ? resolve(next) : reject(new Error("The photo could not be re-encoded.")),
                "image/jpeg",
                quality
            );
        });
        return blob;
    } finally {
        if (typeof bitmap.close === "function") bitmap.close();
    }
}

export async function savePhoto({ id, file }) {
    if (!id) throw new Error("A photo id is required.");
    const blob = await encodePhotoWithoutExif(file);
    const record = {
        id,
        blob,
        type: "image/jpeg",
        name: "ticket-photo.jpg",
        size: blob.size,
        addedAt: new Date().toISOString(),
        storage: "indexeddb-local-stub",
        exifStripped: true
    };
    await run(STORE, "readwrite", (store) => store.put(record));
    return { id, name: record.name, type: record.type, size: record.size, exifStripped: true };
}

export async function getPhoto(id) {
    if (!id) return null;
    const record = await run(STORE, "readonly", (store) => store.get(id));
    return record || null;
}

export async function deletePhoto(id) {
    if (!id) return;
    await run(STORE, "readwrite", (store) => store.delete(id));
}

export const PHOTO_DELETE_BLOCKED_COPY = "Close other Scratch Buddy tabs to finish deleting photos on this device.";

// Wait for onsuccess before reporting deletion complete.
// onblocked must not resolve the promise; it only warns that another tab is still open.
export function bindPhotoDatabaseDelete(request, { onBlocked } = {}) {
    return new Promise((resolve, reject) => {
        if (!request) {
            resolve({ deleted: true, blocked: false });
            return;
        }
        let blocked = false;
        request.onsuccess = () => resolve({ deleted: true, blocked });
        request.onerror = () => reject(request.error || new Error("Photo storage could not be deleted."));
        request.onblocked = () => {
            blocked = true;
            if (typeof onBlocked === "function") onBlocked();
        };
    });
}

export function deletePhotoDatabase({ onBlocked } = {}) {
    closePhotoDb();
    if (typeof indexedDB === "undefined") {
        return Promise.resolve({ deleted: true, blocked: false });
    }
    const request = indexedDB.deleteDatabase(DB_NAME);
    return bindPhotoDatabaseDelete(request, { onBlocked });
}

export function photoObjectUrl(record) {
    if (!record || !record.blob) return null;
    return URL.createObjectURL(record.blob);
}
