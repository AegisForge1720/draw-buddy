// Public client configuration. Everything in this file is shipped to the browser.
//
// SUPABASE_PUBLISHABLE_KEY is a publishable key. It is meant to be public.
// The API uses the anon Postgres role and only returns rows Row Level Security allows.
// Never put a service_role JWT or an sb_secret_ key in this file. index.html on the
// previous branch hardcoded a service_role JWT. That value was removed. Rotate it,
// because it is still in git history and bypasses Row Level Security.

// One constant for the operator. A rename to Insert Coin Industries LLC waits on
// the filed NY DOS Certificate of Amendment. Until that filing, every notice,
// footer, and terms line reads this object. Do not list the new name as the
// legal entity before then.
export const LEGAL_ENTITY = {
    name: "NAV Analytics LLC",
    productName: "Draw Buddy",
    postalAddress: "58 Owaissa Dr, Rochester, NY 14622",
    // TODO: this mailbox does not exist yet. Do not treat the notice as ready
    // to go live until someone monitors this inbox.
    privacyEmail: "privacy@insertcoinindustries.com"
};

export const NOTICE_DATES = {
    effective: "November 14, 2026",
    lastUpdated: "November 14, 2026"
};

// Bump this when the banner or notice text changes so a prior choice expires.
export const CONSENT_COPY_VERSION = "2026-11-14-2";

// Pixel scaffolding is hard-off. Leave the ids empty. Do not set enabled to
// true until the go-live checklist in RELEASE_CHECKLIST.md is signed.
export const TRACKING = {
    enabled: false,
    metaPixelId: "",
    tiktokPixelId: "",
    metaAutomaticAdvancedMatching: false
};

// Clean demo is the default. Leave these false for a screen recording.
// showAffiliateLinks must stay false: the growth memo (B2) bars sportsbook
// and courier links. There is no UI for them in this build.
export const DEMO_FLAGS = {
    showTicketPhotoImport: false,
    showAffiliateLinks: false
};

// Per game. False withholds every history-based stat for that game.
// Staleness is a separate check in historyStatus.
export const DATA_VERIFIED = {
    quickdraw: true,
    powerball: true,
    megamillions: true
};

// Public draw tables only. Archived rows are stored in the archive schema and
// are never queried from the client.
export const PUBLIC_DRAW_TABLES = {
    quickdraw: "quickdraw_history",
    powerball: "powerball_history",
    megamillions: "megamillions_history"
};

export function publicDrawTable(gameKey) {
    const name = PUBLIC_DRAW_TABLES[gameKey];
    if (typeof name !== "string" || name.length === 0) {
        throw new Error("Unknown draw game");
    }
    if (name.includes(".") || name.toLowerCase().includes("archive")) {
        throw new Error("Refusing a non-public draw table");
    }
    return name;
}

export const DRAW_BUDDY_CONFIG = {
    SUPABASE_URL: "https://kcvtuzadkyripylluqlj.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_540NEFDiVfOYxHeRyemjjg_Lrrce0PA",
    // App and site access age. Marketing and ad targeting stay 21+.
    MINIMUM_AGE: 18,
    CHILD_AGE: 13,
    QUICK_DRAW_ALCOHOL_AGE: 21,
    AGE_PASS_DAYS: 90,
    CONSENT_CHOICE_DAYS: 90,
    PLAN_MONTHLY_PRICE: 1.99,
    PLAN_ANNUAL_PRICE: 17
};

export function annualSavings(monthly = DRAW_BUDDY_CONFIG.PLAN_MONTHLY_PRICE, annual = DRAW_BUDDY_CONFIG.PLAN_ANNUAL_PRICE) {
    return Number((monthly * 12 - annual).toFixed(2));
}

export function formatPlanMoney(amount) {
    return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

// Accept a publishable key, or a legacy JWT whose role is anon.
// Reject secret keys and service_role JWTs before any request is made.
export function isBrowserSafeSupabaseKey(key) {
    if (!key || typeof key !== "string") return false;
    if (key.startsWith("sb_secret_")) return false;
    if (key.startsWith("sb_publishable_")) return true;
    const parts = key.split(".");
    if (parts.length !== 3) return false;
    try {
        const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padLength = (4 - (padded.length % 4)) % 4;
        const json = JSON.parse(atob(padded + "=".repeat(padLength)));
        return json.role === "anon";
    } catch {
        return false;
    }
}
