const DB_NAME = "scratch-buddy-preview";
const STORE = "ticket-photos";
const VERSION = 1;

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
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Photo storage could not be opened."));
    });
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

export async function savePhoto({ id, file }) {
    if (!id) throw new Error("A photo id is required.");
    if (!isImageFile(file)) throw new Error("Choose a photo of the ticket (an image file).");
    const record = {
        id,
        blob: file,
        type: file.type,
        name: file.name || "ticket-photo",
        size: file.size,
        addedAt: new Date().toISOString(),
        storage: "indexeddb-local-stub"
    };
    await run(STORE, "readwrite", (store) => store.put(record));
    return { id, name: record.name, type: record.type, size: record.size };
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

export function photoObjectUrl(record) {
    if (!record || !record.blob) return null;
    return URL.createObjectURL(record.blob);
}
