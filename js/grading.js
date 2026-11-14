// Counts how many saved numbers matched loaded draws. Does not assign a dollar return.
//
// Quick Draw slips are tracked by draw number. A slip saved while the next
// draw number was not verified is anchored by time instead (anchorAt, the
// first scheduled draw the slip covers). Its start number is resolved from
// loaded rows only: the first stored draw whose draw_at is at or after
// anchorAt, proven by a loaded row just before it or an exact time match.
// Once resolved, draw and endDraw are stored and resolvedBy is "time".
//
// Powerball and Mega Millions slips are tracked by draw date (drawDates, ET
// YYYY-MM-DD). Each date is graded when a stored row with that draw_date is
// loaded: white-ball matches plus whether the bonus ball matched.
//
// Nothing here estimates or fills in a result. A draw that is not loaded stays
// unchecked, and the slip stays Pending.

const ANCHOR_TOLERANCE_MS = 30 * 1000;

export const BONUS_SHORT = { powerball: "PB", megamillions: "MB" };

function drawAtMs(row) {
    if (!row || typeof row.draw_at !== "string" || row.draw_at.length === 0) return null;
    const ms = new Date(row.draw_at).getTime();
    return Number.isNaN(ms) ? null : ms;
}

function drawNumberOf(row) {
    const n = Number(row && row.draw_number);
    return Number.isInteger(n) ? n : null;
}

export function ticketAnchorMs(ticket) {
    const value = ticket && (ticket.anchorAt || (ticket.draw == null && ticket.timestamp));
    if (typeof value !== "string") return null;
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
}

// Returns the first Quick Draw number at or after the anchor, or null when
// the loaded rows cannot prove which draw that is.
export function resolveQuickDrawStart(anchorMs, draws) {
    if (!Number.isFinite(anchorMs) || !Array.isArray(draws)) return null;
    const threshold = anchorMs - ANCHOR_TOLERANCE_MS;
    let before = null;
    let firstAfter = null;
    draws.forEach((row) => {
        const ms = drawAtMs(row);
        const number = drawNumberOf(row);
        if (ms === null || number === null) return;
        if (ms < threshold) {
            if (!before || number > before.number) before = { number, ms };
        } else if (!firstAfter || ms < firstAfter.ms || (ms === firstAfter.ms && number < firstAfter.number)) {
            firstAfter = { number, ms };
        }
    });
    if (!firstAfter) return null;
    if (before && firstAfter.number === before.number + 1) return firstAfter.number;
    if (Math.abs(firstAfter.ms - anchorMs) <= ANCHOR_TOLERANCE_MS) return firstAfter.number;
    return null;
}

export function weeklyHitLabel(game, white, bonus) {
    const short = BONUS_SHORT[game] || "bonus";
    return bonus ? `${white} + ${short}` : `${white}`;
}

function betterWeekly(a, b) {
    if (!a) return true;
    if (b.white !== a.white) return b.white > a.white;
    return b.bonus && !a.bonus;
}

export function progressLabel(checked, total, bestText) {
    if (checked === 0) return "Pending";
    if (checked < total) return `${checked} of ${total} draws checked · Best ${bestText}`;
    return total > 1
        ? `Done · ${total} of ${total} draws checked · Best ${bestText}`
        : `Done · Matched ${bestText}`;
}

function gradeQuickDraw(ticket, drawMap, draws) {
    let updated = false;
    const numGames = parseInt(ticket.games || 1, 10);
    if (!Number.isFinite(Number(ticket.draw)) || ticket.draw === null) {
        const anchor = ticketAnchorMs(ticket);
        const start = resolveQuickDrawStart(anchor, draws);
        if (start === null) return false;
        ticket.draw = start;
        ticket.endDraw = start + numGames - 1;
        ticket.resolvedBy = "time";
        updated = true;
    }
    const startDraw = parseInt(ticket.draw, 10);
    const endDraw = parseInt(ticket.endDraw || (startDraw + numGames - 1), 10);
    if (!Array.isArray(ticket.gradedDraws)) ticket.gradedDraws = [];
    if (typeof ticket.bestHits !== "number") ticket.bestHits = 0;
    const played = (ticket.numbers || []).map(Number);
    if (played.length === 0 || Number.isNaN(startDraw)) return updated;

    for (let drawNumber = startDraw; drawNumber <= endDraw; drawNumber++) {
        if (ticket.gradedDraws.includes(drawNumber) || !drawMap.has(drawNumber)) continue;
        const winning = (drawMap.get(drawNumber).winning_numbers || []).map(Number);
        const hitCount = played.filter((number) => winning.includes(number)).length;
        ticket.payout = 0;
        if (hitCount > ticket.bestHits) ticket.bestHits = hitCount;
        ticket.gradedDraws.push(drawNumber);
        updated = true;
    }
    const spot = ticket.spot || played.length;
    const label = progressLabel(ticket.gradedDraws.length, numGames, `${ticket.bestHits}/${spot}`);
    if (ticket.hits !== label) {
        ticket.hits = label;
        updated = true;
    }
    return updated;
}

