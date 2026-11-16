import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
    AFFILIATION,
    HOPENY_LINE,
    LOG_DISCLOSURE,
    NOT_AFFILIATED_LINE,
    PAST_RESULTS_LINE,
    SHELL_MARKUP,
    PRIVACY_MARKUP,
    TERMS_MARKUP
} from "../js/markup.js";

test("the shell stays behind an age gate and ships no invented data or banned phrases", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const privacy = readFileSync(new URL("../privacy.html", import.meta.url), "utf8");
    const terms = readFileSync(new URL("../terms.html", import.meta.url), "utf8");
    [html, privacy, terms].forEach((page) => {
        assert.match(page, /noindex,nofollow/);
        assert.match(page, /id="age-gate"/);
        assert.match(page, /id="app-shell" inert/);
        assert.equal(page.includes(AFFILIATION), true);
        assert.equal(page.includes(PAST_RESULTS_LINE), true);
        assert.equal(page.includes(HOPENY_LINE), true);
        assert.equal(page.includes(NOT_AFFILIATED_LINE), true);
        assert.equal(page.includes("$1.99"), false);
        assert.equal(page.includes("Subscribe"), false);
        assert.equal(page.includes("cdn.tailwindcss.com"), false);
        assert.equal(page.includes("unpkg.com"), false);
        assert.equal(page.includes("cdn.jsdelivr.net"), false);
    });
    assert.match(SHELL_MARKUP, /Scratch Buddy/);
    assert.match(SHELL_MARKUP, /Find a licensed retailer/);
    assert.equal(SHELL_MARKUP.includes("Find a Machine or Venue"), false);
    assert.equal(SHELL_MARKUP.includes("badge-ny"), false);
    assert.equal(SHELL_MARKUP.includes(">NY<"), false);
    assert.match(SHELL_MARKUP, /Search by name, address, city, or ZIP/);
    assert.match(SHELL_MARKUP, /id="retailer-source"/);
    assert.match(SHELL_MARKUP, /Use your location\?/);
    assert.match(SHELL_MARKUP, /The full official list is not shown all at once/);
    assert.match(SHELL_MARKUP, /id="retailer-near"/);
    assert.match(SHELL_MARKUP, /id="retailer-map"/);
    assert.match(SHELL_MARKUP, /id="map-mode-all"/);
    assert.match(SHELL_MARKUP, /id="map-mode-results"/);
    assert.match(SHELL_MARKUP, /id="prize-log-form"/);
    assert.match(SHELL_MARKUP, /I confirm I was at this location when I received this prize/);
    assert.match(SHELL_MARKUP, /Bought at a venue/);
    assert.match(SHELL_MARKUP, /Optional GPS check-in/);
    assert.match(SHELL_MARKUP, /No prize logs on this device yet/);
    assert.match(SHELL_MARKUP, /id="my-log-map"/);
    assert.match(SHELL_MARKUP, /My Log Map/);
    assert.match(SHELL_MARKUP, /No prize logs on this map yet/);
    assert.match(SHELL_MARKUP, /Every store marker looks the same/);
    assert.equal(SHELL_MARKUP.toLowerCase().includes("heat"), false);
    assert.equal(SHELL_MARKUP.toLowerCase().includes("payout"), false);
    assert.equal(PRIVACY_MARKUP.toLowerCase().includes("heat"), false);
    assert.equal(PRIVACY_MARKUP.toLowerCase().includes("payout"), false);
    assert.match(SHELL_MARKUP, /No sample points are included/);
    assert.match(SHELL_MARKUP, /Optional: center on my location/);
    assert.match(SHELL_MARKUP, /id="delete-all-data"/);
    assert.match(SHELL_MARKUP, /id="photo-redact-confirm"/);
    assert.match(SHELL_MARKUP, /id="photo-redact-confirm"[^>]*\sdisabled/);
    assert.match(SHELL_MARKUP, /close them so photos can be fully removed/);
    assert.match(PRIVACY_MARKUP, /Delete all my data/);
    assert.match(PRIVACY_MARKUP, /close them so photos can be fully removed/);
    assert.match(PRIVACY_MARKUP, /Under 18, only a session-only block flag is kept until the tab is closed; no date of birth is kept/);
    assert.equal(PRIVACY_MARKUP.includes("Under 18, nothing is kept"), false);
    assert.match(PRIVACY_MARKUP, /tile\.openstreetmap\.org/);
    assert.match(PRIVACY_MARKUP, /Leaflet and Tailwind are self-hosted/);
    assert.equal(SHELL_MARKUP.includes("scratch_buddy_prize_logs"), false);
    assert.match(SHELL_MARKUP, /barcode, validation number, and PIN/);
    assert.equal(SHELL_MARKUP.includes("will arrive in a later step"), false);
    assert.match(html, /vendor\/leaflet\/leaflet\.js/);
    assert.match(html, /vendor\/leaflet\.markercluster\/leaflet\.markercluster\.js/);
    assert.match(html, /css\/tailwind\.css/);
    assert.equal(html.includes("googletagmanager"), false);
    assert.equal(html.includes("google-analytics"), false);
    const mapSource = readFileSync(new URL("../js/map.js", import.meta.url), "utf8");
    assert.match(mapSource, /tile\.openstreetmap\.org/);
    assert.equal(mapSource.includes("googletagmanager"), false);
    assert.match(SHELL_MARKUP, /© 2026 NAV Analytics LLC/);
    assert.equal(SHELL_MARKUP.includes(AFFILIATION), true);
    assert.equal(SHELL_MARKUP.includes(PAST_RESULTS_LINE), true);
    assert.equal(SHELL_MARKUP.includes(HOPENY_LINE), true);
    assert.equal(SHELL_MARKUP.includes(NOT_AFFILIATED_LINE), true);
    assert.equal(SHELL_MARKUP.includes(LOG_DISCLOSURE), true);
    assert.equal(PRIVACY_MARKUP.includes(AFFILIATION), true);
    assert.equal(TERMS_MARKUP.includes(AFFILIATION), true);
    assert.equal(PRIVACY_MARKUP.includes(PAST_RESULTS_LINE), true);
    assert.equal(TERMS_MARKUP.includes(PAST_RESULTS_LINE), true);
    assert.equal(html.toLowerCase().includes("heat"), false);
    assert.equal(html.toLowerCase().includes("payout"), false);
    ["live", "real-time", "play along", "mathematical edge", "+$2.15", "1 in 3.42", "+14.2%", "High Value", "advantage over", "jackpot"].forEach((phrase) => {
        const hay = (SHELL_MARKUP + PRIVACY_MARKUP + TERMS_MARKUP + html).toLowerCase();
        assert.equal(hay.includes(phrase.toLowerCase()), false, phrase);
    });
});

