import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
    PREMIUM_COMING_SOON,
    REFRESH_KEPT_NOTE,
    refreshKeptNote,
    settleHistoryFetch
} from "../js/inspector.js";
import { QUICK_DRAW_STALE_AFTER_MS } from "../js/schedule.js";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

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

test("paid plans read as coming soon and the buttons stay disabled", () => {
    ["checkout-monthly", "checkout-annual"].forEach((id) => {
        const button = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>[^<]*</button>`));
        assert.ok(button, id);
        assert.match(button[0], /disabled/);
        assert.match(button[0], />Coming soon</);
    });
    assert.equal(html.includes("Subscribe monthly"), false);
    assert.equal(html.includes("Subscribe annually"), false);
    assert.equal(html.includes("See plans"), false);
    assert.equal(html.includes("unlocks with Monthly or Annual"), false);
    assert.equal(html.includes("in the subscription"), false);
    assert.equal(html.includes("Checkout is not available until"), false);
    assert.equal(html.includes(PREMIUM_COMING_SOON), true);
    assert.equal(functionBody(app, "syncSubscribeButtons").includes("button.disabled = true"), true);
    assert.equal(functionBody(app, "syncSubscribeButtons").includes("!agreed"), false);
    assert.equal(app.includes("Check the agreement box before subscribe"), false);
    assert.equal(html.includes("id=\"paywall-disclosure-text\""), true);
});

test("a failed refresh that keeps fresh rows shows a note and a success clears it", () => {
    const now = new Date("2026-11-14T12:00:00.000Z");
    const fresh = [{ draw_number: 1, winning_numbers: [1], draw_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString() }];
    const kept = settleHistoryFetch({
        previous: fresh,
        failed: true,
        game: "quickdraw",
        now,
        verified: true
    });
    assert.equal(refreshKeptNote(kept), REFRESH_KEPT_NOTE);
    const replaced = settleHistoryFetch({
        previous: fresh,
        rows: fresh,
        failed: false,
        game: "quickdraw",
        now,
        verified: true
    });
    assert.equal(refreshKeptNote(replaced), "");
    const stale = settleHistoryFetch({
        previous: [{ draw_number: 1, winning_numbers: [1], draw_at: new Date(now.getTime() - QUICK_DRAW_STALE_AFTER_MS - 1000).toISOString() }],
        failed: true,
        game: "quickdraw",
        now,
        verified: true
    });
    assert.equal(stale.available, false);
    assert.equal(refreshKeptNote(stale), "");
    const firstMiss = settleHistoryFetch({ previous: [], failed: true, game: "quickdraw", now, verified: true });
    assert.equal(refreshKeptNote(firstMiss), "");
    assert.match(html, /id="results-updated"[\s\S]{0,180}id="results-refresh-note"/);
    assert.match(html, /id="picks-last-updated"[\s\S]{0,180}id="picks-refresh-note"/);
    assert.match(app, /setRefreshNote\(refreshKeptNote\(settled\)\)/);
});
