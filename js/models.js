import { hypergeometric } from "./odds.js";

export const NEGATIVE_EV_REASON = "Negative expected value: Kelly recommends not betting.";

export const MONTE_CARLO_SESSIONS = 10000;
export const MONTE_CARLO_SEED = 20261114;

export const QUICK_DRAW_POOL = 80;
export const QUICK_DRAW_DRAWN = 20;

// NY Quick Draw base-play prizes for a $1 play, by spot count and numbers matched.
// Match counts that are omitted pay $0. A base play of $n pays n times these
// amounts: § 5013.4(c) counts winning plays in $1 equivalents, and the
// published chart says to multiply the $1 prize by the base amount.
// Money Dots is a separate wager and is not part of this table.
// The shared 10-of-10 cap in § 5013.4(c) can lower that one prize when more
// than 50 $1-equivalent tickets win it. This table uses the published
// per-play prize because the other-winner count is not an input.
//
// Source: 9 NYCRR § 5013.4(a)(1), New York State Gaming Commission Rules,
// Chapter III (Division of Lottery), document updated September 2026:
// https://gaming.ny.gov/system/files/documents/2026/09/new-york-state-gaming-commission-rules-chapter-iii-lottery-updated-2026-09_0.pdf
export const QUICK_DRAW_PRIZES = {
    1: { 1: 2 },
    2: { 2: 10 },
    3: { 2: 2, 3: 23 },
    4: { 2: 1, 3: 5, 4: 55 },
    5: { 3: 2, 4: 20, 5: 300 },
    6: { 3: 1, 4: 6, 5: 55, 6: 1000 },
    7: { 0: 1, 4: 2, 5: 20, 6: 100, 7: 5000 },
    8: { 0: 2, 5: 6, 6: 75, 7: 550, 8: 10000 },
    9: { 0: 2, 5: 5, 6: 20, 7: 125, 8: 3000, 9: 30000 },
    10: { 0: 5, 5: 2, 6: 10, 7: 45, 8: 300, 9: 5000, 10: 100000 }
};

// Quick Draw Extra doubles the base-play cost and multiplies a prize by the
// symbol drawn after the 20 numbers. "No extra" pays the base prize (1x).
// The published odds are "1 in". These weights are the split of 80 that
// matches them: 32/80 = 1/2.5, 34/80 = 1/2.352941 (printed 2.3529),
// 5/80 = 1/16, 5/80 = 1/16, 3/80 = 1/26.666..., 1/80 = 1/80.
// Source: 9 NYCRR § 5013.3(b)(1)(iii), same September 2026 rules PDF.
export const QUICK_DRAW_EXTRA = [
    { multiplier: 1, weight: 32 },
    { multiplier: 2, weight: 34 },
    { multiplier: 3, weight: 5 },
    { multiplier: 4, weight: 5 },
    { multiplier: 5, weight: 3 },
    { multiplier: 10, weight: 1 }
];

// Textbook Kelly fraction of bankroll for one bet that pays net odds `b`
// (net gain per $1 staked if it wins) with win probability `p`:
// f* = (b*p - q) / b, where q = 1 - p.
// Returns 0 when that value is not positive. There is no 1% floor.
export function kellyFraction(winProbability, netOdds) {
    const p = Number(winProbability);
    const b = Number(netOdds);
    if (!(p > 0) || p > 1 || !(b > 0)) return 0;
    const q = 1 - p;
    const fraction = ((b * p) - q) / b;
    return fraction > 0 ? fraction : 0;
}

export function historyStatLabel(verified, value) {
    if (!verified) return "Data unavailable";
    if (value === null || value === undefined || value === "") return "n/a";
    return String(value);
}

function extraWeightsTotal() {
    return QUICK_DRAW_EXTRA.reduce((sum, row) => sum + row.weight, 0);
}

function symbolsFor(extra) {
    if (!extra) return [{ multiplier: 1, probability: 1 }];
    const total = extraWeightsTotal();
    return QUICK_DRAW_EXTRA.map((row) => ({
        multiplier: row.multiplier,
        probability: row.weight / total
    }));
}

