// Same age-gate rules as Draw Buddy: 18+ to enter, nothing stored under 13,
// and a pass stores only flag "18plus" plus an expiry. The date of birth is
// not kept.

export const AGE_PASS_KEY = "scratch_buddy_age_gate";
export const AGE_BLOCK_KEY = "scratch_buddy_age_block";
export const MINIMUM_AGE = 18;
export const CHILD_AGE = 13;
export const AGE_PASS_DAYS = 90;

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

export function classifyDob(parts, today = new Date()) {
    const dob = parseDob(parts.year, parts.month, parts.day);
    if (!dob) return { outcome: "invalid", persist: false };
    const age = ageInYears(dob, today);
    if (age < CHILD_AGE) return { outcome: "under13", persist: false };
    if (age < MINIMUM_AGE) return { outcome: "under18", persist: false };
    return { outcome: "pass", persist: true };
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

export function writeAgePass(storage, now = Date.now(), maxDays = AGE_PASS_DAYS) {
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
