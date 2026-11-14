// Next-draw projection from the official schedule and the newest stored row.
// Quick Draw: every 4 minutes, with no draws from 3:25 AM until 4:04 AM ET.
// Powerball: Monday, Wednesday, and Saturday at 10:59 PM ET.
// Mega Millions: Tuesday and Friday at 11:00 PM ET.
//
// Quick Draw draw numbers use draw_at only. created_at is ingest time.
// draw_date is the NY Lottery draw day (after-midnight draws belong to the
// previous day), so draw_date plus draw_time is not a safe instant. A missing
// draw_at is no time: the number and Last updated stay a dash, and the
// countdown remains. If the newest official time is behind the latest
// scheduled slot, the label is "Est. draw #". A listed draw uses
// draw_date. When that day differs from the ET calendar date of draw_at, the
// label adds the real time, as in "Nov 13 draw day (3:24 AM Nov 14 ET)".
// Powerball and Mega Millions never use draw_number as a display id. Their
// next draw is the next scheduled date and time.
//
// History is withheld ("Data unavailable") when a game is not verified, the
// fetch fails, or the newest row is past its update window:
// - Quick Draw posts once a day around 3:35 AM ET, so a row is normally up to
//   about 25 hours old. Older than 49 hours is stale.
// - Powerball and Mega Millions are stale more than 24 hours after the
//   scheduled time of the draw that follows the newest stored draw. That
//   scheduled time is the expected posting.

const ET = "America/New_York";
const BLOCK_MS = 4 * 60 * 1000;
const SNAP_TOLERANCE_MS = 30 * 1000;
const BREAK_START_MINUTES = 3 * 60 + 25;
const BREAK_END_MINUTES = 4 * 60 + 4;

export const DATA_UNAVAILABLE = "Data unavailable";
export const QUICK_DRAW_STALE_AFTER_MS = 49 * 60 * 60 * 1000;
export const WEEKLY_POSTING_GRACE_MS = 24 * 60 * 60 * 1000;

export const WEEKLY_DRAW_SCHEDULE = {
    powerball: { weekdays: ["Mon", "Wed", "Sat"], hour: 22, minute: 59 },
    megamillions: { weekdays: ["Tue", "Fri"], hour: 23, minute: 0 }
};

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function etParts(date) {
    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: ET,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "short",
        hourCycle: "h23"
    });
    const parts = {};
    fmt.formatToParts(date).forEach((part) => {
        if (part.type !== "literal") parts[part.type] = part.value;
    });
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
        weekday: parts.weekday
    };
}

export function etInstant(year, month, day, hour, minute, second = 0) {
    const desired = Date.UTC(year, month - 1, day, hour, minute, second);
    let guess = desired;
    for (let i = 0; i < 4; i++) {
        const parts = etParts(new Date(guess));
        const got = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
        const delta = desired - got;
        if (delta === 0) return new Date(guess);
        guess += delta;
    }
    return new Date(guess);
}

function parseInstant(value) {
    if (typeof value !== "string" || value.length === 0) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function parseDateOnly(value) {
    if (typeof value !== "string") return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, month, day };
}

export function formatDrawDate(value) {
    const parsed = parseDateOnly(value);
    if (!parsed) return null;
    return `${MONTHS[parsed.month - 1]} ${parsed.day}, ${parsed.year}`;
}

function shortMonthDay(month, day) {
    return `${SHORT_MONTHS[month - 1]} ${day}`;
}

function isoDateKey(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Date label for a stored draw. Quick Draw without draw_at is "—".
// A normal draw is just its draw day. An after-midnight draw, whose draw day
// is the previous calendar day, includes the real ET clock time.
export function formatDrawListing(row, game = "quickdraw") {
    if (!row) return "—";
    const drawDay = parseDateOnly(row.draw_date);
    if (game !== "quickdraw") {
        if (!drawDay) return "—";
        return `${shortMonthDay(drawDay.month, drawDay.day)}, ${drawDay.year}`;
    }
    const instant = parseInstant(row.draw_at);
    if (!instant || !drawDay) return "—";
    const parts = etParts(instant);
    if (isoDateKey(parts.year, parts.month, parts.day) === row.draw_date) {
        return `${shortMonthDay(drawDay.month, drawDay.day)}, ${drawDay.year}`;
    }
    const clock = new Intl.DateTimeFormat("en-US", {
        timeZone: ET,
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }).format(instant);
    return `${shortMonthDay(drawDay.month, drawDay.day)} draw day (${clock} ${shortMonthDay(parts.month, parts.day)} ET)`;
}

export function formatScheduledDraw(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const formatted = new Intl.DateTimeFormat("en-US", {
        timeZone: ET,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }).format(date);
    return `${formatted} ET`;
}

export function formatCountdown(seconds) {
    if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
    const total = Math.max(0, Math.floor(seconds));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const pad = (value) => String(value).padStart(2, "0");
    if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    if (hours > 0) return `${hours}:${pad(minutes)}:${pad(secs)}`;
    return `${minutes}:${pad(secs)}`;
}

function wallMinutes(date) {
    const parts = etParts(date);
    return parts.hour * 60 + parts.minute;
}

export function isQuickDrawSlot(date) {
    const parts = etParts(date);
    if (parts.second !== 0 || parts.minute % 4 !== 0) return false;
    const minutes = wallMinutes(date);
    if (minutes >= BREAK_START_MINUTES && minutes < BREAK_END_MINUTES) return false;
    return true;
}

export function snapQuickDraw(date, toleranceMs = SNAP_TOLERANCE_MS) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const prev = Math.floor(date.getTime() / BLOCK_MS) * BLOCK_MS;
    let best = null;
    let bestDist = Infinity;
    for (let ms = prev - 12 * BLOCK_MS; ms <= prev + 12 * BLOCK_MS; ms += BLOCK_MS) {
        const slot = new Date(ms);
        if (!isQuickDrawSlot(slot)) continue;
        const dist = Math.abs(ms - date.getTime());
        if (dist < bestDist) {
            best = slot;
            bestDist = dist;
        }
    }
    if (!best || bestDist > toleranceMs) return null;
    return best;
}

