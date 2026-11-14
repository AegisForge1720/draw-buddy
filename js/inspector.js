import { expectedOneStepRepeatRate } from "./odds.js";
import { historyStatus } from "./schedule.js";

export const PICK_NUMBER_LINE = "Pick a number to see its stats.";
export const SUBSCRIPTION_DETAIL_NOTE = "Number detail is in the subscription.";

export function inspectorIdle({ historyAvailable, subscribed }) {
    if (!historyAvailable) {
        return { title: "Data unavailable", value: "Data unavailable" };
    }
    const title = subscribed
        ? PICK_NUMBER_LINE
        : `${PICK_NUMBER_LINE} ${SUBSCRIPTION_DETAIL_NOTE}`;
    return { title, value: "--" };
}

function formatShare(rate) {
    if (!Number.isFinite(rate)) return "n/a";
    const rounded = Math.round(rate * 10000) / 100;
    if (Number.isInteger(rounded)) return `${rounded}%`;
    return `${rounded.toFixed(2)}%`;
}

export function expectedRepeatText(drawnCount, totalNumbers) {
    const rate = expectedOneStepRepeatRate(drawnCount, totalNumbers);
    if (rate === null) return "n/a";
    return `${formatShare(rate)} (${drawnCount} of ${totalNumbers})`;
}

export function numberWindowStats(draws, number, { drawnCount, totalNumbers }) {
    const slice = Array.isArray(draws) ? draws : [];
    const lookbackSize = slice.length;
    const wanted = Number(number);
    let hits = 0;
    let lastSeenDistance = null;
    slice.forEach((draw, index) => {
        const winning = (draw.winning_numbers || []).map(Number);
        if (!winning.includes(wanted)) return;
        hits += 1;
        if (lastSeenDistance === null) lastSeenDistance = index;
    });
    const percentage = lookbackSize > 0 ? ((hits / lookbackSize) * 100).toFixed(1) : "0.0";
    const meanCycleInterval = hits > 0 ? (lookbackSize / hits).toFixed(1) : lookbackSize.toFixed(1);
    const expected = lookbackSize * (drawnCount / totalNumbers);
    const ratio = expected > 0 ? hits / expected : 0;
    let density = "No hits in this window";
    if (hits > 0 && ratio >= 1.25) density = "Above average count";
    else if (hits > 0 && ratio <= 0.75) density = "Below average count";
    else if (hits > 0) density = "Near average count";
    let lastSeen = "Not in this window";
    if (lastSeenDistance === 0) lastSeen = "Newest loaded draw";
    else if (lastSeenDistance !== null) lastSeen = `${lastSeenDistance} draws before the newest`;
    return {
        title: lookbackSize > 0
            ? `Number ${wanted} in the last ${lookbackSize} loaded draws`
            : `Number ${wanted}`,
        hits: `${hits} / ${lookbackSize} draws`,
        hitCount: hits,
        lookbackSize,
        percentage: `${percentage}%`,
        lastSeen,
        interval: `~${meanCycleInterval} draws`,
        density
    };
}

export function stakePerPlay(game, baseWager, extraOn) {
    const base = Number(baseWager);
    if (!Number.isFinite(base)) return NaN;
    if (!extraOn || game === "megamillions") return base;
    if (game === "quickdraw") return base * 2;
    if (game === "powerball") return base + 1;
    return base;
}

export function settleHistoryFetch({ previous = [], rows = null, failed = false, game, now = new Date(), verified = true }) {
    const incoming = !failed && Array.isArray(rows) && rows.length > 0 ? rows : null;
    if (incoming) {
        const status = historyStatus({
            game,
            newest: incoming[0],
            now,
            verified,
            fetchFailed: false
        });
        return {
            cachedDraws: incoming,
            fetchFailed: false,
            keptPrevious: false,
            available: status.available,
            reason: status.reason
        };
    }
    if (previous.length > 0) {
        const status = historyStatus({
            game,
            newest: previous[0],
            now,
            verified,
            fetchFailed: false
        });
        return {
            cachedDraws: previous,
            fetchFailed: false,
            keptPrevious: true,
            available: status.available,
            reason: status.reason
        };
    }
    return {
        cachedDraws: [],
        fetchFailed: true,
        keptPrevious: false,
        available: false,
        reason: "fetch-failed"
    };
}
