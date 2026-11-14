import { QD_PAYOUT_TABLE } from "./odds.js";

// Updates tickets in place. Returns true when a row changed.
// Quick Draw slips use the in-app payout table. Other games are marked ungraded
// so a Quick Draw prize is not presented as their result.
export function gradeTickets(tickets, draws) {
    if (!Array.isArray(tickets) || tickets.length === 0 || !Array.isArray(draws) || draws.length === 0) {
        return false;
    }
    const drawMap = new Map();
    draws.forEach((draw) => {
        drawMap.set(parseInt(draw.draw_number, 10), draw);
    });

    let updated = false;
    tickets.forEach((ticket) => {
        if (ticket.game && ticket.game !== "quickdraw") {
            const note = "Not graded (no prize table for this game)";
            if (ticket.hits !== note) {
                ticket.hits = note;
                updated = true;
            }
            return;
        }

        const startDraw = parseInt(ticket.draw, 10);
        const numGames = parseInt(ticket.games || 1, 10);
        const endDraw = parseInt(ticket.endDraw || (startDraw + numGames - 1), 10);
        if (!ticket.gradedDraws) ticket.gradedDraws = [];
        if (typeof ticket.bestHits !== "number") ticket.bestHits = 0;
        if (typeof ticket.winningGamesCount !== "number") ticket.winningGamesCount = 0;

        const played = (ticket.numbers || []).map(Number);
        if (played.length === 0 || Number.isNaN(startDraw)) return;
        const spot = parseInt(ticket.spot, 10);

        for (let drawNumber = startDraw; drawNumber <= endDraw; drawNumber++) {
            if (ticket.gradedDraws.includes(drawNumber) || !drawMap.has(drawNumber)) continue;
            const draw = drawMap.get(drawNumber);
            const winning = (draw.winning_numbers || []).map(Number);
            const hitCount = played.filter((number) => winning.includes(number)).length;
            const baseWager = ticket.baseWager || 1;
            const hasExtra = Boolean(ticket.hasExtra);
            const drawMult = hasExtra ? (parseInt(draw.extra_multiplier, 10) || 1) : 1;
            const prizeScale = QD_PAYOUT_TABLE[spot] || {};
            const unitPrize = prizeScale[hitCount] !== undefined ? prizeScale[hitCount] : 0;
            ticket.payout = (parseFloat(ticket.payout) || 0) + unitPrize * baseWager * drawMult;
            if (hitCount > ticket.bestHits) ticket.bestHits = hitCount;
            if (unitPrize * baseWager * drawMult > 0) ticket.winningGamesCount += 1;
            ticket.gradedDraws.push(drawNumber);
            updated = true;
        }

        const gradedCount = ticket.gradedDraws.length;
        if (gradedCount === 0) {
            ticket.hits = numGames > 1 ? `Pending (0/${numGames} gms)` : "Pending";
        } else if (gradedCount < numGames) {
            ticket.hits = `Live (${gradedCount}/${numGames} gms) • Best: ${ticket.bestHits}/${ticket.spot}`;
        } else {
            ticket.hits = numGames > 1
                ? `Done (${numGames}/${numGames} gms) • Best: ${ticket.bestHits}/${ticket.spot}`
                : `${ticket.bestHits}/${ticket.spot} Hit`;
        }
    });

    return updated;
}
