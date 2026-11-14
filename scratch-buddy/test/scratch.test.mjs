import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AFFILIATION, EV_COPY, LOG_MARKUP, PRIVACY_MARKUP, TERMS_MARKUP } from "../js/markup.js";
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

test("the scratch-off page does not ship invented prize figures or an edge claim", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const privacy = readFileSync(new URL("../privacy.html", import.meta.url), "utf8");
    const terms = readFileSync(new URL("../terms.html", import.meta.url), "utf8");
    [html, privacy, terms].forEach((page) => {
        assert.match(page, /noindex,nofollow/);
        assert.match(page, /id="age-gate"/);
        assert.match(page, /id="app-shell" inert/);
        assert.equal(page.includes("Log this ticket"), false);
        assert.equal(page.includes("Published game figures"), false);
        assert.equal(page.includes(AFFILIATION), true);
        assert.equal(page.includes("$1.99"), false);
    });
    assert.equal(LOG_MARKUP.includes("Published game figures"), true);
    assert.equal(LOG_MARKUP.includes("Official game figures"), false);
    assert.equal(LOG_MARKUP.includes(EV_COPY), true);
    assert.equal(LOG_MARKUP.includes(DATA_UNAVAILABLE), true);
    assert.equal(PRIVACY_MARKUP.includes(AFFILIATION), true);
    assert.equal(TERMS_MARKUP.includes(AFFILIATION), true);
    ["mathematical edge", "+$2.15", "1 in 3.42", "+14.2%", "High Value", "advantage over"].forEach((phrase) => {
        assert.equal(LOG_MARKUP.includes(phrase), false, phrase);
    });
});