export function nextQuickDrawSlotAfter(date) {
    let cursor = Math.floor(date.getTime() / BLOCK_MS) * BLOCK_MS + BLOCK_MS;
    if (cursor <= date.getTime()) cursor += BLOCK_MS;
    for (let i = 0; i < 16; i++) {
        const slot = new Date(cursor);
        if (isQuickDrawSlot(slot)) return slot;
        cursor += BLOCK_MS;
    }
    return new Date(cursor);
}

export function latestQuickDrawSlot(date) {
    const next = nextQuickDrawSlotAfter(date);
    let cursor = next.getTime() - BLOCK_MS;
    for (let i = 0; i < 16; i++) {
        const slot = new Date(cursor);
        if (isQuickDrawSlot(slot) && slot.getTime() <= date.getTime()) return slot;
        cursor -= BLOCK_MS;
    }
    return null;
}

function shiftEtDay(parts, days) {
    const noon = etInstant(parts.year, parts.month, parts.day, 12, 0, 0);
    return etParts(new Date(noon.getTime() + days * 86400000));
}

export function weeklyDrawInstant(game, year, month, day) {
    const spec = WEEKLY_DRAW_SCHEDULE[game];
    if (!spec) return null;
    const instant = etInstant(year, month, day, spec.hour, spec.minute, 0);
    const parts = etParts(instant);
    if (parts.year !== year || parts.month !== month || parts.day !== day) return null;
    if (parts.hour !== spec.hour || parts.minute !== spec.minute) return null;
    if (!spec.weekdays.includes(parts.weekday)) return null;
    return instant;
}

export function nextWeeklyDrawAfter(game, date) {
    const start = etParts(date);
    for (let i = 0; i <= 10; i++) {
        const day = shiftEtDay(start, i);
        const instant = weeklyDrawInstant(game, day.year, day.month, day.day);
        if (instant && instant.getTime() > date.getTime()) return instant;
    }
    return null;
}

export function upcomingWeeklyDraws(game, now, count) {
    const draws = [];
    let cursor = now;
    const total = Math.max(0, Number(count) || 0);
    for (let i = 0; i < total; i++) {
        const next = nextWeeklyDrawAfter(game, cursor);
        if (!next) break;
        draws.push(next);
        cursor = next;
    }
    return draws;
}

export function latestWeeklyDraw(game, date) {
    const start = etParts(date);
    for (let i = 0; i <= 10; i++) {
        const day = shiftEtDay(start, -i);
        const instant = weeklyDrawInstant(game, day.year, day.month, day.day);
        if (instant && instant.getTime() <= date.getTime()) return instant;
    }
    return null;
}

function countQuickDrawSlots(after, through) {
    let count = 0;
    let cursor = nextQuickDrawSlotAfter(after);
    const end = through.getTime();
    while (cursor && cursor.getTime() <= end) {
        count += 1;
        const next = nextQuickDrawSlotAfter(cursor);
        if (!next || next.getTime() <= cursor.getTime()) return null;
        cursor = next;
        if (count > 200000) return null;
    }
    return count;
}

function drawNumberOf(row) {
    const number = Number(row && row.draw_number);
    if (!Number.isInteger(number)) return null;
    return number;
}

// Quick Draw timing is draw_at only. draw_date is the published draw day, not
// the calendar date of an after-midnight draw, so it is not combined with
// draw_time. created_at is ingest time and is never read here.
export function officialDrawInstant(game, row) {
    if (!row) return null;
    if (game === "quickdraw") return parseInstant(row.draw_at);
    const date = parseDateOnly(row.draw_date);
    if (!date) return null;
    return weeklyDrawInstant(game, date.year, date.month, date.day);
}

