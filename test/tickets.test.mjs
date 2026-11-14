import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gradeTickets, resolveQuickDrawStart, ticketPending } from "../js/grading.js";
import { megaMillionsEra, rowFitsEra } from "../js/eras.js";
import {
    MAX_CONSECUTIVE,
    checkPastDraws,
    parseEtLocal,
    planQuickDrawSlip,
    planWeeklySlip,
    validateOwnNumbers
} from "../js/tickets.js";

const BLOCK = 4 * 60 * 1000;

// 3030750 at 2026-11-14T17:00:00Z (12:00 PM ET), then every 4 minutes.
function qdRows(first, count, startMs = Date.parse("2026-11-14T17:00:00Z")) {
    const rows = [];
    for (let i = 0; i < count; i++) {
        rows.push({
            draw_number: first + i,
            draw_at: new Date(startMs + i * BLOCK).toISOString(),
            winning_numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((n) => n + (i % 3))
        });
    }
    return rows.reverse();
}

test("a time-anchored Quick Draw slip resolves its start from stored draw times and grades", () => {
    const anchorAt = "2026-11-14T17:08:00.000Z"; // third row
    const tickets = [{ draw: null, endDraw: null, anchorAt, games: 3, spot: 2, game: "quickdraw", numbers: [3, 21], hits: "Pending" }];
    const partial = qdRows(3030750, 4);
    assert.equal(gradeTickets(tickets, partial), true);
    assert.equal(tickets[0].draw, 3030752);
    assert.equal(tickets[0].endDraw, 3030754);
    assert.equal(tickets[0].resolvedBy, "time");
    assert.equal(tickets[0].hits, "2 of 3 draws checked · Best 2/2");
    assert.equal(ticketPending(tickets[0]), true);
    gradeTickets(tickets, qdRows(3030750, 6));
    assert.equal(tickets[0].hits, "Done · 3 of 3 draws checked · Best 2/2");
    assert.equal(ticketPending(tickets[0]), false);
    assert.equal(tickets[0].payout, 0);
});

test("a time anchor stays Pending when the loaded rows cannot prove the first draw", () => {
    const rows = qdRows(3030760, 5, Date.parse("2026-11-14T18:00:00Z"));
    // Anchor 12:30 PM ET is before every loaded row and matches none exactly.
    assert.equal(resolveQuickDrawStart(Date.parse("2026-11-14T17:30:00Z"), rows), null);
    // Draws missing between the row before and the first row after: not proven.
    const gap = qdRows(3030750, 2).concat(qdRows(3030760, 2, Date.parse("2026-11-14T17:40:00Z")));
    assert.equal(resolveQuickDrawStart(Date.parse("2026-11-14T17:20:00Z"), gap), null);
    // An exact time match is enough.
    assert.equal(resolveQuickDrawStart(Date.parse("2026-11-14T18:08:00Z"), rows), 3030762);
    const tickets = [{ draw: null, anchorAt: "2026-11-14T17:30:00Z", games: 2, spot: 1, game: "quickdraw", numbers: [5], hits: "Pending" }];
    assert.equal(gradeTickets(tickets, rows), false);
    assert.equal(tickets[0].hits, "Pending");
});

test("rows without draw_at never resolve or grade a Quick Draw slip", () => {
    const rows = qdRows(3030750, 4).map(({ draw_at, ...rest }) => rest);
    const tickets = [{ draw: null, anchorAt: "2026-11-14T17:00:00Z", games: 1, spot: 1, game: "quickdraw", numbers: [1], hits: "Pending" }];
    assert.equal(gradeTickets(tickets, rows), false);
    assert.equal(tickets[0].draw, null);
});

test("an older slip saved without a draw number uses its save time as the anchor", () => {
    const tickets = [{ draw: null, endDraw: null, timestamp: "2026-11-14T17:05:10Z", games: 1, spot: 1, game: "quickdraw", numbers: [2] }];
    gradeTickets(tickets, qdRows(3030750, 4));
    assert.equal(tickets[0].draw, 3030752);
});

