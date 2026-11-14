import assert from "node:assert/strict";
import test from "node:test";
import {
    etInstant,
    etParts,
    DATA_UNAVAILABLE,
    QUICK_DRAW_STALE_AFTER_MS,
    WEEKLY_POSTING_GRACE_MS,
    formatCountdown,
    formatDrawDate,
    formatDrawListing,
    formatScheduledDraw,
    historyStatus,
    officialDrawInstant,
    quickDrawNumberLabel,
    isQuickDrawSlot,
    nextDrawForDisplay,
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

test("Quick Draw skips the 3:25 AM break and resumes at 4:04 AM", () => {
    const last = etInstant(2026, 11, 14, 3, 24, 0);
    const during = etInstant(2026, 11, 14, 3, 28, 0);
    const four = etInstant(2026, 11, 14, 4, 0, 0);
    const resume = etInstant(2026, 11, 14, 4, 4, 0);
    assert.equal(isQuickDrawSlot(last), true);
    assert.equal(isQuickDrawSlot(during), false);
    assert.equal(isQuickDrawSlot(four), false);
    assert.equal(isQuickDrawSlot(resume), true);
    assert.equal(nextQuickDrawSlotAfter(last).toISOString(), resume.toISOString());
    const summerLast = etInstant(2026, 7, 15, 3, 24, 0);
    assert.equal(nextQuickDrawSlotAfter(summerLast).toISOString(), etInstant(2026, 7, 15, 4, 4, 0).toISOString());
});

test("the first draw after 3:24 AM is 4:04, one number later", () => {
    const projection = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 3030755, draw_at: "2026-11-14T08:24:00.000Z" },
        now: at("2026-11-14T09:01:00.000Z")
    });
    assert.equal(projection.nextDrawNumber, 3030756);
    assert.notEqual(projection.nextDrawNumber, 3030757);
    assert.equal(projection.nextDrawTime.toISOString(), etInstant(2026, 11, 14, 4, 4, 0).toISOString());
});

test("a fresh Quick Draw row counts forward from its draw time", () => {
    const newest = { draw_number: 3030357, draw_at: "2026-11-14T03:08:02.746Z", created_at: "2026-11-14T09:16:02.000Z" };
    const previous = { draw_number: 3030356, draw_at: "2026-11-14T03:04:02.400Z", created_at: "2026-11-14T09:16:02.000Z" };
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
        newest: { draw_number: 3030357, draw_at: "2026-11-14T03:08:00.000Z", created_at: "2026-11-14T09:16:02.000Z" },
        previous: { draw_number: 3030356, draw_at: "2026-11-14T03:04:00.000Z", created_at: "2026-11-14T09:16:02.000Z" },
        now: at("2026-11-14T08:52:00.000Z")
    });
    assert.equal(projection.visible, true);
    assert.equal(projection.stale, true);
    assert.equal(projection.reason, "projected");
    assert.equal(quickDrawNumberLabel(projection.reason), "Est. draw #");
    assert.equal(quickDrawNumberLabel("current"), "Next draw #");
    assert.equal(projection.nextDrawNumber, 3030437);
    assert.equal(projection.countdownSeconds, 12 * 60);
    assert.equal(formatCountdown(projection.countdownSeconds), "12:00");
});

test("a Quick Draw row one draw behind still projects across the break", () => {
    const projection = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 50, draw_at: "2026-11-14T08:20:00.000Z" },
        previous: { draw_number: 49, draw_at: "2026-11-14T08:16:00.000Z" },
        now: at("2026-11-14T08:40:00.000Z")
    });
    assert.equal(projection.visible, true);
    assert.equal(projection.stale, true);
    assert.equal(projection.nextDrawNumber, 52);
    assert.equal(projection.countdownSeconds, 24 * 60);
});

