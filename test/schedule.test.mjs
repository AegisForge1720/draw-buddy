import assert from "node:assert/strict";
import test from "node:test";
import {
    etInstant,
    etParts,
    formatCountdown,
    formatDrawDate,
    isQuickDrawSlot,
    nextQuickDrawSlotAfter,
    projectNextDraw
} from "../js/schedule.js";

function at(iso) {
    return new Date(iso);
}

test("Eastern Time conversion follows standard and daylight offsets", () => {
    assert.equal(etInstant(2026, 1, 15, 4, 0, 0).toISOString(), "2026-01-15T09:00:00.000Z");
    assert.equal(etInstant(2026, 7, 15, 4, 0, 0).toISOString(), "2026-07-15T08:00:00.000Z");
    assert.equal(etParts(etInstant(2026, 11, 9, 22, 59)).weekday, "Mon");
    assert.equal(etParts(etInstant(2026, 11, 11, 22, 59)).weekday, "Wed");
    assert.equal(etParts(etInstant(2026, 11, 14, 22, 59)).weekday, "Sat");
    assert.equal(etParts(etInstant(2026, 11, 3, 23, 0)).weekday, "Tue");
    assert.equal(etParts(etInstant(2026, 11, 6, 23, 0)).weekday, "Fri");
});

test("Quick Draw skips the 3:25 AM break and resumes at 4:00 AM", () => {
    const last = etInstant(2026, 11, 14, 3, 24, 0);
    const during = etInstant(2026, 11, 14, 3, 28, 0);
    const resume = etInstant(2026, 11, 14, 4, 0, 0);
    assert.equal(isQuickDrawSlot(last), true);
    assert.equal(isQuickDrawSlot(during), false);
    assert.equal(isQuickDrawSlot(resume), true);
    assert.equal(nextQuickDrawSlotAfter(last).toISOString(), resume.toISOString());
    const summerLast = etInstant(2026, 7, 15, 3, 24, 0);
    assert.equal(nextQuickDrawSlotAfter(summerLast).toISOString(), etInstant(2026, 7, 15, 4, 0, 0).toISOString());
});

test("a fresh Quick Draw row counts forward from its draw time", () => {
    const newest = { draw_number: 3030357, created_at: "2026-11-14T03:08:02.746Z" };
    const previous = { draw_number: 3030356, created_at: "2026-11-14T03:04:02.400Z" };
    const soon = projectNextDraw({
        game: "quickdraw",
        newest,
        previous,
        now: at("2026-11-14T03:09:30.000Z")
    });
    assert.equal(soon.visible, true);
    assert.equal(soon.stale, false);
    assert.equal(soon.nextDrawNumber, 3030358);
    assert.equal(soon.countdownSeconds, 150);

    const onTheDraw = projectNextDraw({
        game: "quickdraw",
        newest,
        previous,
        now: at("2026-11-14T03:12:00.000Z")
    });
    assert.equal(onTheDraw.nextDrawNumber, 3030359);
    assert.equal(onTheDraw.countdownSeconds, 240);
});

test("Quick Draw elapsed time includes the overnight break", () => {
    const projection = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 3030357, created_at: "2026-11-14T03:08:00.000Z" },
        previous: { draw_number: 3030356, created_at: "2026-11-14T03:04:00.000Z" },
        now: at("2026-11-14T08:52:00.000Z")
    });
    assert.equal(projection.visible, true);
    assert.equal(projection.stale, true);
    assert.equal(projection.reason, "projected");
    assert.equal(projection.nextDrawNumber, 3030437);
    assert.equal(projection.countdownSeconds, 8 * 60);
    assert.equal(formatCountdown(projection.countdownSeconds), "8:00");
});

test("a Quick Draw row one draw behind still projects across the break", () => {
    const projection = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 50, created_at: "2026-11-14T08:20:00.000Z" },
        previous: { draw_number: 49, created_at: "2026-11-14T08:16:00.000Z" },
        now: at("2026-11-14T08:40:00.000Z")
    });
    assert.equal(projection.visible, true);
    assert.equal(projection.stale, true);
    assert.equal(projection.nextDrawNumber, 52);
    assert.equal(projection.countdownSeconds, 20 * 60);
});

