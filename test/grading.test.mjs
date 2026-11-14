import assert from "node:assert/strict";
import test from "node:test";
import { gradeTickets } from "../js/grading.js";

test("a matching Quick Draw slip is graded from the in-app table", () => {
    const tickets = [{
        draw: 10,
        endDraw: 10,
        spot: 4,
        games: 1,
        game: "quickdraw",
        numbers: [1, 2, 3, 4],
        baseWager: 1,
        hasExtra: false,
        payout: 0,
        hits: "Pending"
    }];
    const draws = [{
        draw_number: 10,
        winning_numbers: [1, 2, 3, 4, 5],
        extra_multiplier: 3
    }];
    assert.equal(gradeTickets(tickets, draws), true);
    assert.equal(tickets[0].payout, 91);
    assert.equal(tickets[0].hits, "4/4 Hit");
    assert.equal(gradeTickets(tickets, draws), false);
});

test("Extra multiplies the in-app prize by the loaded draw multiplier", () => {
    const tickets = [{
        draw: 3,
        games: 1,
        spot: 4,
        game: "quickdraw",
        numbers: [1, 2, 3, 4],
        baseWager: 2,
        hasExtra: true,
        payout: 0
    }];
    gradeTickets(tickets, [{
        draw_number: 3,
        winning_numbers: [1, 2, 3, 4],
        extra_multiplier: 2
    }]);
    assert.equal(tickets[0].payout, 91 * 2 * 2);
});

test("non-Quick Draw slips are not priced with the Quick Draw table", () => {
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
        winning_numbers: [1, 2, 3, 4, 5]
    }]), true);
    assert.equal(tickets[0].payout, 0);
    assert.equal(tickets[0].hits, "Not graded (no prize table for this game)");
});

test("a block stays pending until each draw in the range is loaded", () => {
    const tickets = [{
        draw: 20,
        endDraw: 21,
        games: 2,
        spot: 1,
        numbers: [7],
        baseWager: 1,
        hasExtra: false,
        payout: 0
    }];
    gradeTickets(tickets, [{ draw_number: 20, winning_numbers: [7] }]);
    assert.match(tickets[0].hits, /^Live \(1\/2/);
    assert.equal(tickets[0].payout, 2);
});
