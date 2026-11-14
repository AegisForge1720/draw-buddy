import { TRACKING } from "./config.js";

const VIDEO_SELECTOR = "video, iframe[src*='youtube.com'], iframe[src*='youtu.be'], iframe[src*='tiktok.com'], iframe[src*='vimeo.com']";

export function pageHasVideo(doc) {
    if (!doc || typeof doc.querySelector !== "function") return false;
    return Boolean(doc.querySelector(VIDEO_SELECTOR));
}

// Decides whether a marketing pixel may be inserted. Empty ids and
// TRACKING.enabled === false keep this preview from loading any pixel.
// Automatic advanced matching is refused. The plan never carries email or phone.
export function pixelLoadPlan({
    agePassed = false,
    choices = null,
    gpc = false,
    hasVideo = false,
    enabled = TRACKING.enabled,
    metaPixelId = TRACKING.metaPixelId,
    tiktokPixelId = TRACKING.tiktokPixelId,
    metaAutomaticAdvancedMatching = TRACKING.metaAutomaticAdvancedMatching
} = {}) {
    const blocked = (reason) => ({
        meta: false,
        tiktok: false,
        reason,
        advancedMatching: false,
        customerData: false
    });
    if (!enabled) return blocked("disabled");
    if (!agePassed) return blocked("age-gate");
    if (gpc) return blocked("gpc");
    if (!choices || !choices.advertising) return blocked("no-consent");
    if (hasVideo) return blocked("video-page");
    if (metaAutomaticAdvancedMatching) return blocked("advanced-matching-refused");
    return {
        meta: Boolean(metaPixelId),
        tiktok: Boolean(tiktokPixelId),
        metaPixelId: metaPixelId || "",
        tiktokPixelId: tiktokPixelId || "",
        reason: metaPixelId || tiktokPixelId ? "allowed" : "no-id",
        advancedMatching: false,
        customerData: false
    };
}

export function buildMetaSnippet(id) {
    if (!id || TRACKING.metaAutomaticAdvancedMatching) return "";
    // init receives the pixel id only. No em, ph, fn, ln, or external_id.
    return `fbq('set','autoConfig',false,'${id}');fbq('init','${id}');`;
}

export function buildTikTokSnippet(id) {
    if (!id) return "";
    // holdConsent before load. grantConsent only belongs in this snippet because
    // the caller may run it after an opt-in. Reject and GPC never call it.
    return `ttq.holdConsent();ttq.load('${id}');ttq.grantConsent();`;
}

// Inserts inert scaffolds (type=text/plain, no src) only when the plan allows.
// This preview's plan never allows them, because TRACKING.enabled is false and
// the ids are empty. Nothing here sets a network URL.
export function installPixelScaffolds(doc, plan) {
    if (!doc || !plan || plan.reason !== "allowed") return [];
    const loaded = [];
    if (plan.meta) {
        const script = doc.createElement("script");
        script.type = "text/plain";
        script.dataset.pixelScaffold = "meta";
        script.textContent = buildMetaSnippet(plan.metaPixelId);
        doc.head.appendChild(script);
        loaded.push("meta");
    }
    if (plan.tiktok) {
        const script = doc.createElement("script");
        script.type = "text/plain";
        script.dataset.pixelScaffold = "tiktok";
        script.textContent = buildTikTokSnippet(plan.tiktokPixelId);
        doc.head.appendChild(script);
        loaded.push("tiktok");
    }
    return loaded;
}

export function removePixelScaffolds(doc) {
    if (!doc || typeof doc.querySelectorAll !== "function") return;
    doc.querySelectorAll("[data-pixel-scaffold]").forEach((node) => node.remove());
}