export function quickDrawDistribution({ spots, baseWager, extra = false }) {
    const table = QUICK_DRAW_PRIZES[spots];
    const wager = Number(baseWager);
    if (!table || !(wager > 0)) return null;
    const symbols = symbolsFor(extra);
    const outcomes = [];
    for (let matches = 0; matches <= spots; matches += 1) {
        const matchProbability = hypergeometric(QUICK_DRAW_POOL, QUICK_DRAW_DRAWN, spots, matches);
        const basePrize = (table[matches] || 0) * wager;
        symbols.forEach((symbol) => {
            outcomes.push({
                probability: matchProbability * symbol.probability,
                grossPayout: basePrize * symbol.multiplier
            });
        });
    }
    return {
        outcomes,
        cost: extra ? wager * 2 : wager
    };
}

// Win probability is the chance the play returns any prize.
// Payout is the average dollars returned on a winning play, per $1 staked.
// EV per $1 is the average dollars returned on every play, per $1 staked, minus 1.
// Recommended stake is $0 when that EV is not positive. A positive fraction is
// a share of bankroll; this does not invent a dollar bankroll.
export function quickDrawKelly({ spots, baseWager, extra = false }) {
    const distribution = quickDrawDistribution({ spots, baseWager, extra });
    if (!distribution) return null;
    let expectedGross = 0;
    let winProbability = 0;
    let winGross = 0;
    distribution.outcomes.forEach((outcome) => {
        expectedGross += outcome.probability * outcome.grossPayout;
        if (outcome.grossPayout > 0) {
            winProbability += outcome.probability;
            winGross += outcome.probability * outcome.grossPayout;
        }
    });
    const payout = winProbability > 0 ? (winGross / winProbability) / distribution.cost : 0;
    const evPer1 = expectedGross / distribution.cost - 1;
    const netOdds = payout - 1;
    const fraction = kellyFraction(winProbability, netOdds);
    return {
        winProbability,
        payout,
        evPer1,
        netOdds,
        fraction,
        stake: fraction > 0 ? null : 0,
        reason: fraction > 0 ? "" : NEGATIVE_EV_REASON,
        cost: distribution.cost,
        meanNet: expectedGross - distribution.cost
    };
}

export function createRng(seed) {
    let state = seed >>> 0;
    return function rng() {
        state = (state + 0x6D2B79F5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function drawMatchCount(spots, rng) {
    const pool = new Uint8Array(QUICK_DRAW_POOL);
    for (let i = 0; i < QUICK_DRAW_POOL; i += 1) pool[i] = i;
    let matches = 0;
    for (let i = 0; i < QUICK_DRAW_DRAWN; i += 1) {
        const j = i + Math.floor(rng() * (QUICK_DRAW_POOL - i));
        const value = pool[j];
        pool[j] = pool[i];
        if (value < spots) matches += 1;
    }
    return matches;
}

function drawExtraMultiplier(rng) {
    let ticket = rng() * extraWeightsTotal();
    for (let i = 0; i < QUICK_DRAW_EXTRA.length; i += 1) {
        ticket -= QUICK_DRAW_EXTRA[i].weight;
        if (ticket < 0) return QUICK_DRAW_EXTRA[i].multiplier;
    }
    return QUICK_DRAW_EXTRA[QUICK_DRAW_EXTRA.length - 1].multiplier;
}

// One session is one Quick Draw play: 20 numbers drawn from 80, scored with
// the official spot paytable. Extra, when on, draws the official symbol too.
export function simulateQuickDraw({ spots, baseWager, extra = false, sessions, seed }) {
    const table = QUICK_DRAW_PRIZES[spots];
    const wager = Number(baseWager);
    const count = Number(sessions);
    if (!table || !(wager > 0) || !(count > 0) || !Number.isFinite(Number(seed))) return null;
    const rng = createRng(seed);
    const cost = extra ? wager * 2 : wager;
    let netTotal = 0;
    let wins = 0;
    for (let i = 0; i < count; i += 1) {
        const matches = drawMatchCount(spots, rng);
        let prize = (table[matches] || 0) * wager;
        if (extra) prize *= drawExtraMultiplier(rng);
        if (prize > 0) wins += 1;
        netTotal += prize - cost;
    }
    return {
        sessions: count,
        netTotal,
        meanNet: netTotal / count,
        winRate: wins / count
    };
}
