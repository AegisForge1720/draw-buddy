import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { haversineMeters } from "../js/geo.js";
import {
    formatCacheTimestamp,
    nearbyRetailers,
    searchRetailers
} from "../js/retailers.js";

const fixture = [
    { id: "1", name: "LAKE FLOWER DELI", street: "615 LAKE FLOWER AVE", city: "SARANAC LAKE", state: "NY", zip: "12983", quickDraw: false, lat: 44.31, lng: -74.11 },
    { id: "2", name: "MAIN STREET GRILLE", street: "75 MAIN ST", city: "TUPPER LAKE", state: "NY", zip: "12986", quickDraw: true, lat: 44.24, lng: -74.48 },
    { id: "3", name: "EAST SIDE MARKET", street: "100 EAST AVE", city: "ROCHESTER", state: "NY", zip: "14607", quickDraw: true, lat: 43.15, lng: -77.58 }
];

test("search matches name, street, city, or ZIP and requires every token", () => {
    assert.equal(searchRetailers(fixture, "flower deli").total, 1);
    assert.equal(searchRetailers(fixture, "615 lake").rows[0].id, "1");
    assert.equal(searchRetailers(fixture, "rochester").rows[0].id, "3");
    assert.equal(searchRetailers(fixture, "14607").rows[0].id, "3");
    assert.equal(searchRetailers(fixture, "lake texas").total, 0);
    assert.equal(searchRetailers(fixture, "   ").emptyQuery, true);
    assert.equal(searchRetailers(fixture, "   ").rows.length, 0);
    assert.equal(searchRetailers(fixture, "lake", { quickDrawOnly: true }).total, 1);
    assert.equal(searchRetailers(fixture, "lake", { quickDrawOnly: true }).rows[0].id, "2");
    // A 5-digit ZIP must not match a longer retailer id that only contains those digits.
    const withIdOverlap = fixture.concat([{
        id: "114622",
        name: "HOWELLS MINI MART",
        street: "172 HOWELLS RD",
        city: "BAY SHORE",
        state: "NY",
        zip: "11706",
        quickDraw: false,
        lat: 40.73,
        lng: -73.27
    }]);
    assert.equal(searchRetailers(withIdOverlap, "14622").total, 0);
    assert.equal(searchRetailers(withIdOverlap, "114622").rows[0].id, "114622");
    assert.equal(searchRetailers(withIdOverlap, "11706").rows[0].id, "114622");
});

test("search truncates long result sets", () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
        id: String(i),
        name: "TEST MART",
        street: "1 MAIN",
        city: "ALBANY",
        state: "NY",
        zip: "12207",
        quickDraw: false,
        lat: 42.65,
        lng: -73.75
    }));
    const result = searchRetailers(many, "albany", { limit: 100 });
    assert.equal(result.total, 120);
    assert.equal(result.rows.length, 100);
    assert.equal(result.truncated, true);
});

test("nearby sorts by distance and skips rows without coordinates", () => {
    const withGap = fixture.concat([{ id: "4", name: "NO PIN", street: "1 A ST", city: "BUFFALO", state: "NY", zip: "14201", quickDraw: false, lat: null, lng: null }]);
    const rows = nearbyRetailers(withGap, 43.15, -77.58, { limit: 10, distanceFn: haversineMeters });
    assert.equal(rows[0].id, "3");
    assert.equal(rows.some((row) => row.id === "4"), false);
    assert.ok(rows[0].distanceM < rows[1].distanceM);
});

test("cache timestamps are labeled in Eastern Time", () => {
    assert.equal(formatCacheTimestamp("2026-11-15T18:07:43-05:00"), "November 15, 2026 at 6:07 PM ET");
    assert.equal(formatCacheTimestamp(""), null);
});

test("the official retailer cache has a source, a retrieved-at date, and no extra invented rows", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/retailers.json", import.meta.url), "utf8"));
    assert.equal(payload.datasetId, "2vvn-pdyi");
    assert.equal(payload.source, "NYS Lottery Retailers");
    assert.match(payload.retrievedAt, /^2026-11-15T18:07:43-05:00$/);
    assert.equal(payload.count, payload.retailers.length);
    assert.ok(payload.retailers.length > 0);
    assert.equal(payload.retailers.length, 13129);
    assert.equal(payload.quickDrawCount, payload.retailers.filter((row) => row.quickDraw).length);
    const first = payload.retailers[0];
    ["id", "name", "street", "city", "state", "zip", "lat", "lng"].forEach((key) => {
        assert.ok(key in first, key);
    });
});
