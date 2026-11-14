import assert from "node:assert/strict";
import test from "node:test";
import { DATA_VERIFIED } from "../js/config.js";
import { hypergeometric, expectedRepeatRate } from "../js/odds.js";
import {
    MONTE_CARLO_SEED,
    NEGATIVE_EV_REASON,
    QUICK_DRAW_DRAWN,
    QUICK_DRAW_EXTRA,
    QUICK_DRAW_POOL,
    QUICK_DRAW_PRIZES,
    PANEL_PLAYS,
    displayedMonteCarlo,
    historyStatLabel,
    kellyFraction,
    quickDrawKelly,
    simulateQuickDraw
} from "../js/models.js";

test("kelly fraction is 0 when expected value is not positive", () => {
    assert.equal(kellyFraction(0.4, 1), 0);
    assert.equal(kellyFraction(0.5, 1), 0);
    assert.equal(kellyFraction(0.01, 1), 0);
    assert.equal(kellyFraction(0, 5), 0);
    assert.notEqual(kellyFraction(0.4, 1), 0.01);
});

test("kelly fraction matches the textbook formula for a positive-EV bet", () => {
    // Even-money bet, 60% chance to win: f* = p - q = 0.2.
    assert.ok(Math.abs(kellyFraction(0.6, 1) - 0.2) < 1e-12);
    // Net odds 3:1 with p = 0.5: f* = (3*0.5 - 0.5) / 3 = 1/3.
    assert.ok(Math.abs(kellyFraction(0.5, 3) - (1 / 3)) < 1e-12);
    const tiny = kellyFraction(0.501, 1);
    assert.ok(tiny > 0 && tiny < 0.01);
    assert.ok(Math.abs(tiny - 0.002) < 1e-12);
});

test("Quick Draw 1-spot Kelly uses the $2 prize and stakes $0", () => {
    const report = quickDrawKelly({ spots: 1, baseWager: 1, extra: false });
    assert.equal(report.stake, 0);
    assert.equal(report.reason, NEGATIVE_EV_REASON);
    assert.ok(Math.abs(report.winProbability - 0.25) < 1e-12);
    assert.ok(Math.abs(report.payout - 2) < 1e-12);
    assert.ok(Math.abs(report.evPer1 - (0.25 * 2 - 1)) < 1e-12);
});

test("every Quick Draw spot has negative EV and a $0 Kelly stake", () => {
    for (let spots = 1; spots <= 10; spots += 1) {
        for (const extra of [false, true]) {
            const report = quickDrawKelly({ spots, baseWager: 1, extra });
            assert.equal(report.stake, 0, `${spots}-spot extra=${extra}`);
            assert.ok(report.evPer1 < 0, `${spots}-spot extra=${extra} ev ${report.evPer1}`);
            assert.equal(report.reason, NEGATIVE_EV_REASON);
            assert.ok(report.winProbability > 0 && report.winProbability < 1);
            assert.ok(report.payout > 0);
        }
    }
});

test("Extra weights match the published 1-in odds and average to 2x", () => {
    const total = QUICK_DRAW_EXTRA.reduce((sum, row) => sum + row.weight, 0);
    assert.equal(total, 80);
    const odds = QUICK_DRAW_EXTRA.map((row) => total / row.weight);
    assert.equal(odds[0], 2.5);
    assert.ok(Math.abs(odds[1] - 2.3529) < 0.0001);
    assert.equal(odds[2], 16);
    assert.equal(odds[3], 16);
    assert.ok(Math.abs(odds[4] - 26.6667) < 0.0001);
    assert.equal(odds[5], 80);
    const expectedMultiplier = QUICK_DRAW_EXTRA.reduce((sum, row) => sum + row.multiplier * row.weight, 0) / total;
    assert.equal(expectedMultiplier, 2);
    const base = quickDrawKelly({ spots: 4, baseWager: 2, extra: false });
    const extra = quickDrawKelly({ spots: 4, baseWager: 2, extra: true });
    assert.ok(Math.abs(base.evPer1 - extra.evPer1) < 1e-12);
    assert.ok(Math.abs(extra.meanNet - base.meanNet * 2) < 1e-9);
    assert.equal(extra.cost, 4);
});

