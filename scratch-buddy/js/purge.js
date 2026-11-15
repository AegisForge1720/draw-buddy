import { AGE_BLOCK_KEY, AGE_PASS_KEY, clearAgePass } from "./age.js";
import { LOG_KEY, saveLogs } from "./logs.js";
import { deletePhotoDatabase } from "./photos.js";
import { SESSION_KEY, clearSession } from "./session.js";

export const LOCAL_DATA_KEYS = [AGE_PASS_KEY, AGE_BLOCK_KEY, LOG_KEY, SESSION_KEY];

export async function deleteAllScratchBuddyData({
    localStore = localStorage,
    sessionStore = sessionStorage
} = {}) {
    clearAgePass(localStore);
    clearSession(localStore);
    saveLogs([], localStore);
    for (const key of LOCAL_DATA_KEYS) {
        try { localStore.removeItem(key); } catch { /* ignore */ }
        try { sessionStore.removeItem(key); } catch { /* ignore */ }
    }
    await deletePhotoDatabase();
}