test("Powerball and Mega Millions slips grade by draw date with white matches plus the bonus", () => {
    const pb = [{ game: "powerball", games: 2, numbers: [8, 42, 45, 1, 2], bonus: 17, drawDates: ["2026-11-11", "2026-11-14"], hits: "Pending" }];
    const pbRows = [
        { draw_number: 20261111, draw_date: "2026-11-11", winning_numbers: [8, 42, 45, 51, 57], bonus_number: 17 },
        { draw_number: 20261109, draw_date: "2026-11-09", winning_numbers: [8, 1, 2, 3, 4], bonus_number: 17 }
    ];
    assert.equal(gradeTickets(pb, pbRows, "powerball"), true);
    assert.equal(pb[0].hits, "1 of 2 draws checked · Best 3 + PB");
    assert.deepEqual(pb[0].gradedDates, ["2026-11-11"]);
    assert.equal(ticketPending(pb[0]), true);
    // Quick Draw rows never grade a Powerball slip.
    assert.equal(gradeTickets(pb, qdRows(1, 3)), false);

    const mm = [{ game: "megamillions", games: 1, numbers: [10, 22, 1, 2, 3], bonus: 5, drawDates: ["2026-11-13"], hits: "Pending" }];
    gradeTickets(mm, [{ draw_number: 20261113, draw_date: "2026-11-13", winning_numbers: [10, 22, 33, 49, 57], bonus_number: 18 }], "megamillions");
    assert.equal(mm[0].hits, "Done · Matched 2");
    assert.equal(ticketPending(mm[0]), false);
    assert.equal(mm[0].payout, 0);
});

test("own numbers are validated for count, range, duplicates, and the bonus ball", () => {
    assert.deepEqual(validateOwnNumbers("quickdraw", "41, 5 12"), { ok: true, numbers: [5, 12, 41], bonus: null });
    assert.equal(validateOwnNumbers("quickdraw", "").ok, false);
    assert.match(validateOwnNumbers("quickdraw", "1 2 3 4 5 6 7 8 9 10 11").error, /1 to 10 numbers/);
    assert.match(validateOwnNumbers("quickdraw", "0 5").error, /from 1 to 80/);
    assert.match(validateOwnNumbers("quickdraw", "81").error, /from 1 to 80/);
    assert.match(validateOwnNumbers("quickdraw", "5 5").error, /entered twice/);
    assert.match(validateOwnNumbers("quickdraw", "5 x").error, /not a whole number/);
    assert.match(validateOwnNumbers("quickdraw", "5.5").error, /not a whole number/);
    assert.deepEqual(validateOwnNumbers("powerball", "69 1 2 3 4", "26"), { ok: true, numbers: [1, 2, 3, 4, 69], bonus: 26 });
    assert.match(validateOwnNumbers("powerball", "1 2 3 4", "5").error, /exactly 5/);
    assert.match(validateOwnNumbers("powerball", "1 2 3 4 70", "5").error, /from 1 to 69/);
    assert.match(validateOwnNumbers("powerball", "1 2 3 4 5", "").error, /one Powerball/);
    assert.match(validateOwnNumbers("powerball", "1 2 3 4 5", "27").error, /Powerball must be from 1 to 26/);
    assert.equal(validateOwnNumbers("megamillions", "1 2 3 4 70", "24").ok, true);
    assert.match(validateOwnNumbers("megamillions", "1 2 3 4 5", "25").error, /Mega Ball must be from 1 to 24/);
});

