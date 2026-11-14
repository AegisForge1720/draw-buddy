import assert from "node:assert/strict";
import test from "node:test";
import {
    combination,
    expectedOneStepRepeatRate,
    hypergeometric,
    oneStepRepeatRate
} from "../js/odds.js";

test("4-spot Quick Draw odds match the hypergeometric count", () => {
    assert.equal(combination(80, 4), 1581580);
    assert.equal(combination(80, 10), 1646492110120);
    const exact = 4845 / 1581580;
    assert.ok(Math.abs(hypergeometric(80, 20, 4, 4) - exact) < 1e-12);
});

test("expected repeat rate is the share of numbers drawn each time", () => {
    assert.equal(expectedOneStepRepeatRate(20, 80), 0.25);
    assert.equal(Number((expectedOneStepRepeatRate(5, 69) * 100).toFixed(1)), 7.2);
    assert.equal(Number((expectedOneStepRepeatRate(5, 70) * 100).toFixed(1)), 7.1);
    assert.equal(expectedOneStepRepeatRate(0, 80), 0);
    assert.equal(expectedOneStepRepeatRate(81, 80), null);
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
