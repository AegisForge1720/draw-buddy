import { DRAW_BUDDY_CONFIG } from "./config.js";

export const AGE_PASS_KEY = "draw_buddy_age_gate";
export const LEGACY_AGE_KEY = "draw_buddy_age_confirmed";

export function parseDob(year, month, day) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
}

export function ageInYears(dob, today) {
    let age = today.getFullYear() - dob.getFullYear();
    const monthDelta = today.getMonth() - dob.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) age -= 1;
    return age;
}

// "under13" is actual knowledge under COPPA. "under18" is a failed gate.
// "pass" is 18 or older. Nothing here returns the date for storage.
export function classifyDob(parts, today = new Date()) {
    const dob = parseDob(parts.year, parts.month, parts.day);
    if (!dob) return { outcome: "invalid", persist: false };
    const age = ageInYears(dob, today);
    if (age < DRAW_BUDDY_CONFIG.CHILD_AGE) return { outcome: "under13", persist: false };
    if (age < DRAW_BUDDY_CONFIG.MINIMUM_AGE) return { outcome: "under18", persist: false };
    return { outcome: "pass", persist: true };
}

export function classifyAttestation(checked) {
    if (checked === true) return { outcome: "pass", persist: true };
    return { outcome: "under18", persist: false };
}

export function readAgePass(storage, now = Date.now()) {
    try {
        const parsed = JSON.parse(storage.getItem(AGE_PASS_KEY) || "null");
        if (!parsed || parsed.flag !== "18plus") return null;
        if (Object.prototype.hasOwnProperty.call(parsed, "dob")) return null;
        if (Object.prototype.hasOwnProperty.call(parsed, "dateOfBirth")) return null;
        if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= now) return null;
        return { flag: "18plus", expiresAt: parsed.expiresAt };
    } catch {
        return null;
    }
}

export function writeAgePass(storage, now = Date.now(), maxDays = DRAW_BUDDY_CONFIG.AGE_PASS_DAYS) {
    const record = {
        flag: "18plus",
        expiresAt: now + maxDays * 24 * 60 * 60 * 1000
    };
    storage.setItem(AGE_PASS_KEY, JSON.stringify(record));
    return record;
}

export function clearAgePass(storage) {
    storage.removeItem(AGE_PASS_KEY);
}