test("unusable Quick Draw times hide the number and keep the scheduled countdown", () => {
    const now = at("2026-11-14T08:40:00.000Z");
    const ingestOnly = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 3030407, created_at: "2026-11-14T09:16:02.000Z" },
        now
    });
    assert.equal(ingestOnly.reason, "no-timestamp");
    assert.equal(ingestOnly.showNumber, false);
    assert.equal(officialDrawInstant("quickdraw", ingestOnly && { created_at: "2026-11-14T09:16:02.000Z" }), null);

    const missing = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 50 },
        now
    });
    assert.equal(missing.visible, false);
    assert.equal(missing.showNumber, false);
    assert.equal(missing.nextDrawNumber, null);
    assert.equal(typeof missing.countdownSeconds, "number");
    assert.equal(missing.reason, "no-timestamp");

    const offSchedule = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 50, draw_at: "2026-11-14T03:10:00.000Z", created_at: now.toISOString() },
        now
    });
    assert.equal(offSchedule.visible, false);
    assert.equal(offSchedule.showNumber, false);
    assert.equal(typeof offSchedule.countdownSeconds, "number");
    assert.equal(offSchedule.reason, "off-schedule");

    const contradicts = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 10, draw_at: "2026-11-14T03:08:00.000Z" },
        previous: { draw_number: 9, draw_at: "2026-11-14T03:00:00.000Z" },
        now
    });
    assert.equal(contradicts.visible, false);
    assert.equal(contradicts.reason, "contradicts-previous");

    const future = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 10, draw_at: "2026-11-14T12:00:00.000Z" },
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
    assert.equal(duplicatePowerball.showNumber, false);
    assert.equal(duplicatePowerball.nextDrawNumber, null);
    assert.equal(duplicatePowerball.reason, "schedule-date");
    assert.equal(duplicatePowerball.nextDrawTime.toISOString(), etInstant(2026, 11, 14, 22, 59, 0).toISOString());
});