test("stale or unusable draw times hide the next-draw number and countdown", () => {
    const now = at("2026-11-14T08:40:00.000Z");
    const missing = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 50 },
        now
    });
    assert.equal(missing.visible, false);
    assert.equal(missing.nextDrawNumber, null);
    assert.equal(missing.countdownSeconds, null);
    assert.equal(missing.reason, "no-timestamp");

    const offSchedule = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 50, created_at: "2026-11-14T03:10:00.000Z" },
        now
    });
    assert.equal(offSchedule.visible, false);
    assert.equal(offSchedule.reason, "off-schedule");

    const contradicts = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 10, created_at: "2026-11-14T03:08:00.000Z" },
        previous: { draw_number: 9, created_at: "2026-11-14T03:00:00.000Z" },
        now
    });
    assert.equal(contradicts.visible, false);
    assert.equal(contradicts.reason, "contradicts-previous");

    const future = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 10, created_at: "2026-11-14T12:00:00.000Z" },
        now
    });
    assert.equal(future.visible, false);
    assert.equal(future.reason, "future");

    const duplicatePowerball = projectNextDraw({
        game: "powerball",
        newest: { draw_number: 2026000, draw_date: "2026-11-09" },
        previous: { draw_number: 2025999, draw_date: "2026-11-09" },
        now
    });
    assert.equal(duplicatePowerball.visible, false);
    assert.equal(duplicatePowerball.reason, "contradicts-previous");

    const wrongDay = projectNextDraw({
        game: "powerball",
        newest: { draw_number: 80, draw_date: "2026-11-10" },
        now
    });
    assert.equal(wrongDay.visible, false);
    assert.equal(wrongDay.reason, "off-schedule");
});

test("Powerball and Mega Millions use their weekly draw clock", () => {
    const powerball = projectNextDraw({
        game: "powerball",
        newest: { draw_number: 500, draw_date: "2026-11-09" },
        previous: { draw_number: 499, draw_date: "2026-11-07" },
        now: at("2026-11-11T20:00:00.000Z")
    });
    assert.equal(powerball.visible, true);
    assert.equal(powerball.stale, false);
    assert.equal(powerball.nextDrawNumber, 501);
    assert.equal(powerball.nextDrawTime.toISOString(), etInstant(2026, 11, 11, 22, 59, 0).toISOString());

    const afterMissed = projectNextDraw({
        game: "powerball",
        newest: { draw_number: 500, draw_date: "2026-11-09" },
        previous: { draw_number: 499, draw_date: "2026-11-07" },
        now: at("2026-11-12T21:00:00.000Z")
    });
    assert.equal(afterMissed.visible, true);
    assert.equal(afterMissed.stale, true);
    assert.equal(afterMissed.nextDrawNumber, 502);
    assert.equal(afterMissed.nextDrawTime.toISOString(), etInstant(2026, 11, 14, 22, 59, 0).toISOString());

    const mega = projectNextDraw({
        game: "megamillions",
        newest: { draw_number: 100, draw_date: "2026-11-06" },
        previous: { draw_number: 99, draw_date: "2026-11-03" },
        now: at("2026-11-14T08:52:00.000Z")
    });
    assert.equal(mega.visible, true);
    assert.equal(mega.stale, true);
    assert.equal(mega.nextDrawNumber, 103);
    assert.equal(mega.nextDrawTime.toISOString(), etInstant(2026, 11, 17, 23, 0, 0).toISOString());
});

test("a shared Quick Draw timestamp or a date-encoded id is not a reliable draw count", () => {
    const bulk = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 3026442, created_at: "2026-11-14T09:12:01.967Z" },
        previous: { draw_number: 3026441, created_at: "2026-11-14T09:12:01.967Z" },
        now: at("2026-11-14T09:14:00.000Z")
    });
    assert.equal(bulk.visible, false);
    assert.equal(bulk.reason, "contradicts-previous");
    assert.equal(bulk.nextDrawNumber, null);
    assert.equal(bulk.countdownSeconds, null);

    const dated = projectNextDraw({
        game: "powerball",
        newest: { draw_number: 20261111, draw_date: "2026-11-11" },
        previous: { draw_number: 20261109, draw_date: "2026-11-09" },
        now: at("2026-11-14T09:14:00.000Z")
    });
    assert.equal(dated.visible, false);
    assert.equal(dated.reason, "contradicts-previous");
});

test("countdown and date labels stay readable", () => {
    assert.equal(formatCountdown(90), "1:30");
    assert.equal(formatCountdown(3600 + 125), "1:02:05");
    assert.equal(formatCountdown(2 * 86400 + 3661), "2d 01:01:01");
    assert.equal(formatDrawDate("2026-11-09"), "November 9, 2026");
    assert.equal(formatDrawDate("2026-11-09T00:00:00Z"), null);
});