test("the app self-hosts Leaflet and Tailwind and no longer ships scratch.js", () => {
    const root = new URL("../", import.meta.url);
    assert.equal(existsSync(new URL("js/scratch.js", root)), false);
    assert.equal(existsSync(new URL("vendor/leaflet/leaflet.js", root)), true);
    assert.equal(existsSync(new URL("vendor/leaflet/leaflet.css", root)), true);
    assert.equal(existsSync(new URL("vendor/leaflet/images/marker-icon.png", root)), true);
    assert.equal(existsSync(new URL("vendor/leaflet.markercluster/leaflet.markercluster.js", root)), true);
    assert.equal(existsSync(new URL("css/tailwind.css", root)), true);
    const app = readFileSync(new URL("js/app.js", root), "utf8");
    const html = readFileSync(new URL("index.html", root), "utf8");
    assert.equal(app.includes("./scratch.js"), false);
    assert.equal(html.includes("scratch.js"), false);
    const mapSource = readFileSync(new URL("js/map.js", root), "utf8");
    assert.match(mapSource, /function createLogMap/);
    assert.equal(mapSource.includes("createPayoutHeatMap"), false);
    assert.equal(mapSource.includes("prizeTotal"), false);
    assert.equal(mapSource.includes("Weight "), false);
    assert.match(mapSource, /Your prize logs at this store, on this device only/);
    const photos = readFileSync(new URL("js/photos.js", root), "utf8");
    assert.match(photos, /encodePhotoWithoutExif/);
    assert.match(photos, /createImageBitmap/);
    assert.match(photos, /toBlob/);
    assert.equal(photos.includes("blob: file"), false);
});
