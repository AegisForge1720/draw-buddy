import { CONSENT_COPY_VERSION, DRAW_BUDDY_CONFIG } from "./config.js";

export const CONSENT_KEY = "draw_buddy_consent";
export const CONSENT_LOG_KEY = "draw_buddy_consent_log";

export function readGpc(nav = globalThis.navigator) {
    return Boolean(nav && nav.globalPrivacyControl === true);
}

export function blankChoices() {
    return { necessary: true, analytics: false, advertising: false };
}

// GPC is a full optional-tracking opt-out. It overrides a saved Accept.
export function normalizeChoices(choices, gpc) {
    const next = {
        necessary: true,
        analytics: Boolean(choices && choices.analytics),
        advertising: Boolean(choices && choices.advertising)
    };
    if (gpc) {
        next.analytics = false;
        next.advertising = false;
    }
    return next;
}

export function buildConsentRecord({ choices, gpc, sourceUrl, now = Date.now(), surface = "banner" }) {
    const normalized = normalizeChoices(choices, gpc);
    return {
        version: CONSENT_COPY_VERSION,
        timestamp: new Date(now).toISOString(),
        sourceUrl: String(sourceUrl || ""),
        surface,
        choices: normalized,
        gpc: Boolean(gpc),
        expiresAt: now + DRAW_BUDDY_CONFIG.CONSENT_CHOICE_DAYS * 24 * 60 * 60 * 1000
    };
}

export function readConsentLog(storage) {
    try {
        const parsed = JSON.parse(storage.getItem(CONSENT_LOG_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeConsent(storage, record) {
    const clean = {
        version: record.version,
        timestamp: record.timestamp,
        sourceUrl: record.sourceUrl,
        surface: record.surface,
        choices: {
            necessary: true,
            analytics: Boolean(record.choices && record.choices.analytics),
            advertising: Boolean(record.choices && record.choices.advertising)
        },
        gpc: Boolean(record.gpc),
        expiresAt: record.expiresAt
    };
    storage.setItem(CONSENT_KEY, JSON.stringify(clean));
    const log = readConsentLog(storage);
    log.push(clean);
    storage.setItem(CONSENT_LOG_KEY, JSON.stringify(log.slice(-100)));
    return clean;
}

export function readActiveConsent(storage, now = Date.now()) {
    try {
        const parsed = JSON.parse(storage.getItem(CONSENT_KEY) || "null");
        if (!parsed || parsed.version !== CONSENT_COPY_VERSION) return null;
        if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= now) return null;
        if (parsed.dob || parsed.dateOfBirth) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function advertisingAllowed({ agePassed, choices, gpc }) {
    if (!agePassed || gpc) return false;
    return Boolean(choices && choices.advertising);
}
