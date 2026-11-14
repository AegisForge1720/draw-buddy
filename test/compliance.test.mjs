import assert from "node:assert/strict";
import test from "node:test";
import { LEGAL_ENTITY, TRACKING } from "../js/config.js";
import { classifyAttestation, classifyDob, readAgePass, writeAgePass } from "../js/age.js";
import {
    advertisingAllowed,
    buildConsentRecord,
    normalizeChoices,
    readActiveConsent,
    writeConsent
} from "../js/consent.js";
import { buildMetaSnippet, buildTikTokSnippet, pixelLoadPlan } from "../js/pixels.js";
import { withSocialUtm } from "../js/utm.js";

function memory() {
    const data = new Map();
    return {
        getItem(key) { return data.has(key) ? data.get(key) : null; },
        setItem(key, value) { data.set(key, String(value)); },
        removeItem(key) { data.delete(key); }
    };
}

const today = new Date(2026, 10, 14);

test("legal entity is NAV Analytics LLC at the Rochester address", () => {
    assert.equal(LEGAL_ENTITY.name, "NAV Analytics LLC");
    assert.equal(LEGAL_ENTITY.postalAddress, "58 Owaissa Dr, Rochester, NY 14622");
    assert.equal(LEGAL_ENTITY.privacyEmail, "privacy@insertcoinindustries.com");
    assert.equal(TRACKING.enabled, false);
    assert.equal(TRACKING.metaPixelId, "");
    assert.equal(TRACKING.tiktokPixelId, "");
    assert.equal(TRACKING.metaAutomaticAdvancedMatching, false);
});

test("date of birth classifies 18, 13, and under 13 without asking to store the date", () => {
    assert.equal(classifyDob({ year: 2008, month: 11, day: 14 }, today).outcome, "pass");
    assert.equal(classifyDob({ year: 2008, month: 11, day: 15 }, today).outcome, "under18");
    assert.equal(classifyDob({ year: 2013, month: 11, day: 14 }, today).outcome, "under18");
    assert.equal(classifyDob({ year: 2013, month: 11, day: 15 }, today).outcome, "under13");
    assert.equal(classifyDob({ year: 2013, month: 11, day: 15 }, today).persist, false);
    assert.equal(classifyDob({ year: 2008, month: 2, day: 31 }, today).outcome, "invalid");
    assert.deepEqual(classifyAttestation(false), { outcome: "under18", persist: false });
    assert.equal(classifyAttestation(true).persist, true);
});

test("a pass flag stores 18plus and not the date of birth", () => {
    const store = memory();
    const record = writeAgePass(store, Date.parse("2026-11-14T00:00:00Z"));
    assert.equal(record.flag, "18plus");
    assert.equal(JSON.stringify(record).includes("2008"), false);
    assert.ok(readAgePass(store, Date.parse("2026-11-14T00:00:00Z")));
    assert.equal(readAgePass(store, record.expiresAt), null);
    store.setItem("draw_buddy_age_gate", JSON.stringify({ flag: "18plus", expiresAt: record.expiresAt, dob: "2000-01-01" }));
    assert.equal(readAgePass(store, Date.parse("2026-11-14T00:00:00Z")), null);
});

test("GPC overrides an accept and reject leaves advertising off", () => {
    assert.deepEqual(normalizeChoices({ analytics: true, advertising: true }, true), {
        necessary: true,
        analytics: false,
        advertising: false
    });
    const store = memory();
    const rejected = buildConsentRecord({
        choices: { analytics: false, advertising: false },
        gpc: false,
        sourceUrl: "https://example.test/",
        now: Date.parse("2026-11-14T00:00:00Z"),
        surface: "reject"
    });
    writeConsent(store, rejected);
    const saved = readActiveConsent(store, Date.parse("2026-11-14T00:00:00Z"));
    assert.equal(saved.choices.advertising, false);
    assert.equal(JSON.stringify(saved).includes("dob"), false);
    assert.equal(advertisingAllowed({ agePassed: true, choices: saved.choices, gpc: false }), false);
    assert.equal(advertisingAllowed({ agePassed: true, choices: { advertising: true }, gpc: true }), false);
    assert.equal(advertisingAllowed({ agePassed: false, choices: { advertising: true }, gpc: false }), false);
});

test("pixel plan stays off without an id, consent, age, or when GPC or video is present", () => {
    const base = { enabled: true, metaPixelId: "123", tiktokPixelId: "456", agePassed: true, choices: { advertising: true } };
    assert.equal(pixelLoadPlan().reason, "disabled");
    assert.equal(pixelLoadPlan({ ...base, enabled: false }).reason, "disabled");
    assert.equal(pixelLoadPlan({ ...base, agePassed: false }).reason, "age-gate");
    assert.equal(pixelLoadPlan({ ...base, gpc: true }).reason, "gpc");
    assert.equal(pixelLoadPlan({ ...base, choices: { advertising: false } }).reason, "no-consent");
    assert.equal(pixelLoadPlan({ ...base, hasVideo: true }).reason, "video-page");
    assert.equal(pixelLoadPlan({ ...base, metaAutomaticAdvancedMatching: true }).reason, "advanced-matching-refused");
    assert.equal(pixelLoadPlan({ ...base, metaPixelId: "", tiktokPixelId: "" }).reason, "no-id");
    const snippet = buildMetaSnippet("123") + buildTikTokSnippet("456");
    assert.match(snippet, /holdConsent\(\);ttq\.load/);
    assert.equal(snippet.includes("em"), false);
    assert.equal(snippet.includes("@"), false);
    assert.equal(snippet.includes("phone"), false);
});

test("social UTM helper sets source, medium, and campaign", () => {
    const url = withSocialUtm("https://example.test/draw-buddy", "instagram");
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("utm_source"), "instagram");
    assert.equal(parsed.searchParams.get("utm_medium"), "social");
    assert.equal(parsed.searchParams.get("utm_campaign"), "draw-buddy-organic");
});
