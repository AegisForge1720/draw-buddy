import assert from "node:assert/strict";
import test from "node:test";
import { distanceBand, evaluateCheckIn } from "../js/geo.js";

test("distance bands are coarse and omit exact meters", () => {
    assert.equal(distanceBand(0), "<50 m");
    assert.equal(distanceBand(49.9), "<50 m");
    assert.equal(distanceBand(50), "50-150 m");
    assert.equal(distanceBand(150), "50-150 m");
    assert.equal(distanceBand(150.1), null);
    assert.equal(distanceBand(null), null);
    const result = evaluateCheckIn({
        userLat: 43.204234,
        userLng: -77.558785,
        accuracyM: 10,
        retailerLat: 43.204234,
        retailerLng: -77.558785
    });
    assert.equal(result.ok, true);
    assert.equal(distanceBand(result.distanceM), "<50 m");
});
