// Next-draw projection from the official schedule and the newest stored row.
// Quick Draw: every 4 minutes, with no draws from 3:25 AM until 4:00 AM ET.
// Powerball: Monday, Wednesday, and Saturday at 10:59 PM ET.
// Mega Millions: Tuesday and Friday at 11:00 PM ET.
// A number is shown only when the row time sits on that schedule. Otherwise the
// draw number and countdown stay hidden.

const ET = "America/New_York";
const BLOCK_MS = 4 * 60 * 1000;
const SNAP_TOLERANCE_MS = 30 * 1000;
const BREAK_START_MINUTES = 3 * 60 + 25;
const BREAK_END_MINUTES = 4 * 60;

export const WEEKLY_DRAW_SCHEDULE = {
    powerball: { weekdays: ["Mon", "Wed", "Sat"], hour: 22, minute: 59 },
    megamillions: { weekdays: ["Tue", "Fri"], hour: 23, minute: 0 }
};

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

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

function countWeeklySlots(game, after, through) {
    let count = 0;
    let cursor = nextWeeklyDrawAfter(game, after);
    const end = through.getTime();
    while (cursor && cursor.getTime() <= end) {
        count += 1;
        const next = nextWeeklyDrawAfter(game, cursor);
        if (!next || next.getTime() <= cursor.getTime()) return null;
        cursor = next;
        if (count > 5000) return null;
    }
    return count;
}

function drawNumberOf(row) {
    const number = Number(row && row.draw_number);
    if (!Number.isInteger(number)) return null;
    return number;
}

function anchorFromRow(game, row) {
    const drawNumber = drawNumberOf(row);
    if (drawNumber === null) return null;
    if (game === "quickdraw") {
        const stamp = parseInstant(row.created_at);
        if (!stamp) return null;
        const snapped = snapQuickDraw(stamp);
        if (!snapped) return null;
        return { drawNumber, time: snapped };
    }
    const date = parseDateOnly(row.draw_date);
    if (!date) return null;
    const instant = weeklyDrawInstant(game, date.year, date.month, date.day);
    if (!instant) return null;
    return { drawNumber, time: instant };
}

function rowHasTime(game, row) {
    if (!row) return false;
    if (game === "quickdraw") return parseInstant(row.created_at) !== null;
    return parseDateOnly(row.draw_date) !== null;
}

function hidden(reason, stale = true) {
    return {
        visible: false,
        stale,
        reason,
        nextDrawNumber: null,
        countdownSeconds: null,
        nextDrawTime: null
    };
}

export function projectNextDraw({ game, newest, previous = null, now = new Date() }) {
    if (!WEEKLY_DRAW_SCHEDULE[game] && game !== "quickdraw") return hidden("off-schedule");
    if (!rowHasTime(game, newest)) return hidden("no-timestamp");
    const anchor = anchorFromRow(game, newest);
    if (!anchor) return hidden("off-schedule");
    if (anchor.time.getTime() > now.getTime() + SNAP_TOLERANCE_MS) return hidden("future", false);

    if (previous) {
        const prevAnchor = anchorFromRow(game, previous);
        const delta = anchor.drawNumber - Number(previous.draw_number);
        if (!prevAnchor || !Number.isInteger(delta) || delta <= 0) return hidden("contradicts-previous");
        const between = game === "quickdraw"
            ? countQuickDrawSlots(prevAnchor.time, anchor.time)
            : countWeeklySlots(game, prevAnchor.time, anchor.time);
        if (between !== delta) return hidden("contradicts-previous");
    }

    const nextTime = game === "quickdraw" ? nextQuickDrawSlotAfter(now) : nextWeeklyDrawAfter(game, now);
    const latest = game === "quickdraw" ? latestQuickDrawSlot(now) : latestWeeklyDraw(game, now);
    if (!nextTime || !latest) return hidden("off-schedule");
    const steps = game === "quickdraw"
        ? countQuickDrawSlots(anchor.time, nextTime)
        : countWeeklySlots(game, anchor.time, nextTime);
    if (steps === null || steps < 1) return hidden("off-schedule");
    const stale = anchor.time.getTime() < latest.getTime();
    return {
        visible: true,
        stale,
        reason: stale ? "projected" : "current",
        nextDrawNumber: anchor.drawNumber + steps,
        countdownSeconds: Math.ceil((nextTime.getTime() - now.getTime()) / 1000),
        nextDrawTime: nextTime
    };
}
