/* Scratch Buddy feature flags (ES module, imported by app.js, legal-page.js, markup.js and map.js).
 *
 * PUBLIC DEFAULTS ARE ALL OFF. A page is treated as the private preview only when a private
 * preview server (Basic Auth + noindex) injects <meta name="sb-build" content="private-preview">
 * into the HTML at serve time. Any other host (a static copy, a public build, GitHub Pages) gets
 * PUBLIC_DEFAULTS. This file is an ES module that app.js imports, so if it fails to load the app
 * does not start at all; nothing can fall back to "on".
 *
 * Ralph's Scratch Buddy review (legal/scratch_buddy_compliance_review.md):
 *  - quickDrawVenue: the "Bought at a venue" path, the "Quick Draw venues only" filter and the
 *    "Quick Draw venue" badges (memo §4 item 8 / re-review N1). OFF in public until removed or
 *    re-justified and re-reviewed.
 *  - previewBanner: the private-preview explainer banner. OFF in public.
 *  - sharedAccounts, pricing, shareQr: no code exists for these. They are reserved and OFF
 *    everywhere until Gate 0 (§206 cure), Ralph's clearance and Andrew's OK.
 */
export const PUBLIC_DEFAULTS = Object.freeze({
    quickDrawVenue: false,
    previewBanner: false,
    sharedAccounts: false,
    pricing: false,
    shareQr: false
});

export const PRIVATE_PREVIEW = Object.freeze({
    ...PUBLIC_DEFAULTS,
    quickDrawVenue: true,
    previewBanner: true
});

// Map tile provider. OpenStreetMap's public tile servers are for light use only and are a
// launch blocker (re-review N4). Switching provider needs Andrew's OK; update the privacy
// notice host name at the same time (it reads TILE_PROVIDER.host).
export const TILE_PROVIDER = Object.freeze({
    name: "OpenStreetMap",
    host: "tile.openstreetmap.org",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer" target="_blank">OpenStreetMap</a>'
});

export function buildMode(doc) {
    try {
        const meta = doc && doc.querySelector && doc.querySelector('meta[name="sb-build"]');
        return meta && meta.getAttribute("content") === "private-preview" ? "private-preview" : "public";
    } catch {
        return "public";
    }
}

export function resolveFlags(doc) {
    return buildMode(doc) === "private-preview" ? { ...PRIVATE_PREVIEW } : { ...PUBLIC_DEFAULTS };
}

const DOC = typeof document !== "undefined" ? document : null;
export const BUILD = buildMode(DOC);
export const FLAGS = Object.freeze(resolveFlags(DOC));

if (typeof window !== "undefined") {
    window.SB_BUILD = BUILD;
    window.SB_FLAGS = FLAGS;
}
