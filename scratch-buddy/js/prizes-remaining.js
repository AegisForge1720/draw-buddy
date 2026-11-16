// Statewide scratch-off prize status from the local nzqa-7unk cache.
// preview-only, Ralph no-go. Behind FEATURES.prizesRemainingTable. Figures are official and not per store.

export const PRIZES_DATA_URL = "./data/prizes-remaining.json";
export const NO_DATA = "no data";

export const PRIZE_FIELD_LABELS = {
    game_number: "game_number",
    game_name: "game_name",
    prize_amount: "prize_amount",
    paid: "paid",
    unpaid: "unpaid",
    total: "total"
};

export function formatOfficialCount(value) {
    if (!Number.isFinite(value)) return NO_DATA;
    return Number(value).toLocaleString("en-US");
}

export function groupPrizeStatus(rows) {
    const games = new Map();
    for (const row of rows || []) {
        const gameNumber = String(row && row.game_number || "").trim();
        if (!gameNumber) continue;
        let game = games.get(gameNumber);
        if (!game) {
            game = {
                game_number: gameNumber,
                game_name: String(row.game_name || "").trim(),
                tiers: []
            };
            games.set(gameNumber, game);
        }
        if (!game.game_name && row.game_name) game.game_name = String(row.game_name).trim();
        game.tiers.push({
            prize_amount: String(row.prize_amount || "").trim() || NO_DATA,
            paid: Number.isFinite(row.paid) ? row.paid : null,
            unpaid: Number.isFinite(row.unpaid) ? row.unpaid : null,
            total: Number.isFinite(row.total) ? row.total : null
        });
    }
    return [...games.values()];
}

export function filterPrizeGames(games, query) {
    const text = String(query || "").toLowerCase().trim();
    const list = Array.isArray(games) ? games : [];
    if (!text) return list;
    return list.filter((game) => {
        const hay = `${game.game_number} ${game.game_name}`.toLowerCase();
        return hay.includes(text);
    });
}

export function officialPrizeCaveat(cache) {
    const source = (cache && cache.source) || "Scratch-Off Game Daily Prize Status Report";
    const datasetId = (cache && cache.datasetId) || "nzqa-7unk";
    return [
        `Source: ${source} (NY Open Data dataset ${datasetId}), published by the New York State Gaming Commission.`,
        "These are statewide official counts for each game and prize tier.",
        "They are not per store and do not say where tickets were sold or cashed.",
        "A missing official figure is shown as no data."
    ].join(" ");
}

export async function loadPrizesRemainingCache(url = PRIZES_DATA_URL, fetchFn = fetch) {
    const response = await fetchFn(url, { cache: "no-store" });
    if (!response.ok) {
        throw new Error("The official prizes-remaining cache could not be loaded.");
    }
    const payload = await response.json();
    const rows = Array.isArray(payload && payload.rows) ? payload.rows : [];
    return {
        source: payload.source || "Scratch-Off Game Daily Prize Status Report",
        sourceAgency: payload.sourceAgency || "",
        datasetId: payload.datasetId || "nzqa-7unk",
        sourcePage: payload.sourcePage || "",
        retrievedAt: payload.retrievedAt || "",
        sourceRowsUpdatedAt: payload.sourceRowsUpdatedAt || "",
        rowCount: Number.isInteger(payload.rowCount) ? payload.rowCount : rows.length,
        gameCount: Number.isInteger(payload.gameCount) ? payload.gameCount : new Set(rows.map((row) => row.game_number)).size,
        officialFields: payload.officialFields || PRIZE_FIELD_LABELS,
        notes: payload.notes || "",
        rows
    };
}
