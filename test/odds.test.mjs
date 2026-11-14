import assert from "node:assert/strict";
import test from "node:test";
import {
    combination,
    hypergeometric,
    oneStepRepeatRate,
    quickDrawBaseEv,
    quickDrawPrizeRate
} from "../js/odds.js";

test("4-spot Quick Draw odds match the hypergeometric count", () => {
    assert.equal(combination(80, 4), 1581580);
    assert.equal(combination(80, 10), 1646492110120);
    const exact = 4845 / 1581580;
    assert.ok(Math.abs(hypergeometric(80, 20, 4, 4) - exact) < 1e-12);
});

test("base-game expected value is below the stake", () => {
    const ev = quickDrawBaseEv(4, 1);
    assert.ok(ev < 1, `expected a house edge, got ${ev}`);
    assert.ok(quickDrawPrizeRate(4) > 0);
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