test("the past-draws check counts real matches only and reports the best and N-or-more counts", () => {
    const rows = [
        { draw_number: 3, winning_numbers: [1, 2, 3, 9] },
        { draw_number: 2, winning_numbers: [1, 9] },
        { draw_number: 1, winning_numbers: [7, 8] }
    ];
    const report = checkPastDraws({ game: "quickdraw", numbers: [1, 2, 3], draws: rows, lookback: 50 });
    assert.equal(report.checked, 3);
    assert.deepEqual(report.perDraw.map((d) => d.hits), [3, 1, 0]);
    assert.equal(report.best.drawNumber, 3);
    assert.equal(report.best.label, "3/3");
    assert.deepEqual(report.atLeast, [{ n: 1, draws: 2 }, { n: 2, draws: 1 }, { n: 3, draws: 1 }]);
    assert.equal(checkPastDraws({ game: "quickdraw", numbers: [1], draws: rows, lookback: 2 }).checked, 2);
    assert.deepEqual(checkPastDraws({ game: "quickdraw", numbers: [1], draws: [], lookback: 20 }), { ok: false, reason: "unavailable" });

    const pb = checkPastDraws({
        game: "powerball",
        numbers: [8, 42, 1, 2, 3],
        bonus: 17,
        draws: [
            { draw_number: 20261111, draw_date: "2026-11-11", winning_numbers: [8, 42, 45, 51, 57], bonus_number: 17 },
            { draw_number: 20261109, draw_date: "2026-11-09", winning_numbers: [8, 42, 1, 50, 60], bonus_number: 3 }
        ],
        lookback: 100
    });
    assert.equal(pb.best.label, "3");
    assert.equal(pb.perDraw[0].label, "2 + PB");
    assert.equal(pb.bonusDraws, 1);
    assert.equal(JSON.stringify(pb).includes("payout"), false);
});

test("Quick Draw slips can start at a later draw or a set ET time on the 4-minute schedule", () => {
    const now = new Date("2026-11-14T18:01:30Z"); // 1:01:30 PM ET
    const next = planQuickDrawSlip({ now, games: 1 });
    assert.equal(next.first.toISOString(), "2026-11-14T18:04:00.000Z");
    const later = planQuickDrawSlip({ now, games: 3, start: { mode: "offset", offset: 3 } });
    assert.equal(later.first.toISOString(), "2026-11-14T18:12:00.000Z");
    assert.equal(later.last.toISOString(), "2026-11-14T18:20:00.000Z");
    assert.equal(later.offsetFromNext, 2);
    const evening = planQuickDrawSlip({ now, games: 10, start: { mode: "time", at: "2026-11-14T19:00" } });
    assert.equal(evening.first.toISOString(), "2026-11-15T00:00:00.000Z");
    assert.equal(evening.last.toISOString(), "2026-11-15T00:36:00.000Z");
    assert.equal(evening.slots.length, 10);
    const offGrid = planQuickDrawSlip({ now, games: 1, start: { mode: "time", at: "2026-11-14T19:01" } });
    assert.equal(offGrid.first.toISOString(), "2026-11-15T00:04:00.000Z");
    // A block across the 3:25-4:04 AM ET break skips the break.
    const overnight = planQuickDrawSlip({ now, games: 2, start: { mode: "time", at: "2026-11-15T03:24" } });
    assert.equal(overnight.slots[1].toISOString(), "2026-11-15T09:04:00.000Z");
    assert.equal(planQuickDrawSlip({ now, start: { mode: "time", at: "2026-11-14T12:00" } }).ok, false);
    assert.equal(planQuickDrawSlip({ now, start: { mode: "time", at: "2026-11-30T12:00" } }).ok, false);
    assert.equal(planQuickDrawSlip({ now, start: { mode: "offset", offset: 0 } }).ok, false);
    assert.equal(parseEtLocal("2026-11-14T19:00").toISOString(), "2026-11-15T00:00:00.000Z");
});

test("weekly slips start at a chosen upcoming draw date", () => {
    const now = new Date("2026-11-14T18:00:00Z"); // Saturday
    const pb = planWeeklySlip({ game: "powerball", games: 3, now });
    assert.deepEqual(pb.drawDates, ["2026-11-14", "2026-11-16", "2026-11-18"]);
    const later = planWeeklySlip({ game: "powerball", games: 2, startDate: "2026-11-18", now });
    assert.deepEqual(later.drawDates, ["2026-11-18", "2026-11-21"]);
    assert.equal(planWeeklySlip({ game: "powerball", games: 1, startDate: "2026-11-15", now }).ok, false);
    const mm = planWeeklySlip({ game: "megamillions", games: 2, now });
    assert.deepEqual(mm.drawDates, ["2026-11-17", "2026-11-20"]);
});

