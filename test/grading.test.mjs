import assert from "node:assert/strict";
import test from "node:test";
import { gradeTickets } from "../js/grading.js";

const stamp = "2026-11-14T02:07:57.211Z";

test("a matching Quick Draw pick counts hits and does not store a payout", () => {
    const tickets = [{
        draw: 10,
        endDraw: 10,
        spot: 4,
        games: 1,
        game: "quickdraw",
        numbers: [1, 2, 3, 4],
        payout: 0,
        hits: "Pending"
    }];
    const draws = [{
        draw_number: 10,
        draw_at: stamp,
        winning_numbers: [1, 2, 3, 4, 5],
        extra_multiplier: 3
    }];
    assert.equal(gradeTickets(tickets, draws), true);
    assert.equal(tickets[0].payout, 0);
    assert.equal(tickets[0].hits, "Done · Matched 4/4");
    assert.equal(gradeTickets(tickets, draws), false);
});

test("draws outside the saved range do not change a pending pick", () => {
    const tickets = [{
        draw: 100,
        endDraw: 101,
        games: 2,
        spot: 1,
        game: "quickdraw",
        numbers: [7],
        payout: 91,
        hits: "Pending"
    }];
    assert.equal(gradeTickets(tickets, [{
        draw_number: 10,
        draw_at: stamp,
        winning_numbers: [7]
    }]), false);
    assert.equal(tickets[0].hits, "Pending");
    assert.equal(tickets[0].payout, 91);
});

test("a draw without a stored timestamp is not used to grade", () => {
    const tickets = [{
        draw: 3,
        games: 1,
        spot: 4,
        game: "quickdraw",
        numbers: [1, 2, 3, 4],
        payout: 0,
        hits: "Pending"
    }];
    assert.equal(gradeTickets(tickets, [{
        draw_number: 3,
        created_at: stamp,
        winning_numbers: [1, 2, 3, 4],
        extra_multiplier: 2
    }]), false);
    assert.equal(gradeTickets(tickets, [{
        draw_number: 3,
        winning_numbers: [1, 2, 3, 4],
        extra_multiplier: 2
    }]), false);
    assert.equal(tickets[0].payout, 0);
    assert.equal(tickets[0].hits, "Pending");
});

test("Powerball picks without saved draw dates are not tracked and get no payout", () => {
    const tickets = [{
        draw: 8,
        games: 1,
        spot: 5,
        game: "powerball",
        numbers: [1, 2, 3, 4, 5],
        payout: 0,
        hits: "Pending"
    }];
    assert.equal(gradeTickets(tickets, [{
        draw_number: 8,
        draw_date: "2026-11-11",
        winning_numbers: [1, 2, 3, 4, 5]
    }], "powerball"), true);
    assert.equal(tickets[0].payout, 0);
    assert.equal(tickets[0].hits, "Not tracked (no draw dates saved)");
});

test("a block stays partial until each stored draw in the range is loaded", () => {
    const tickets = [{
        draw: 20,
        endDraw: 21,
        games: 2,
        spot: 1,
        numbers: [7],
        payout: 0
    }];
    gradeTickets(tickets, [{ draw_number: 20, draw_at: stamp, winning_numbers: [7] }]);
    assert.match(tickets[0].hits, /^1 of 2 draws checked · Best 1\/1/);
    assert.equal(tickets[0].payout, 0);
});
