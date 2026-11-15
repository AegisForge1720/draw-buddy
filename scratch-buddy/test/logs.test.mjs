import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    formatDollars,
    parsePrizeLog,
    todayInNewYork,
    verificationFlags,
    verificationLabel,
    heatWeight
} from "../js/logs.js";

const base = {
    handle: "Andrew",
    game: "Cash Explosion",
    prizeAmount: "50",
    ticketPrice: "10",
    occurredOn: "2026-11-15",
    today: "2026-11-15",
    retailerId: "055003",
    retailerName: "WEGMANS #19",
    retailerCity: "ROCHESTER",
    retailerZip: "14622",
    retailerLat: 43.204234,
    retailerLng: -77.558785,
    retailerQuickDraw: true,
    presentConfirmed: true
};

test("todayInNewYork uses the Eastern date", () => {
    assert.equal(todayInNewYork(new Date("2026-11-15T23:30:00-05:00")), "2026-11-15");
    assert.equal(todayInNewYork(new Date("2026-11-16T00:30:00-05:00")), "2026-11-16");
});

test("formatDollars groups thousands", () => {
    assert.equal(formatDollars(1234.5), "$1,234.50");
    assert.equal(formatDollars(50), "$50.00");
});

test("a prize log requires a preview sign-in, presence confirmation, a retailer, and a prize amount", () => {
    assert.equal(parsePrizeLog({ ...base, handle: "" }).ok, false);
    assert.equal(parsePrizeLog({ ...base, presentConfirmed: false }).ok, false);
    assert.equal(parsePrizeLog({ ...base, retailerId: "" }).ok, false);
    assert.equal(parsePrizeLog({ ...base, prizeAmount: "0" }).ok, false);
    assert.equal(parsePrizeLog({ ...base, occurredOn: "2026-11-16" }).ok, false);
    const parsed = parsePrizeLog(base);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.log.presentConfirmed, true);
    assert.deepEqual(parsed.log.verification, ["unverified"]);
    assert.equal(parsed.log.localOnly, true);
});

test("the venue path needs a Quick Draw retailer and a ticket photo", () => {
    assert.equal(parsePrizeLog({ ...base, path: "bought_at_venue", photoAttached: true, retailerQuickDraw: false }).ok, false);
    assert.equal(parsePrizeLog({ ...base, path: "bought_at_venue", photoAttached: false }).ok, false);
    const parsed = parsePrizeLog({ ...base, path: "bought_at_venue", photoAttached: true });
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.log.verification, ["photo-attached"]);
});

test("verification flags and heat weights match the three levels", () => {
    assert.deepEqual(verificationFlags({ locationConfirmed: false, photoAttached: false }), ["unverified"]);
    assert.deepEqual(verificationFlags({ locationConfirmed: true, photoAttached: false }), ["location-confirmed"]);
    assert.deepEqual(verificationFlags({ locationConfirmed: false, photoAttached: true }), ["photo-attached"]);
    assert.deepEqual(verificationFlags({ locationConfirmed: true, photoAttached: true }), ["location-confirmed", "photo-attached"]);
    assert.equal(verificationLabel(["unverified"]), "Unverified");
    assert.equal(verificationLabel(["location-confirmed", "photo-attached"]), "Location-confirmed and photo-attached");
    assert.equal(heatWeight(["unverified"]), 1);
    assert.equal(heatWeight(["location-confirmed"]), 2);
    assert.equal(heatWeight(["photo-attached"]), 2);
    assert.equal(heatWeight(["location-confirmed", "photo-attached"]), 3);
});

test("the draft SQL is not an applied migration and includes RLS", () => {
    const sql = readFileSync(new URL("../supabase/migrations/0001_prize_logs.sql", import.meta.url), "utf8");
    assert.match(sql, /DRAFT ONLY/);
    assert.match(sql, /needs Andrew's explicit OK/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /auth\.uid\(\) = user_id/);
    assert.match(sql, /Do not create a Storage bucket/);
    // Every statement is commented so a casual apply cannot create production tables.
    for (const line of sql.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("--")) continue;
        assert.fail(`Uncommented SQL: ${trimmed}`);
    }
});