test("Powerball and Mega Millions use their weekly draw clock", () => {
    const powerball = projectNextDraw({
        game: "powerball",
        newest: { draw_number: 500, draw_date: "2026-11-09" },
        previous: { draw_number: 499, draw_date: "2026-11-07" },
        now: at("2026-11-11T20:00:00.000Z")
    });
    assert.equal(powerball.showNumber, false);
    assert.equal(powerball.nextDrawNumber, null);
    assert.equal(powerball.reason, "schedule-date");
    assert.equal(powerball.nextDrawTime.toISOString(), etInstant(2026, 11, 11, 22, 59, 0).toISOString());

    const afterMissed = projectNextDraw({
        game: "powerball",
        newest: { draw_number: 500, draw_date: "2026-11-09" },
        previous: { draw_number: 499, draw_date: "2026-11-07" },
        now: at("2026-11-12T21:00:00.000Z")
    });
    assert.equal(afterMissed.showNumber, false);
    assert.equal(afterMissed.nextDrawNumber, null);
    assert.equal(afterMissed.nextDrawTime.toISOString(), etInstant(2026, 11, 14, 22, 59, 0).toISOString());

    const mega = projectNextDraw({
        game: "megamillions",
        newest: { draw_number: 100, draw_date: "2026-11-06" },
        previous: { draw_number: 99, draw_date: "2026-11-03" },
        now: at("2026-11-14T08:52:00.000Z")
    });
    assert.equal(mega.showNumber, false);
    assert.equal(mega.nextDrawNumber, null);
    assert.equal(mega.nextDrawTime.toISOString(), etInstant(2026, 11, 17, 23, 0, 0).toISOString());
    assert.equal(/#\d/.test(formatScheduledDraw(mega.nextDrawTime)), false);
});

test("a shared ingest time does not hide Quick Draw numbers that have distinct official times", () => {
    const ingested = "2026-11-14T09:16:02.000Z";
    const bulk = projectNextDraw({
        game: "quickdraw",
        newest: { draw_number: 3030407, created_at: ingested, draw_at: "2026-11-14T03:16:00.000Z" },
        previous: { draw_number: 3030406, created_at: ingested, draw_at: "2026-11-14T03:12:00.000Z" },
        now: at("2026-11-14T03:17:00.000Z")
    });
    assert.notEqual(bulk.reason, "contradicts-previous");
    assert.equal(bulk.showNumber, true);
    assert.equal(bulk.reason, "current");
    assert.equal(bulk.nextDrawNumber, 3030408);

    const withoutInstant = projectNextDraw({
        game: "quickdraw",
        newest: {
            draw_number: 3030407,
            created_at: ingested,
            draw_date: "2026-11-13",
            draw_time: "03:24:00",
            draw_time_source: "27:24"
        },
        previous: {
            draw_number: 3030406,
            created_at: ingested,
            draw_date: "2026-11-13",
            draw_time: "03:20:00",
            draw_time_source: "27:20"
        },
        now: at("2026-11-14T08:30:00.000Z")
    });
    assert.equal(withoutInstant.reason, "no-timestamp");
    assert.equal(withoutInstant.showNumber, false);
    assert.equal(formatDrawListing(withoutInstant && {
        draw_date: "2026-11-13",
        draw_time: "03:24:00",
        draw_time_source: "27:24"
    }), "—");

    const dated = projectNextDraw({
        game: "powerball",
        newest: { draw_number: 20261111, draw_date: "2026-11-11" },
        previous: { draw_number: 20261109, draw_date: "2026-11-09" },
        now: at("2026-11-14T09:14:00.000Z")
    });
    assert.equal(dated.showNumber, false);
    assert.equal(dated.nextDrawNumber, null);
    assert.equal(dated.reason, "schedule-date");
    assert.equal(dated.nextDrawTime.toISOString(), etInstant(2026, 11, 14, 22, 59, 0).toISOString());
    assert.match(formatScheduledDraw(dated.nextDrawTime), /Nov 14, 2026/);
    assert.match(formatScheduledDraw(dated.nextDrawTime), /10:59 PM ET/);
});

test("history is withheld when unverified, unread, or past the update window", () => {
    const now = at("2026-11-14T12:00:00.000Z");
    const fresh = new Date(now.getTime() - (25 * 60 * 60 * 1000)).toISOString();
    assert.equal(historyStatus({
        game: "quickdraw",
        newest: { draw_number: 1, draw_at: fresh, created_at: now.toISOString() },
        now,
        verified: true
    }).available, true);
    assert.equal(historyStatus({
        game: "quickdraw",
        newest: { draw_number: 1, draw_at: new Date(now.getTime() - QUICK_DRAW_STALE_AFTER_MS).toISOString(), created_at: now.toISOString() },
        now,
        verified: true
    }).available, true);
    const quickStale = historyStatus({
        game: "quickdraw",
        newest: { draw_number: 1, draw_at: new Date(now.getTime() - QUICK_DRAW_STALE_AFTER_MS - 1).toISOString(), created_at: now.toISOString() },
        now,
        verified: true
    });
    assert.equal(quickStale.available, false);
    assert.equal(quickStale.reason, "stale");
    assert.equal(historyStatus({
        game: "quickdraw",
        newest: { draw_number: 1, draw_at: fresh, created_at: now.toISOString() },
        now,
        verified: false
    }).reason, "unverified");
    assert.equal(historyStatus({
        game: "quickdraw",
        newest: null,
        now,
        verified: true,
        fetchFailed: true
    }).reason, "fetch-failed");

    const posting = etInstant(2026, 11, 14, 22, 59, 0);
    assert.equal(historyStatus({
        game: "powerball",
        newest: { draw_number: 20261111, draw_date: "2026-11-11" },
        now: new Date(posting.getTime() + WEEKLY_POSTING_GRACE_MS),
        verified: true
    }).available, true);
    const weeklyStale = historyStatus({
        game: "powerball",
        newest: { draw_number: 20261111, draw_date: "2026-11-11" },
        now: new Date(posting.getTime() + WEEKLY_POSTING_GRACE_MS + 1),
        verified: true
    });
    assert.equal(weeklyStale.available, false);
    assert.equal(weeklyStale.reason, "stale");
    assert.equal(historyStatus({
        game: "megamillions",
        newest: { draw_number: 20261113, draw_date: "2026-11-13" },
        now: at("2026-11-14T15:00:00.000Z"),
        verified: true
    }).available, true);
    assert.equal(historyStatus({
        game: "powerball",
        newest: { draw_number: 80, draw_date: "2026-11-10" },
        now,
        verified: true
    }).reason, "off-schedule");
    const ingestFresh = historyStatus({
        game: "quickdraw",
        newest: {
            draw_number: 3030407,
            created_at: now.toISOString(),
            draw_at: new Date(now.getTime() - QUICK_DRAW_STALE_AFTER_MS - 60 * 1000).toISOString()
        },
        now,
        verified: true
    });
    assert.equal(ingestFresh.available, false);
    assert.equal(ingestFresh.reason, "stale");
    assert.equal(DATA_UNAVAILABLE, "Data unavailable");
});

test("a listed draw uses the published draw day, and a missing instant is a dash", () => {
    assert.equal(formatDrawListing({
        draw_date: "2026-11-13",
        draw_time: "03:24:00",
        draw_time_source: "27:24",
        draw_at: "2026-11-14T08:24:00.000Z"
    }), "Nov 13 draw day (3:24 AM Nov 14 ET)");
    assert.equal(formatDrawListing({
        draw_date: "2026-11-13",
        draw_time: "22:08:00",
        draw_at: "2026-11-14T03:08:00.000Z"
    }), "Nov 13, 2026");
    assert.equal(formatDrawListing({
        draw_date: "2026-11-13",
        draw_time: "03:24:00",
        draw_time_source: "27:24",
        created_at: "2026-11-14T09:16:02.000Z"
    }), "—");
    assert.equal(officialDrawInstant("quickdraw", {
        draw_date: "2026-11-13",
        draw_time: "03:24:00",
        created_at: "2026-11-14T09:16:02.000Z"
    }), null);
});

test("unavailable history hides a projected next-draw number", () => {
    const now = at("2026-11-14T09:01:00.000Z");
    const newest = { draw_number: 3030755, draw_at: "2026-11-14T08:24:00.000Z" };
    const projection = projectNextDraw({ game: "quickdraw", newest, now });
    assert.equal(projection.nextDrawNumber, 3030756);
    const cases = [
        historyStatus({ game: "quickdraw", newest, now, verified: false }),
        historyStatus({ game: "quickdraw", newest, now, verified: true, fetchFailed: true }),
        historyStatus({
            game: "quickdraw",
            newest: { draw_number: 1, draw_at: new Date(now.getTime() - QUICK_DRAW_STALE_AFTER_MS - 1).toISOString() },
            now,
            verified: true
        })
    ];
    assert.deepEqual(cases.map((status) => status.reason), ["unverified", "fetch-failed", "stale"]);
    cases.forEach((history) => {
        const shown = nextDrawForDisplay(projection, history);
        assert.equal(history.available, false);
        assert.equal(shown.showNumber, false);
        assert.equal(shown.nextDrawNumber, null);
        assert.equal(typeof shown.countdownSeconds, "number");
    });
    const fresh = historyStatus({ game: "quickdraw", newest, now, verified: true });
    assert.equal(fresh.available, true);
    assert.equal(nextDrawForDisplay(projection, fresh).nextDrawNumber, 3030756);
});

test("countdown and date labels stay readable", () => {
    assert.equal(formatCountdown(90), "1:30");
    assert.equal(formatCountdown(3600 + 125), "1:02:05");
    assert.equal(formatCountdown(2 * 86400 + 3661), "2d 01:01:01");
    assert.equal(formatDrawDate("2026-11-09"), "November 9, 2026");
    assert.equal(formatDrawDate("2026-11-09T00:00:00Z"), null);
});
