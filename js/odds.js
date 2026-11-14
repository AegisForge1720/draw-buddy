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

// Fraction of bankroll. Zero when the ticket's expected prize is at or below its cost.
export function kellyFractionForPrizes(cost, outcomes) {
    if (!(cost > 0)) return 0;
    const ev = outcomes.reduce((sum, outcome) => sum + outcome.p * outcome.prize, 0);
    if (ev <= cost + 1e-9) return 0;
    let bestF = 0;
    let best = -Infinity;
    for (let i = 0; i <= 200; i++) {
        const f = i / 200;
        let growth = 0;
        for (const outcome of outcomes) {
            const wealth = 1 - f + f * (outcome.prize / cost);
            if (wealth <= 0) {
                growth = -Infinity;
                break;
            }
            growth += outcome.p * Math.log(wealth);
        }
        if (growth > best) {
            best = growth;
            bestF = f;
        }
    }
    return bestF;
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

function hypergeometricSample(N, K, n, rng) {
    const seen = new Set();
    let hits = 0;
    while (seen.size < n) {
        const value = Math.floor(rng() * N) + 1;
        if (seen.has(value)) continue;
        seen.add(value);
        if (value <= K) hits += 1;
    }
    return hits;
}

export function simulateQuickDraw(spot, sims, rng = Math.random) {
    const table = QD_PAYOUT_TABLE[spot] || {};
    let prizeDraws = 0;
    let netSum = 0;
    const runs = Math.max(0, sims);
    for (let s = 0; s < runs; s++) {
        const hits = hypergeometricSample(80, 20, spot, rng);
        const prize = table[hits] || 0;
        if (prize > 0) prizeDraws += 1;
        netSum += prize - 1;
    }
    return {
        sims: runs,
        prizeDraws,
        meanNet: runs > 0 ? netSum / runs : 0
    };
}
