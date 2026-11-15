import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AFFILIATION, SHELL_MARKUP, PRIVACY_MARKUP, TERMS_MARKUP } from "../js/markup.js";
import {
    DATA_UNAVAILABLE,
    expectedValuePerTicket,
    ledgerTotals,
    parseTicketEntry
} from "../js/scratch.js";

test("expected value is the average prize minus the ticket price", () => {
    const ev = expectedValuePerTicket({
        ticketsRemaining: 4,
        price: 1,
        tiers: [
            { prize: 5, count: 1 },
            { prize: 0, count: 3 }
        ]
    });
    assert.equal(ev, 0.25);
});

test("expected value stays unavailable unless the prize table is complete", () => {
    assert.equal(expectedValuePerTicket({ tiers: null, ticketsRemaining: 10, price: 1 }), null);
    assert.equal(expectedValuePerTicket({
        ticketsRemaining: 10,
        price: 1,
        tiers: [{ prize: 100, count: 1 }]
    }), null);
    assert.equal(expectedValuePerTicket({
        ticketsRemaining: 0,
        price: 1,
        tiers: [{ prize: 0, count: 0 }]
    }), null);
});

test("the log totals are the sum of entered tickets", () => {
    assert.deepEqual(ledgerTotals([
        { cost: 5, payout: 0 },
        { cost: 2, payout: 10 }
    ]), { count: 2, spent: 7, won: 10, net: 3 });
    assert.deepEqual(ledgerTotals([]), { count: 0, spent: 0, won: 0, net: 0 });
});

test("a ticket needs a name, a price, and a payout", () => {
    assert.equal(parseTicketEntry({ game: "  ", cost: "5", payout: "0" }).ok, false);
    assert.equal(parseTicketEntry({ game: "Weekday", cost: "", payout: "0" }).ok, false);
    const parsed = parseTicketEntry({ game: " Weekday ", cost: "5", payout: "0" });
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.ticket, { game: "Weekday", cost: 5, payout: 0 });
});

test("the shell stays behind an age gate and ships no invented data or banned phrases", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const privacy = readFileSync(new URL("../privacy.html", import.meta.url), "utf8");
    const terms = readFileSync(new URL("../terms.html", import.meta.url), "utf8");
    [html, privacy, terms].forEach((page) => {
        assert.match(page, /noindex,nofollow/);
        assert.match(page, /id="age-gate"/);
        assert.match(page, /id="app-shell" inert/);
        assert.equal(page.includes(AFFILIATION), true);
        assert.equal(page.includes("$1.99"), false);
        assert.equal(page.includes("Subscribe"), false);
    });
    assert.match(SHELL_MARKUP, /Scratch Buddy/);
    assert.match(SHELL_MARKUP, /Find a Machine or Venue/);
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
    assert.match(SHELL_MARKUP, /id="payout-heat-map"/);
    assert.match(SHELL_MARKUP, /No payout data yet/);
    assert.match(SHELL_MARKUP, /No sample points are included/);
    assert.match(SHELL_MARKUP, /Optional: center on my location/);
    assert.equal(SHELL_MARKUP.includes("scratch_buddy_prize_logs"), false);
    assert.match(SHELL_MARKUP, /barcodes or serial numbers/);
    assert.equal(SHELL_MARKUP.includes("will arrive in a later step"), false);
    assert.match(html, /leaflet@1\.9\.4/);
    assert.match(html, /leaflet\.markercluster@1\.5\.3/);
    assert.equal(html.includes("googletagmanager"), false);
    assert.equal(html.includes("google-analytics"), false);
    const mapSource = readFileSync(new URL("../js/map.js", import.meta.url), "utf8");
    assert.match(mapSource, /tile\.openstreetmap\.org/);
    assert.equal(mapSource.includes("googletagmanager"), false);
    assert.match(SHELL_MARKUP, /No payout data yet/);
    assert.match(SHELL_MARKUP, /No prize logs on this device yet/);
    assert.match(SHELL_MARKUP, /id="payout-heat-map"/);
    assert.match(SHELL_MARKUP, /No payout data yet/);
    assert.match(SHELL_MARKUP, /No sample points are included/);
    assert.match(SHELL_MARKUP, /Optional: center on my location/);
    assert.equal(SHELL_MARKUP.includes("scratch_buddy_prize_logs"), false);
    assert.match(SHELL_MARKUP, /© 2026 NAV Analytics LLC/);
    assert.equal(SHELL_MARKUP.includes(AFFILIATION), true);
    assert.equal(PRIVACY_MARKUP.includes(AFFILIATION), true);
    assert.equal(TERMS_MARKUP.includes(AFFILIATION), true);
    ["live", "real-time", "play along", "mathematical edge", "+$2.15", "1 in 3.42", "+14.2%", "High Value", "advantage over", "jackpot"].forEach((phrase) => {
        const hay = (SHELL_MARKUP + PRIVACY_MARKUP + TERMS_MARKUP + html).toLowerCase();
        assert.equal(hay.includes(phrase.toLowerCase()), false, phrase);
    });
    assert.equal(typeof DATA_UNAVAILABLE, "string");
});
