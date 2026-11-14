import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    classifyDob,
    readAgePass,
    writeAgePass
} from "../js/age.js";

const today = new Date(2026, 10, 14);

function memory() {
    const data = new Map();
    return {
        getItem(key) { return data.has(key) ? data.get(key) : null; },
        setItem(key, value) { data.set(key, String(value)); },
        removeItem(key) { data.delete(key); }
    };
}

test("Scratch Buddy classifies 18, 13, and under 13 without storing the date", () => {
    assert.equal(classifyDob({ year: 2008, month: 11, day: 14 }, today).outcome, "pass");
    assert.equal(classifyDob({ year: 2008, month: 11, day: 15 }, today).outcome, "under18");
    assert.equal(classifyDob({ year: 2013, month: 11, day: 15 }, today).outcome, "under13");
    assert.equal(classifyDob({ year: 2013, month: 11, day: 15 }, today).persist, false);
    const store = memory();
    const record = writeAgePass(store, Date.parse("2026-11-14T00:00:00Z"));
    assert.equal(record.flag, "18plus");
    assert.equal(JSON.stringify(record).includes("2008"), false);
    assert.ok(readAgePass(store, Date.parse("2026-11-14T00:00:00Z")));
    store.setItem("scratch_buddy_age_gate", JSON.stringify({ flag: "18plus", expiresAt: record.expiresAt, dob: "2000-01-01" }));
    assert.equal(readAgePass(store, Date.parse("2026-11-14T00:00:00Z")), null);
});

test("Scratch Buddy keeps the age gate and leaves pricing out", () => {
    const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    assert.match(page, /id="age-gate"/);
    assert.match(page, /id="app-shell" inert/);
    assert.match(page, /scratch_buddy_age_gate/);
    assert.equal(page.includes("$1.99"), false);
    assert.equal(page.includes("Subscribe"), false);
});