// A computed next-draw number is shown only while history is available.
// Stale, unverified, and failed fetches keep the countdown and blank the number.
export function nextDrawForDisplay(projection, history) {
    if (history && history.available === true) return projection;
    return {
        ...projection,
        visible: false,
        showNumber: false,
        nextDrawNumber: null
    };
}

export function quickDrawNumberLabel(reason) {
    return reason === "projected" ? "Est. draw #" : "Next draw #";
}

function anchorFromRow(game, row) {
    const drawNumber = drawNumberOf(row);
    if (drawNumber === null) return null;
    if (game === "quickdraw") {
        const stamp = officialDrawInstant(game, row);
        if (!stamp) return null;
        const snapped = snapQuickDraw(stamp);
        if (!snapped) return null;
        return { drawNumber, time: snapped };
    }
    const instant = officialDrawInstant(game, row);
    if (!instant) return null;
    return { drawNumber, time: instant };
}

function rowHasTime(game, row) {
    return officialDrawInstant(game, row) !== null;
}

function clockFields(game, now) {
    const nextDrawTime = game === "quickdraw"
        ? nextQuickDrawSlotAfter(now)
        : nextWeeklyDrawAfter(game, now);
    return {
        nextDrawTime,
        countdownSeconds: nextDrawTime
            ? Math.ceil((nextDrawTime.getTime() - now.getTime()) / 1000)
            : null
    };
}

function projection(game, now, extra) {
    return {
        visible: false,
        showNumber: false,
        stale: true,
        reason: "countdown-only",
        nextDrawNumber: null,
        ...clockFields(game, now),
        ...extra
    };
}

function newestInstant(game, row) {
    return officialDrawInstant(game, row);
}

// verified: DATA_VERIFIED[game]. fetchFailed: the read threw, returned an error,
// or came back empty. A weekly date that is not a draw day cannot be placed in
// the posting window, so those rows are unavailable too.
export function historyStatus({ game, newest = null, now = new Date(), verified = true, fetchFailed = false }) {
    if (verified !== true) return { available: false, reason: "unverified" };
    if (fetchFailed || !newest) return { available: false, reason: "fetch-failed" };
    const rowTime = newestInstant(game, newest);
    if (!rowTime) return { available: false, reason: game === "quickdraw" ? "no-timestamp" : "off-schedule" };
    if (game === "quickdraw") {
        const age = now.getTime() - rowTime.getTime();
        if (age > QUICK_DRAW_STALE_AFTER_MS) return { available: false, reason: "stale" };
        return { available: true, reason: "fresh" };
    }
    if (!WEEKLY_DRAW_SCHEDULE[game]) return { available: false, reason: "off-schedule" };
    const nextPosting = nextWeeklyDrawAfter(game, rowTime);
    if (!nextPosting) return { available: false, reason: "off-schedule" };
    if (now.getTime() > nextPosting.getTime() + WEEKLY_POSTING_GRACE_MS) {
        return { available: false, reason: "stale" };
    }
    return { available: true, reason: "fresh" };
}

export function projectNextDraw({ game, newest, previous = null, now = new Date() }) {
    if (!WEEKLY_DRAW_SCHEDULE[game] && game !== "quickdraw") {
        return projection(game, now, { reason: "off-schedule", countdownSeconds: null, nextDrawTime: null });
    }
    if (WEEKLY_DRAW_SCHEDULE[game]) {
        return projection(game, now, { stale: false, reason: "schedule-date" });
    }

    if (!rowHasTime(game, newest)) return projection(game, now, { reason: "no-timestamp" });
    const anchor = anchorFromRow(game, newest);
    if (!anchor) return projection(game, now, { reason: "off-schedule" });
    if (anchor.time.getTime() > now.getTime() + SNAP_TOLERANCE_MS) {
        return projection(game, now, { reason: "future", stale: false });
    }

    if (previous) {
        const prevAnchor = anchorFromRow(game, previous);
        const delta = anchor.drawNumber - Number(previous.draw_number);
        if (!prevAnchor || !Number.isInteger(delta) || delta <= 0) {
            return projection(game, now, { reason: "contradicts-previous" });
        }
        const between = countQuickDrawSlots(prevAnchor.time, anchor.time);
        if (between !== delta) return projection(game, now, { reason: "contradicts-previous" });
    }

    const clock = clockFields(game, now);
    const latest = latestQuickDrawSlot(now);
    if (!clock.nextDrawTime || !latest) return projection(game, now, { reason: "off-schedule" });
    const steps = countQuickDrawSlots(anchor.time, clock.nextDrawTime);
    if (steps === null || steps < 1) return projection(game, now, { reason: "off-schedule" });
    const stale = anchor.time.getTime() < latest.getTime();
    return projection(game, now, {
        visible: true,
        showNumber: true,
        stale,
        reason: stale ? "projected" : "current",
        nextDrawNumber: anchor.drawNumber + steps
    });
}