test("4-spot odds match the regulation hypergeometric figures", () => {
    const odds = (matches) => 1 / hypergeometric(QUICK_DRAW_POOL, QUICK_DRAW_DRAWN, 4, matches);
    assert.ok(Math.abs(odds(4) - 326.4355) < 0.001);
    assert.ok(Math.abs(odds(3) - 23.1225) < 0.001);
    assert.ok(Math.abs(odds(2) - 4.7029) < 0.001);
    assert.equal(QUICK_DRAW_PRIZES[4][4], 55);
    assert.equal(QUICK_DRAW_PRIZES[10][10], 100000);
    assert.equal(QUICK_DRAW_PRIZES[10][0], 5);
    const ten = (matches) => 1 / hypergeometric(QUICK_DRAW_POOL, QUICK_DRAW_DRAWN, 10, matches);
    assert.ok(Math.abs(ten(10) - 8911711.1765) < 0.01);
    assert.ok(Math.abs(ten(0) - 21.8385) < 0.001);
});

function analyticMeanNet({ spots, baseWager, extra }) {
    const symbols = extra
        ? QUICK_DRAW_EXTRA.map((row) => ({ multiplier: row.multiplier, probability: row.weight / 80 }))
        : [{ multiplier: 1, probability: 1 }];
    const cost = extra ? baseWager * 2 : baseWager;
    let expectedGross = 0;
    for (let matches = 0; matches <= spots; matches += 1) {
        const matchProbability = hypergeometric(QUICK_DRAW_POOL, QUICK_DRAW_DRAWN, spots, matches);
        const basePrize = (QUICK_DRAW_PRIZES[spots][matches] || 0) * baseWager;
        symbols.forEach((symbol) => {
            expectedGross += matchProbability * symbol.probability * basePrize * symbol.multiplier;
        });
    }
    return expectedGross - cost;
}

test("Monte Carlo mean converges near the analytic EV with a fixed seed", () => {
    const sessions = 20000;
    const seed = MONTE_CARLO_SEED;
    const input = { spots: 1, baseWager: 1, extra: false, sessions, seed };
    const first = simulateQuickDraw(input);
    const second = simulateQuickDraw(input);
    assert.deepEqual(first, second);
    const analytic = analyticMeanNet({ spots: 1, baseWager: 1, extra: false });
    assert.ok(Math.abs(analytic - (-0.5)) < 1e-12);
    assert.ok(Math.abs(first.meanNet - analytic) < 0.02);
    assert.ok(Math.abs(first.winRate - 0.25) < 0.02);
    assert.equal(first.netTotal, first.meanNet * sessions);

    const four = simulateQuickDraw({ spots: 4, baseWager: 1, extra: false, sessions: 40000, seed });
    const fourAnalytic = analyticMeanNet({ spots: 4, baseWager: 1, extra: false });
    assert.ok(fourAnalytic < 0);
    assert.ok(Math.abs(four.meanNet - fourAnalytic) < 0.05);

    const withExtra = simulateQuickDraw({ spots: 1, baseWager: 1, extra: true, sessions, seed: seed + 1 });
    const extraAnalytic = analyticMeanNet({ spots: 1, baseWager: 1, extra: true });
    assert.ok(Math.abs(extraAnalytic - (-1)) < 1e-12);
    assert.ok(Math.abs(withExtra.meanNet - extraAnalytic) < 0.04);
});

test("expected repeat rate is 25% for Quick Draw and follows the other formats", () => {
    assert.equal(expectedRepeatRate(20, 80), 0.25);
    assert.equal(expectedRepeatRate(5, 69), 5 / 69);
    assert.equal(expectedRepeatRate(5, 70), 5 / 70);
    assert.equal(expectedRepeatRate(0, 80), 0);
    assert.equal(expectedRepeatRate(21, 20), null);
});

test("the displayed Monte Carlo figures stay at a loss for every play", () => {
    PANEL_PLAYS.forEach((play) => {
        play.spots.forEach((spots) => {
            play.wagers.forEach((baseWager) => {
                play.extras.forEach((extra) => {
                    const shown = displayedMonteCarlo({ game: play.game, spots, baseWager, extra });
                    const label = `${play.game} ${spots}-spot $${baseWager} extra=${extra}`;
                    assert.ok(shown);
                    assert.ok(!(shown.mainNet > 0), `${label} main ${shown.mainNet}`);
                    assert.ok(!(shown.medianNet > 0), `${label} median ${shown.medianNet}`);
                });
            });
        });
    });
});

test("verified games still label a withheld history read as Data unavailable", () => {
    assert.deepEqual(DATA_VERIFIED, {
        quickdraw: true,
        powerball: true,
        megamillions: true
    });
    assert.equal(historyStatLabel(false, "23.0%"), "Data unavailable");
    assert.equal(historyStatLabel(true, null), "n/a");
    assert.equal(historyStatLabel(true, "23.0%"), "23.0%");
});
