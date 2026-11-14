// Counts how many saved numbers matched loaded draws. Does not assign a dollar return.
export function gradeTickets(tickets, draws) {
    if (!Array.isArray(tickets) || tickets.length === 0 || !Array.isArray(draws) || draws.length === 0) {
        return false;
    }
    const drawMap = new Map();
    draws.forEach((draw) => {
        if (!draw || !draw.created_at) return;
        drawMap.set(parseInt(draw.draw_number, 10), draw);
    });

    let updated = false;
    tickets.forEach((ticket) => {
        if (ticket.game && ticket.game !== "quickdraw") {
            const note = "Not graded";
            if (ticket.hits !== note) {
                ticket.hits = note;
                ticket.payout = 0;
                updated = true;
            }
            return;
        }

        const startDraw = parseInt(ticket.draw, 10);
        const numGames = parseInt(ticket.games || 1, 10);
        const endDraw = parseInt(ticket.endDraw || (startDraw + numGames - 1), 10);
        if (!ticket.gradedDraws) ticket.gradedDraws = [];
        if (typeof ticket.bestHits !== "number") ticket.bestHits = 0;
        const played = (ticket.numbers || []).map(Number);
        if (played.length === 0 || Number.isNaN(startDraw)) return;

        for (let drawNumber = startDraw; drawNumber <= endDraw; drawNumber++) {
            if (ticket.gradedDraws.includes(drawNumber) || !drawMap.has(drawNumber)) continue;
            const winning = (drawMap.get(drawNumber).winning_numbers || []).map(Number);
            const hitCount = played.filter((number) => winning.includes(number)).length;
            ticket.payout = 0;
            if (hitCount > ticket.bestHits) ticket.bestHits = hitCount;
            ticket.gradedDraws.push(drawNumber);
            updated = true;
        }

        const gradedCount = ticket.gradedDraws.length;
        if (gradedCount === 0) return;
        if (gradedCount < numGames) {
            ticket.hits = `Matched ${gradedCount}/${numGames} games. Best ${ticket.bestHits}/${ticket.spot}`;
        } else {
            ticket.hits = numGames > 1
                ? `Matched ${numGames}/${numGames} games. Best ${ticket.bestHits}/${ticket.spot}`
                : `Matched ${ticket.bestHits}/${ticket.spot}`;
        }
    });

    return updated;
}
