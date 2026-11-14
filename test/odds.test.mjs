import assert from "node:assert/strict";
import test from "node:test";
import {
    combination,
    hypergeometric,
    kellyFractionForPrizes,
    oneStepRepeatRate,
    quickDrawBaseEv,
    quickDrawPrizeRate,
    simulateQuickDraw
} from "../js/odds.js";

test("4-spot Quick Draw odds match the hypergeometric count", () => {
    assert.equal(combination(80, 4), 1581580);
    assert.equal(combination(80, 10), 1646492110120);
    const exact = 4845 / 1581580;
    assert.ok(Math.abs(hypergeometric(80, 20, 4, 4) - exact) < 1e-12);
});

test("base-game expected value is below the stake, so Kelly is zero", () => {
    const ev = quickDrawBaseEv(4, 1);
    assert.ok(ev < 1, `expected a house edge, got ${ev}`);
    assert.ok(quickDrawPrizeRate(4) > 0);
    assert.equal(kellyFractionForPrizes(1, [
        { p: 1, prize: 0.5 }
    ]), 0);
});

test("repeat rate uses only draws that follow a hit", () => {
    const draws = [
        { winning_numbers: [1, 2] },
        { winning_numbers: [1, 3] },
        { winning_numbers: [4, 5] }
    ];
    assert.equal(oneStepRepeatRate(draws, 1), 1);
    assert.equal(oneStepRepeatRate(draws, 9), null);
});

test("monte carlo reports the simulated prize rate for a fixed sample", () => {
    const result = simulateQuickDraw(1, 20, () => 0);
    assert.equal(result.sims, 20);
    assert.equal(result.prizeDraws, 20);
    assert.equal(result.meanNet, 1);
});