function gradeWeekly(ticket, draws) {
    const dates = Array.isArray(ticket.drawDates) ? ticket.drawDates : [];
    if (dates.length === 0) {
        const note = "Not tracked (no draw dates saved)";
        if (ticket.hits !== note) {
            ticket.hits = note;
            return true;
        }
        return false;
    }
    const byDate = new Map();
    draws.forEach((row) => {
        if (row && typeof row.draw_date === "string") byDate.set(row.draw_date, row);
    });
    if (!Array.isArray(ticket.gradedDates)) ticket.gradedDates = [];
    if (!Array.isArray(ticket.drawResults)) ticket.drawResults = [];
    const played = (ticket.numbers || []).map(Number);
    const bonus = ticket.bonus == null ? null : Number(ticket.bonus);
    let updated = false;
    dates.forEach((date) => {
        if (ticket.gradedDates.includes(date) || !byDate.has(date)) return;
        const row = byDate.get(date);
        const winning = (row.winning_numbers || []).map(Number);
        const white = played.filter((n) => winning.includes(n)).length;
        const bonusHit = bonus !== null && row.bonus_number != null && Number(row.bonus_number) === bonus;
        ticket.gradedDates.push(date);
        ticket.drawResults.push({ date, white, bonus: bonusHit });
        if (betterWeekly(ticket.bestWeekly, { white, bonus: bonusHit })) {
            ticket.bestWeekly = { white, bonus: bonusHit };
        }
        ticket.payout = 0;
        updated = true;
    });
    const best = ticket.bestWeekly
        ? weeklyHitLabel(ticket.game, ticket.bestWeekly.white, ticket.bestWeekly.bonus)
        : "0";
    const label = progressLabel(ticket.gradedDates.length, dates.length, best);
    if (ticket.hits !== label) {
        ticket.hits = label;
        updated = true;
    }
    return updated;
}

// game: only tickets for this game are graded against these draws.
// When game is omitted, Quick Draw is assumed (older callers).
export function gradeTickets(tickets, draws, game = "quickdraw") {
    if (!Array.isArray(tickets) || tickets.length === 0 || !Array.isArray(draws) || draws.length === 0) {
        return false;
    }
    let updated = false;
    if (game === "quickdraw") {
        const timed = draws.filter((draw) => drawAtMs(draw) !== null);
        const drawMap = new Map();
        timed.forEach((draw) => drawMap.set(parseInt(draw.draw_number, 10), draw));
        tickets.forEach((ticket) => {
            if ((ticket.game || "quickdraw") !== "quickdraw") return;
            if (gradeQuickDraw(ticket, drawMap, timed)) updated = true;
        });
        return updated;
    }
    tickets.forEach((ticket) => {
        if (ticket.game !== game) return;
        if (gradeWeekly(ticket, draws)) updated = true;
    });
    return updated;
}

// True when a saved slip still has draws that are not checked.
export function ticketPending(ticket) {
    if (!ticket) return false;
    if ((ticket.game || "quickdraw") === "quickdraw") {
        const games = parseInt(ticket.games || 1, 10);
        if (ticket.draw == null && ticketAnchorMs(ticket) === null) return false;
        return !Array.isArray(ticket.gradedDraws) || ticket.gradedDraws.length < games;
    }
    const dates = Array.isArray(ticket.drawDates) ? ticket.drawDates : [];
    return dates.length > 0 && (!Array.isArray(ticket.gradedDates) || ticket.gradedDates.length < dates.length);
}
