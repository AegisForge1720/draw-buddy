import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
    PICK_NUMBER_LINE,
    SUBSCRIPTION_DETAIL_NOTE,
    expectedRepeatText,
    inspectorIdle,
    numberWindowStats,
    settleHistoryFetch,
    stakePerPlay
} from "../js/inspector.js";
import { oneStepRepeatRate } from "../js/odds.js";
import { QUICK_DRAW_STALE_AFTER_MS } from "../js/schedule.js";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

function functionBody(source, name) {
    const start = source.indexOf(`function ${name}`);
    assert.notEqual(start, -1, name);
    const open = source.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
        if (source[i] === "{") depth += 1;
        else if (source[i] === "}") {
            depth -= 1;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error(`unclosed ${name}`);
}

function draw(numbers, drawAt) {
    return { draw_number: 1, winning_numbers: numbers, draw_at: drawAt };
}

test("a loaded history with no selected number is a prompt, not a failure", () => {
    const open = inspectorIdle({ historyAvailable: true, subscribed: true });
    assert.equal(open.title, PICK_NUMBER_LINE);
    assert.equal(open.value, "--");
    assert.equal(open.value.includes("Data unavailable"), false);
    const locked = inspectorIdle({ historyAvailable: true, subscribed: false });
    assert.equal(locked.title.startsWith(PICK_NUMBER_LINE), true);
    assert.equal(locked.title.includes(SUBSCRIPTION_DETAIL_NOTE), true);
    assert.equal(locked.value, "--");
    const failed = inspectorIdle({ historyAvailable: false, subscribed: true });
    assert.equal(failed.title, "Data unavailable");
    assert.equal(failed.value, "Data unavailable");
    assert.match(functionBody(app, "renderHeatmap"), /syncInspector\(\)/);
    assert.match(functionBody(app, "syncInspector"), /inspectorIdle/);
});

test("a new lookback recomputes every inspector stat for that window", () => {
    const rows = [
        draw([1, 2], "2026-11-14T12:00:00.000Z"),
        draw([3, 4], "2026-11-14T11:56:00.000Z"),
        draw([7, 5], "2026-11-14T11:52:00.000Z"),
        draw([7, 6], "2026-11-14T11:48:00.000Z"),
        draw([8, 9], "2026-11-14T11:44:00.000Z")
    ];
    const pool = { drawnCount: 20, totalNumbers: 80 };
    const narrowDraws = rows.slice(0, 2);
    const narrow = numberWindowStats(narrowDraws, 7, pool);
    const wide = numberWindowStats(rows, 7, pool);
    assert.equal(narrow.hitCount, 0);
    assert.equal(wide.hitCount, 2);
    assert.equal(oneStepRepeatRate(narrowDraws, 7), null);
    assert.equal(oneStepRepeatRate(rows, 7), 0.5);
    ["hits", "percentage", "lastSeen", "interval", "density", "title"].forEach((field) => {
        assert.notEqual(narrow[field], wide[field], field);
    });
    assert.match(functionBody(app, "paintInspector"), /numberWindowStats\(lookbackSlice\(\)\.draws/);
    assert.match(app, /lookback-draws"\)\.addEventListener\("change", \(\) => \{\s*renderHeatmap\(\);/);
});

test("the expected repeat rate has one writer", () => {
    assert.equal(expectedRepeatText(20, 80), "25% (20 of 80)");
    assert.equal(expectedRepeatText(5, 69), "7.25% (5 of 69)");
    const writes = app.match(/setText\("stat-expected"/g) || [];
    assert.equal(writes.length, 1);
    assert.match(functionBody(app, "publishExpectedRepeat"), /setText\("stat-expected"/);
    assert.equal(functionBody(app, "renderDrawSchedule").includes("stat-expected"), false);
    assert.equal(functionBody(app, "renderRepeatRate").includes("stat-expected"), false);
    assert.equal(functionBody(app, "setHistoryStatsUnavailable").includes("stat-expected"), false);
    const ids = functionBody(app, "setHistoryStatsUnavailable").length;
    assert.ok(ids > 0);
    assert.equal(/"stat-expected"/.test(app.slice(app.indexOf("const HISTORY_STAT_IDS"), app.indexOf("];", app.indexOf("const HISTORY_STAT_IDS")))), false);
});

test("a failed refresh keeps the last rows and lets the staleness rule decide", () => {
    const now = new Date("2026-11-14T12:00:00.000Z");
    const fresh = [draw([1], new Date(now.getTime() - 60 * 60 * 1000).toISOString())];
    const kept = settleHistoryFetch({
        previous: fresh,
        failed: true,
        game: "quickdraw",
        now,
        verified: true
    });
    assert.equal(kept.keptPrevious, true);
    assert.equal(kept.cachedDraws, fresh);
    assert.equal(kept.fetchFailed, false);
    assert.equal(kept.available, true);
    assert.equal(kept.reason, "fresh");
    const staleRow = [draw([1], new Date(now.getTime() - QUICK_DRAW_STALE_AFTER_MS - 1000).toISOString())];
    const stale = settleHistoryFetch({
        previous: staleRow,
        failed: true,
        game: "quickdraw",
        now,
        verified: true
    });
    assert.equal(stale.cachedDraws, staleRow);
    assert.equal(stale.available, false);
    assert.equal(stale.reason, "stale");
    const firstMiss = settleHistoryFetch({ previous: [], failed: true, game: "quickdraw", now, verified: true });
    assert.deepEqual(firstMiss.cachedDraws, []);
    assert.equal(firstMiss.fetchFailed, true);
    assert.equal(firstMiss.reason, "fetch-failed");
    const fetchBody = functionBody(app, "fetchGameHistoryFromSupabase");
    assert.equal(fetchBody.includes("state.cachedDraws = []"), false);
    assert.match(fetchBody, /settleHistoryFetch/);
    assert.match(fetchBody, /keepVisible \? previous : \[\]/);
});

test("Power Play adds a dollar and Extra doubles, and both start at No", () => {
    assert.equal(stakePerPlay("quickdraw", 1, true), 2);
    assert.equal(stakePerPlay("quickdraw", 1, false), 1);
    assert.equal(stakePerPlay("powerball", 2, true), 3);
    assert.notEqual(stakePerPlay("powerball", 2, true), 4);
    assert.equal(stakePerPlay("powerball", 2, false), 2);
    assert.equal(stakePerPlay("megamillions", 5, true), 5);
    assert.match(html, /id="extra-multiplier"[\s\S]*?<option value="1" selected>No<\/option><option value="2">Yes<\/option>/);
    assert.equal(html.includes('value="2" selected'), false);
    const switchBody = functionBody(app, "switchGameProfile");
    assert.equal((switchBody.match(/resetAddOn\(\)/g) || []).length, 1);
    assert.match(functionBody(app, "resetAddOn"), /extra\.value = "1"/);
    assert.match(functionBody(app, "getGameCost"), /stakePerPlay/);
});
