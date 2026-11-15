export const SESSION_KEY = "scratch_buddy_preview_session";

export function readSession(storage = localStorage) {
    try {
        const parsed = JSON.parse(storage.getItem(SESSION_KEY) || "null");
        if (!parsed || typeof parsed.handle !== "string") return null;
        const handle = parsed.handle.trim();
        if (!handle) return null;
        return { handle, createdAt: parsed.createdAt || null, localOnly: true };
    } catch {
        return null;
    }
}

export function writeSession(handle, storage = localStorage, now = new Date()) {
    const trimmed = String(handle || "").trim();
    if (trimmed.length < 2) {
        return { ok: false, reason: "Enter a display name with at least two characters." };
    }
    if (trimmed.length > 40) {
        return { ok: false, reason: "Keep the display name to 40 characters." };
    }
    const record = {
        handle: trimmed,
        createdAt: now.toISOString(),
        localOnly: true
    };
    storage.setItem(SESSION_KEY, JSON.stringify(record));
    return { ok: true, session: record };
}

export function clearSession(storage = localStorage) {
    storage.removeItem(SESSION_KEY);
}
