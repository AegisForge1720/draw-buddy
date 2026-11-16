import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FEATURE_FLAG_DEFAULTS, FEATURE_FLAG_ITEMS, PREVIEW_FLAG_NOGO_LABEL, isFeatureOn, readFeatureFlags, writeFeatureFlag } from "../js/feature-flags.js";
import {
    NO_DATA,
    OFFICIAL_FIELD_LABELS,
    agentKey,
    colorForAmount,
    filterAndSortRetailers,
    formatOfficialAmount,
    hasSalesIn30Days,
    latestRangeLabel,
    metricValue,
    officialSalesCaveat,
    quantileBreaks,
    salesForRetailer,
    sellsScratchOffs
} from "../js/official-sales.js";
import { filterPrizeGames, formatOfficialCount, groupPrizeStatus } from "../js/prizes-remaining.js";
import { aggregateLogHeat, heatWeight, logHeatStyle } from "../js/log-heat.js";

const SALES = JSON.parse(readFileSync(new URL("../data/retailer-sales.json", import.meta.url), "utf8"));
const PRIZES = JSON.parse(readFileSync(new URL("../data/prizes-remaining.json", import.meta.url), "utf8"));

test("preview-only, Ralph no-go flags default to OFF in the config and can be switched on", () => {
    assert.equal(PREVIEW_FLAG_NOGO_LABEL, "preview-only, Ralph no-go");
    for (const key of Object.keys(FEATURE_FLAG_DEFAULTS)) {
        assert.equal(FEATURE_FLAG_DEFAULTS[key], false, key);
    }
    const defaults = readFeatureFlags({ getItem() { return null; } });
    assert.equal(isFeatureOn("officialStoreSales", defaults), false);
    assert.equal(isFeatureOn("officialSalesHeatMap", defaults), false);
    assert.equal(isFeatureOn("userLogHeatLayer", defaults), false);
    assert.equal(isFeatureOn("storeSalesSortFilter", defaults), false);
    assert.equal(isFeatureOn("prizesRemainingTable", defaults), false);
    const memory = { data: null, getItem() { return this.data; }, setItem(_k, v) { this.data = v; } };
    writeFeatureFlag("officialSalesHeatMap", true, memory);
    const on = readFeatureFlags(memory);
    assert.equal(on.officialSalesHeatMap, true);
    assert.equal(on.officialStoreSales, false);
    assert.equal(FEATURE_FLAG_ITEMS.length, 5);
    for (const item of FEATURE_FLAG_ITEMS) {
        assert.equal(Object.prototype.hasOwnProperty.call(FEATURE_FLAG_DEFAULTS, item.id), true);
    }
    const src = readFileSync(new URL("../js/feature-flags.js", import.meta.url), "utf8");
    assert.match(src, /preview-only, Ralph no-go/);
    assert.equal(src.includes("officialStoreSales: true"), false);
});

test("agent numbers join after leading zeros are stripped", () => {
    assert.equal(agentKey("055003"), "55003");
    assert.equal(agentKey("55003"), "55003");
    assert.equal(agentKey(55003), "55003");
    assert.equal(agentKey("0000"), "0");
    const store = salesForRetailer(SALES, "055003");
    assert.ok(store);
    assert.equal(store.latest.ig_paid, 5709);
    assert.equal(store.latest.draw_paid, 660);
    assert.equal(store.latest.ig_settles, 1000);
    assert.equal(store.latest.bus_day, "2026-11-14");
});

test("official field labels are the state's exact names, and missing rows are no data", () => {
    assert.equal(OFFICIAL_FIELD_LABELS.draw_paid, "Daily DRAW PAID Sales");
    assert.equal(OFFICIAL_FIELD_LABELS.ig_paid, "Daily IG PAID Sales");
    assert.equal(OFFICIAL_FIELD_LABELS.ig_settles, "Daily IG SETTLES Sales");
    assert.equal(formatOfficialAmount(5709), "$5,709.00");
    assert.equal(formatOfficialAmount(null), NO_DATA);
    assert.equal(formatOfficialAmount(undefined), NO_DATA);
    // Retailer 109262 (7-Eleven #35104A) has no latest-day row.
    const missingLatest = salesForRetailer(SALES, "109262");
    assert.equal(metricValue(missingLatest, "ig_paid", "latest"), null);
    assert.equal(formatOfficialAmount(metricValue(missingLatest, "ig_paid", "latest")), NO_DATA);
    assert.equal(latestRangeLabel(SALES, "2026-11-15"), "Yesterday (November 14, 2026)");
    assert.match(officialSalesCaveat(SALES), /unaudited NY Open Data/i);
    assert.match(officialSalesCaveat(SALES), /Under-\$600 cash-outs only show where tickets were cashed/);
});

