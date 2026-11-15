import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    formatDollars,
    parsePrizeLog,
    todayInNewYork,
    verificationFlags,
    verificationLabel,
    groupLogsByRetailer,
    sanitizeCheckin,
    LABEL_SELF_REPORTED,
    LABEL_GPS_CHECKIN,
    LABEL_PHOTO
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

test("the venue path needs a Quick Draw retailer, and a ticket photo is optional", () => {
    assert.equal(parsePrizeLog({ ...base, path: "bought_at_venue", photoAttached: true, retailerQuickDraw: false }).ok, false);
    const withoutPhoto = parsePrizeLog({ ...base, path: "bought_at_venue", photoAttached: false });
    assert.equal(withoutPhoto.ok, true);
    assert.deepEqual(withoutPhoto.log.verification, ["unverified"]);
    const parsed = parsePrizeLog({ ...base, path: "bought_at_venue", photoAttached: true });
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.log.verification, ["photo-attached"]);
});

test("badge labels match the three self-report marks", () => {
    assert.deepEqual(verificationFlags({ locationConfirmed: false, photoAttached: false }), ["unverified"]);
    assert.deepEqual(verificationFlags({ locationConfirmed: true, photoAttached: false }), ["location-confirmed"]);
    assert.deepEqual(verificationFlags({ locationConfirmed: false, photoAttached: true }), ["photo-attached"]);
    assert.deepEqual(verificationFlags({ locationConfirmed: true, photoAttached: true }), ["location-confirmed", "photo-attached"]);
    assert.equal(verificationLabel(["unverified"]), LABEL_SELF_REPORTED);
    assert.equal(verificationLabel(["location-confirmed"]), LABEL_GPS_CHECKIN);
    assert.equal(verificationLabel(["photo-attached"]), LABEL_PHOTO);
    assert.equal(verificationLabel(["location-confirmed", "photo-attached"]), "GPS check-in near store and photo on this device");
});

test("the draft SQL is not an applied migration and includes RLS", () => {
    const sql = readFileSync(new URL("../supabase/migrations/0001_prize_logs.sql", import.meta.url), "utf8");
    assert.match(sql, /DRAFT ONLY/);
    assert.match(sql, /needs Andrew's explicit OK/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /auth\.uid\(\) = user_id/);
    assert.match(sql, /Do not create a Storage bucket/);
    assert.equal(sql.includes("checkin_lat"), false);
    assert.equal(sql.includes("checkin_lng"), false);
    assert.equal(sql.includes("prize_logs_location_coords_chk"), false);
    assert.match(sql, /distance_band/);
    assert.equal(sql.includes("prize_logs_venue_photo_chk"), false);
    // Every statement is commented so a casual apply cannot create production tables.
    for (const line of sql.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("--")) continue;
        assert.fail(`Uncommented SQL: ${trimmed}`);
    }
});

test("My Log Map has no points until real logs exist, and it does not rank or total stores", () => {
    assert.deepEqual(groupLogsByRetailer([]), []);
    assert.deepEqual(groupLogsByRetailer(null), []);
    const groups = groupLogsByRetailer([
        { retailerId: "1", retailerName: "A", retailerLat: 43.2, retailerLng: -77.5, prizeAmount: 50, verification: ["unverified"], game: "One", occurredOn: "2026-11-15" },
        { retailerId: "1", retailerName: "A", retailerLat: 43.2, retailerLng: -77.5, prizeAmount: 25, verification: ["photo-attached"], game: "Two", occurredOn: "2026-11-14" },
        { retailerId: "2", retailerName: "B", retailerLat: 43.21, retailerLng: -77.56, prizeAmount: 10, verification: ["location-confirmed", "photo-attached"], game: "Three", occurredOn: "2026-11-13" }
    ]);
    const first = groups.find((group) => group.retailerId === "1");
    const second = groups.find((group) => group.retailerId === "2");
    assert.equal(first.entries.length, 2);
    assert.equal(first.entries[0].game, "One");
    assert.equal(first.entries[1].game, "Two");
    assert.equal(Object.prototype.hasOwnProperty.call(first, "prizeTotal"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(first, "weight"), false);
    assert.equal(second.entries.length, 1);
    assert.deepEqual(groupLogsByRetailer([{ retailerId: "x", prizeAmount: 5 }]), []);
    const src = readFileSync(new URL("../js/logs.js", import.meta.url), "utf8");
    assert.equal(src.includes("heatWeight"), false);
    assert.equal(src.includes("aggregatePayouts"), false);
    assert.equal(src.includes("heatGroupStyle"), false);
});

test("check-in records keep only pass/fail, a date, and a distance band", () => {
    assert.equal(sanitizeCheckin(null), null);
    assert.equal(sanitizeCheckin({ ok: false, lat: 43.2, lng: -77.5, at: "2026-11-15" }), null);
    const clean = sanitizeCheckin({
        ok: true,
        lat: 43.204234,
        lng: -77.558785,
        accuracyM: 12,
        distanceM: 20,
        at: "2026-11-15T23:11:00-05:00",
        distanceBand: "<50 m"
    });
    assert.deepEqual(clean, { ok: true, at: "2026-11-15", distanceBand: "<50 m" });
    assert.equal(Object.prototype.hasOwnProperty.call(clean, "lat"), false);
    const fromMeters = sanitizeCheckin({ ok: true, distanceM: 80, at: "2026-11-15" });
    assert.equal(fromMeters.distanceBand, "50-150 m");
    const parsed = parsePrizeLog({
        ...base,
        locationConfirmed: true,
        checkin: { ok: true, lat: 1, lng: 2, accuracyM: 5, distanceM: 10, at: "2026-11-15T12:00:00Z" }
    });
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.log.checkin, { ok: true, at: "2026-11-15", distanceBand: "<50 m" });
});
