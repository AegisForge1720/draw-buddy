export const DATA_UNAVAILABLE = "Data unavailable";

export const EV_LINE = "Expected value is the average return per ticket from a published prize list, minus the ticket price. It is not a prediction or an advantage.";

// Complete remaining-ticket table: every remaining ticket belongs to one tier,
// including tickets that pay 0. `ticketsRemaining` must equal the sum of counts.
// Returns the average prize minus `price`, or null when the table is incomplete.
export function expectedValuePerTicket({ tiers, ticketsRemaining, price }) {
    const remaining = Number(ticketsRemaining);
    const ticketPrice = Number(price);
    if (!Array.isArray(tiers) || tiers.length === 0) return null;
    if (!(remaining > 0) || !Number.isFinite(ticketPrice) || ticketPrice < 0) return null;
    let tickets = 0;
    let payout = 0;
    for (const tier of tiers) {
        const count = Number(tier && tier.count);
        const prize = Number(tier && tier.prize);
        if (!Number.isInteger(count) || count < 0) return null;
        if (!Number.isFinite(prize) || prize < 0) return null;
        tickets += count;
        payout += prize * count;
    }
    if (tickets !== remaining) return null;
    return (payout / remaining) - ticketPrice;
}

export function ledgerTotals(tickets) {
    const rows = Array.isArray(tickets) ? tickets : [];
    let spent = 0;
    let won = 0;
    rows.forEach((ticket) => {
        spent += Number(ticket.cost) || 0;
        won += Number(ticket.payout) || 0;
    });
    return {
        count: rows.length,
        spent,
        won,
        net: won - spent
    };
}

function readMoney(value) {
    if (typeof value === "number") return value;
    const text = String(value ?? "").trim();
    if (text === "") return Number.NaN;
    return Number(text);
}

export function parseTicketEntry({ game, cost, payout }) {
    const name = String(game || "").trim();
    const ticketCost = readMoney(cost);
    const ticketPayout = readMoney(payout);
    if (!name) return { ok: false, reason: "Enter the game name you played." };
    if (!Number.isFinite(ticketCost) || ticketCost < 0) return { ok: false, reason: "Enter the ticket price you paid." };
    if (!Number.isFinite(ticketPayout) || ticketPayout < 0) return { ok: false, reason: "Enter the amount this ticket paid, or 0." };
    return {
        ok: true,
        ticket: {
            game: name,
            cost: ticketCost,
            payout: ticketPayout
        }
    };
}
