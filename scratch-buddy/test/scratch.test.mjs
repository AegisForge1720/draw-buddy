import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    DATA_UNAVAILABLE,
    EV_LINE,
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
    const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    assert.equal(page.includes(DATA_UNAVAILABLE), true);
    assert.equal(page.includes(EV_LINE), true);
    ["mathematical edge", "+$2.15", "1 in 3.42", "+14.2%", "High Value", "advantage over"].forEach((phrase) => {
        assert.equal(page.includes(phrase), false, phrase);
    });
    assert.match(page, /not a prediction or an advantage/);
});
