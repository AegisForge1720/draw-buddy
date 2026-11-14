// Public client configuration. Everything in this file is shipped to the browser.
//
// SUPABASE_PUBLISHABLE_KEY is a publishable key. It is meant to be public.
// The API uses the anon Postgres role and only returns rows Row Level Security allows.
// Never put a service_role JWT or an sb_secret_ key in this file. index.html on the
// previous branch hardcoded a service_role JWT. That value was removed. Rotate it,
// because it is still in git history and bypasses Row Level Security.

export const DRAW_BUDDY_CONFIG = {
    SUPABASE_URL: "https://kcvtuzadkyripylluqlj.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_540NEFDiVfOYxHeRyemjjg_Lrrce0PA",
    // TODO(legal): confirm the age required for the store listing and for lottery-adjacent content.
    MINIMUM_AGE: 18,
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