test("new copy tracks upcoming draws without prediction words, prizes, or a buy button", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
    const tickets = readFileSync(new URL("../js/tickets.js", import.meta.url), "utf8");
    const own = html.slice(html.indexOf('id="own-numbers-section"'), html.indexOf('aria-labelledby="heatmap-title"'));
    assert.match(own, /Check my own numbers/);
    assert.match(own, />Track for upcoming draws</);
    assert.match(own, />Check against past draws</);
    assert.match(own, /Past results don't predict future draws/);
    assert.equal(html.includes("Play this slip"), false);
    assert.equal(html.includes("retailer"), false);
    assert.match(html, /Draw Buddy doesn't sell lottery tickets or accept wagers\. Not affiliated with any lottery\./);
    assert.match(own, /Check official NY Lottery results before claiming anything\./);
    assert.match(html, /id="start-mode"/);
    const ownNoDisclaimer = own.replace(/Past results don't predict future draws/g, "").replace(/Call the NY HOPEline/g, "");
    assert.equal(/predict|\bcall/i.test(ownNoDisclaimer), false);
    assert.equal(/\b(buy|checkout|jackpot|prize amount)\b/i.test(own), false);
    assert.equal(/predict/i.test(tickets), false);
    assert.equal(/fetch\(|localStorage/.test(tickets), false);
    assert.match(app, /Not tracked \(no draw saved\)/);
});

test("Mega Millions rows are checked against the range of their own era", () => {
    assert.equal(megaMillionsEra("2013-10-18"), null);
    assert.equal(megaMillionsEra("2013-10-22").bonusMax, 15);
    assert.equal(megaMillionsEra("2017-10-31").bonusMax, 25);
    assert.equal(megaMillionsEra("2025-04-04").bonusMax, 25);
    assert.equal(megaMillionsEra("2025-04-08").bonusMax, 24);
    assert.equal(rowFitsEra("megamillions", { draw_date: "2024-01-02", winning_numbers: [1, 2, 3, 4, 70], bonus_number: 25 }), true);
    assert.equal(rowFitsEra("megamillions", { draw_date: "2025-11-14", winning_numbers: [1, 2, 3, 4, 70], bonus_number: 25 }), false);
    assert.equal(rowFitsEra("megamillions", { draw_date: "2015-01-02", winning_numbers: [1, 2, 3, 4, 75], bonus_number: 15 }), true);
    assert.equal(rowFitsEra("megamillions", { draw_date: "2015-01-02", winning_numbers: [1, 2, 3, 4, 75], bonus_number: 16 }), false);
    // Before the first confirmed era nothing is range-checked.
    assert.equal(rowFitsEra("megamillions", { draw_date: "2004-01-02", winning_numbers: [1, 2, 3, 4, 52], bonus_number: 52 }), true);
    const bad = { draw_number: 2, draw_date: "2026-11-13", winning_numbers: [1, 2, 3, 4, 5], bonus_number: 25 };
    const good = { draw_number: 1, draw_date: "2026-11-10", winning_numbers: [1, 2, 3, 4, 5], bonus_number: 24 };
    const report = checkPastDraws({ game: "megamillions", numbers: [1, 2, 3, 4, 5], bonus: 24, draws: [bad, good], lookback: 100 });
    assert.equal(report.checked, 1);
    assert.equal(report.best.label, "5 + MB");
    const slip = [{ game: "megamillions", games: 1, numbers: [1, 2, 3, 4, 5], bonus: 24, drawDates: ["2026-11-13"], hits: "Pending" }];
    gradeTickets(slip, [bad], "megamillions");
    assert.equal(slip[0].hits, "Pending");
});

test("consecutive draws are capped at the lower of the official NY limit and 20", () => {
    assert.deepEqual(MAX_CONSECUTIVE, { quickdraw: 20, powerball: 20, megamillions: 20 });
    const now = new Date("2026-11-14T18:00:00Z");
    assert.equal(planQuickDrawSlip({ now, games: 20 }).ok, true);
    assert.match(planQuickDrawSlip({ now, games: 21 }).error, /1 to 20/);
    assert.equal(planWeeklySlip({ game: "powerball", games: 21, now }).ok, false);
    assert.equal(planWeeklySlip({ game: "megamillions", games: 20, now }).ok, true);
});

// New UI text only. The existing D1 disclaimer is removed before the scan.
const BANNED = /\b(win|wins|winning|winner|winners|won|lucky|luck|due|hot|cold|streak|streaks|predict\w*|guarantee\w*|jackpot|sure thing)\b/i;
const D1 = /Lottery drawings are random\. Past results don't predict future draws, and Draw Buddy does not improve your chances of winning\. For entertainment and information only\.|Past results don't predict future draws\./g;

function htmlText(fragment) {
    return fragment.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function literals(source) {
    const out = [];
    const re = /"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
    let match;
    while ((match = re.exec(source))) out.push((match[1] ?? match[2] ?? "").replace(/\$\{[^}]*\}/g, " "));
    return out.join(" | ");
}

function between(text, start, end) {
    const a = text.indexOf(start);
    const b = text.indexOf(end, a);
    assert.ok(a >= 0 && b > a, `${start} .. ${end}`);
    return text.slice(a, b);
}

test("new UI strings contain no banned words", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
    const parts = [
        htmlText(between(html, 'id="start-at-box"', 'id="picks-button"')),
        htmlText(between(html, 'id="slip-plan"', 'id="ticket-import-box"')),
        htmlText(between(html, 'id="own-numbers-section"', 'aria-labelledby="heatmap-title"')),
        htmlText(between(html, 'id="quickdraw-ledger-section"', "</section>")),
        literals(readFileSync(new URL("../js/tickets.js", import.meta.url), "utf8")),
        literals(readFileSync(new URL("../js/grading.js", import.meta.url), "utf8")),
        literals(between(app, "// Start at + Consecutive games", "function updateLedgerUI")),
        literals(between(app, "function ticketPicksLabel", "function loadHistoryArchive"))
    ];
    parts.forEach((text, idx) => {
        const scrubbed = text.replace(D1, " ");
        const hit = scrubbed.match(BANNED);
        assert.equal(hit, null, `part ${idx}: "${hit && hit[0]}"`);
    });
});

test("every slip and results view shows the 18+ HOPEline line and the past-results line", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
    const hope = /18\+ only\. Gambling problem\? Call the NY HOPEline at 1-877-8-HOPENY \(1-877-846-7369\) or text HOPENY \(467369\)\./;
    [
        between(html, 'id="slip-plan"', 'id="save-slip-button"'),
        between(html, 'id="own-plan"', 'id="own-track-button"'),
        between(html, 'id="own-results"', 'Results come only'),
        between(html, 'id="quickdraw-ledger-section"', "</section>"),
        between(html, 'id="cost-label"', 'id="picks-button"')
    ].forEach((view) => assert.match(view, hope));
    assert.match(between(html, 'id="own-results"', 'Results come only'), /Past results don't predict future draws\./);
    assert.match(between(html, 'id="quickdraw-ledger-section"', "</section>"), /Past results don't predict future draws\./);
    assert.match(app, /You logged spending \$/);
    assert.equal(/logged cost|Logged cost/.test(html + app), false);
    assert.equal(/\b(net|profit|ROI|P\/L)\b/.test(htmlText(between(html, 'id="own-numbers-section"', 'aria-labelledby="heatmap-title"'))), false);
    assert.equal(/Try again|Track again|Play again/i.test(html + app), false);
    // Saving a slip does not roll new picks on its own.
    assert.equal(between(app, "function saveTicketLocally", "function readOwnNumbers").includes("generateTicket()"), false);
});
