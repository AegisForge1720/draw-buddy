// Prize math for the in-app NY Quick Draw table.
// The amounts are the ones this app already used to grade slips. They are not
// a quote from the state lottery. Extra / multiplier draws are not included.

export const QD_PAYOUT_TABLE = {
    10: { 10: 100000, 9: 4250, 8: 450, 7: 40, 6: 15, 5: 2, 0: 5 },
    9: { 9: 30000, 8: 3000, 7: 125, 6: 20, 5: 5, 4: 1 },
    8: { 8: 10000, 7: 550, 6: 75, 5: 6, 4: 2 },
    7: { 7: 5000, 6: 100, 5: 20, 4: 2, 3: 1 },
    6: { 6: 1500, 5: 50, 4: 6, 3: 1 },
    5: { 5: 450, 4: 20, 3: 2 },
    4: { 4: 91, 3: 4, 2: 1 },
    3: { 3: 27, 2: 2 },
    2: { 2: 10 },
    1: { 1: 2 }
};

export function combination(n, k) {
    if (k < 0 || n < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let result = 1;
    for (let i = 1; i <= k; i++) {
        result = (result * (n - k + i)) / i;
    }
    return result;
}

// Population N, K marked numbers, draw n, want exactly k marked.
export function hypergeometric(N, K, n, k) {
    const denom = combination(N, n);
    if (denom === 0) return 0;
    return (combination(K, k) * combination(N - K, n - k)) / denom;
}

export function quickDrawOutcomes(spot, wager = 1) {
    const table = QD_PAYOUT_TABLE[spot] || {};
    const outcomes = [];
    for (let hits = 0; hits <= spot; hits++) {
        outcomes.push({
            p: hypergeometric(80, 20, spot, hits),
            prize: (table[hits] || 0) * wager
        });
    }
    return outcomes;
}

export function quickDrawBaseEv(spot, wager = 1) {
    return quickDrawOutcomes(spot, wager).reduce((sum, outcome) => sum + outcome.p * outcome.prize, 0);
}

export function quickDrawPrizeRate(spot) {
    return quickDrawOutcomes(spot, 1).reduce((sum, outcome) => sum + (outcome.prize > 0 ? outcome.p : 0), 0);
}

export function oneStepRepeatRate(draws, targetNum) {
    const wanted = Number(targetNum);
    let given = 0;
    let hits = 0;
    for (let i = 0; i < draws.length - 1; i++) {
        const newer = (draws[i].winning_numbers || []).map(Number);
        const older = (draws[i + 1].winning_numbers || []).map(Number);
        if (!older.includes(wanted)) continue;
        given += 1;
        if (newer.includes(wanted)) hits += 1;
    }
    if (given === 0) return null;
    return hits / given;
}