test("Sells scratch-offs and hide-no-sales use 30-day official amounts", () => {
    const wegmans = salesForRetailer(SALES, "055003");
    const applebees = salesForRetailer(SALES, "073690");
    assert.equal(sellsScratchOffs(wegmans), true);
    assert.equal(hasSalesIn30Days(wegmans), true);
    assert.equal(sellsScratchOffs(applebees), false);
    assert.equal(hasSalesIn30Days(applebees), true);
    const none = { days30: { draw_paid: 0, ig_paid: 0, ig_settles: 0 } };
    assert.equal(hasSalesIn30Days(none), false);
    assert.equal(hasSalesIn30Days(null), false);

    const rows = [
        { id: "055003", name: "WEGMANS #19" },
        { id: "073690", name: "APPLEBEE'S #08" },
        { id: "999999999", name: "Not in the cache" }
    ];
    const scratchOnly = filterAndSortRetailers(rows, SALES, { sellsScratchOffsOnly: true });
    assert.deepEqual(scratchOnly.rows.map((row) => row.id), ["055003"]);
    const hidden = filterAndSortRetailers(rows, SALES, { hideNoSales: true });
    assert.deepEqual(hidden.rows.map((row) => row.id), ["055003", "073690"]);
    const sorted = filterAndSortRetailers(rows, SALES, { sortMetric: "ig_paid", sortRange: "latest", sortDir: "desc" });
    assert.equal(sorted.rows[0].id, "055003");
    assert.equal(sorted.rows[2].id, "999999999");
});

test("the official sales cache has a retrieved-at time and no invented store keys", () => {
    assert.equal(SALES.datasetId, "xyvi-fbb9");
    assert.match(SALES.retrievedAt, /^2026-11-15T/);
    assert.equal(SALES.latestBusinessDay, "2026-11-14");
    assert.equal(SALES.officialFields.ig_paid, "Daily IG PAID Sales");
    assert.ok(SALES.storeCount > 0);
    assert.equal(Object.keys(SALES.stores).length, SALES.storeCount);
});

test("the prizes-remaining cache groups official statewide counts and shows no data when a count is missing", () => {
    assert.equal(PRIZES.datasetId, "nzqa-7unk");
    assert.equal(PRIZES.rowCount, PRIZES.rows.length);
    const games = groupPrizeStatus(PRIZES.rows);
    const bonus = games.find((game) => game.game_number === "1688");
    assert.equal(bonus.game_name, "$3,000,000 BONUS STARS");
    const ten = bonus.tiers.find((tier) => tier.prize_amount === "$10");
    assert.equal(ten.paid, 1035416);
    assert.equal(ten.unpaid, 904476);
    assert.equal(ten.total, 1939892);
    assert.equal(formatOfficialCount(null), NO_DATA);
    assert.equal(filterPrizeGames(games, "bonus stars").length, 1);
    assert.equal(filterPrizeGames(games, "no such game").length, 0);
    const incomplete = groupPrizeStatus([
        { game_number: "1", game_name: "Example", prize_amount: "$5", paid: null, unpaid: 2, total: 3 }
    ]);
    assert.equal(formatOfficialCount(incomplete[0].tiers[0].paid), NO_DATA);
});

test("the user-log heat layer weights verification and does not invent official totals", () => {
    assert.equal(heatWeight(["unverified"]), 1);
    assert.equal(heatWeight(["location-confirmed"]), 2);
    assert.equal(heatWeight(["location-confirmed", "photo-attached"]), 3);
    const groups = aggregateLogHeat([
        {
            retailerId: "1",
            retailerName: "Test store",
            retailerLat: 43.1,
            retailerLng: -77.6,
            verification: ["location-confirmed"],
            game: "A",
            prizeAmount: 20
        },
        {
            retailerId: "1",
            retailerName: "Test store",
            retailerLat: 43.1,
            retailerLng: -77.6,
            verification: ["photo-attached"],
            game: "B",
            prizeAmount: 10
        }
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].weight, 4);
    assert.equal(groups[0].entries.length, 2);
    const style = logHeatStyle(groups[0]);
    assert.equal(style.color, "#facc15");
    assert.ok(style.radius > 10);
});
