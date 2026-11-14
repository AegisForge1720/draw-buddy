// Slip planning, own-number validation, and the past-draws check.
// Every result here comes from loaded draw rows or the official schedule.
// Nothing estimates an outcome or a prize.

import {
    etInstant,
    etParts,
    nextQuickDrawSlotAfter,
    upcomingWeeklyDraws
} from "./schedule.js";
import { weeklyHitLabel } from "./grading.js";
import { rowFitsEra } from "./eras.js";

export { MEGA_MILLIONS_ERAS, megaMillionsEra, rowFitsEra } from "./eras.js";

// Current-era number rules for entering your own numbers.
// Sources: 9 NYCRR 5013.2, 5015.2, 5016.2 (gaming.ny.gov rules, updated 9/26) and
// nylottery.ny.gov/draw-game?game=quickdraw|powerball|megamillions.
export const NUMBER_RULES = {
    quickdraw: { min: 1, max: 80, minCount: 1, maxCount: 10, bonus: null },
    powerball: { min: 1, max: 69, minCount: 5, maxCount: 5, bonus: { min: 1, max: 26, name: "Powerball" } },
    megamillions: { min: 1, max: 70, minCount: 5, maxCount: 5, bonus: { min: 1, max: 24, name: "Mega Ball" } }
};

// Most consecutive draws on one slip: the lower of the official NY limit and 20.
// Quick Draw 20, Powerball 39, Mega Millions 26 (nylottery.ny.gov/draw-game Multi-Draw).
export const OFFICIAL_MAX_CONSECUTIVE = { quickdraw: 20, powerball: 39, megamillions: 26 };
export const MAX_CONSECUTIVE = Object.fromEntries(
    Object.entries(OFFICIAL_MAX_CONSECUTIVE).map(([game, max]) => [game, Math.min(max, 20)])
);

function gamesError(game, count) {
    const cap = MAX_CONSECUTIVE[game];
    if (!Number.isInteger(count) || count < 1 || count > cap) return `Pick 1 to ${cap} consecutive draws.`;
    return null;
}

// How far ahead a slip can start.
export const MAX_QUICK_DRAW_START_DAYS = 7;
export const MAX_QUICK_DRAW_OFFSET = 2500;
export const WEEKLY_START_CHOICES = 12;

function parseList(text) {
    if (typeof text !== "string") return [];
    return text.split(/[\s,;]+/).filter((part) => part.length > 0);
}

function parseWhole(token) {
    if (!/^\d{1,3}$/.test(token)) return null;
    return Number(token);
}

export function validateOwnNumbers(game, text, bonusText = "") {
    const rules = NUMBER_RULES[game];
    if (!rules) return { ok: false, error: "Unknown game." };
    const tokens = parseList(text);
    if (tokens.length === 0) return { ok: false, error: "Enter your numbers." };
    const numbers = [];
    for (const token of tokens) {
        const value = parseWhole(token);
        if (value === null) return { ok: false, error: `"${token}" is not a whole number.` };
        if (value < rules.min || value > rules.max) {
            return { ok: false, error: `Numbers must be from ${rules.min} to ${rules.max}.` };
        }
        if (numbers.includes(value)) return { ok: false, error: `${value} is entered twice.` };
        numbers.push(value);
    }
    if (numbers.length < rules.minCount || numbers.length > rules.maxCount) {
        return {
            ok: false,
            error: rules.minCount === rules.maxCount
                ? `Enter exactly ${rules.minCount} numbers.`
                : `Enter ${rules.minCount} to ${rules.maxCount} numbers.`
        };
    }
    numbers.sort((a, b) => a - b);
    if (!rules.bonus) return { ok: true, numbers, bonus: null };
    const bonusTokens = parseList(bonusText);
    if (bonusTokens.length !== 1) return { ok: false, error: `Enter one ${rules.bonus.name}.` };
    const bonus = parseWhole(bonusTokens[0]);
    if (bonus === null || bonus < rules.bonus.min || bonus > rules.bonus.max) {
        return { ok: false, error: `The ${rules.bonus.name} must be from ${rules.bonus.min} to ${rules.bonus.max}.` };
    }
    return { ok: true, numbers, bonus };
}

// Parses "YYYY-MM-DDTHH:MM" as an ET wall-clock time.
export function parseEtLocal(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(typeof value === "string" ? value : "");
    if (!match) return null;
    const [, y, mo, d, h, mi] = match.map(Number);
    const instant = etInstant(y, mo, d, h, mi, 0);
    const parts = etParts(instant);
    if (parts.year !== y || parts.month !== mo || parts.day !== d || parts.hour !== h || parts.minute !== mi) return null;
    return instant;
}

export function etLocalValue(date) {
    const p = etParts(date);
    const pad = (n) => String(n).padStart(2, "0");
    return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function etDateKey(date) {
    const p = etParts(date);
    return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function quickDrawSlots(first, count) {
    const slots = [first];
    while (slots.length < count) slots.push(nextQuickDrawSlotAfter(slots[slots.length - 1]));
    return slots;
}

// start: { mode: "next" } | { mode: "offset", offset } (1 = next draw)
//      | { mode: "time", at: "YYYY-MM-DDTHH:MM" ET }
// Quick Draw returns the scheduled slots. Draw numbers are not part of the plan.
export function planQuickDrawSlip({ start = { mode: "next" }, games = 1, now = new Date() }) {
    const count = parseInt(games, 10) || 1;
    const capError = gamesError("quickdraw", count);
    if (capError) return { ok: false, error: capError };
    const next = nextQuickDrawSlotAfter(now);
    let first = next;
    let offsetFromNext = 0;
    if (start.mode === "offset") {
        const offset = parseInt(start.offset, 10);
        if (!Number.isInteger(offset) || offset < 1 || offset > MAX_QUICK_DRAW_OFFSET) {
            return { ok: false, error: `Pick an upcoming draw from 1 to ${MAX_QUICK_DRAW_OFFSET}.` };
        }
        for (let i = 1; i < offset; i++) first = nextQuickDrawSlotAfter(first);
        offsetFromNext = offset - 1;
    } else if (start.mode === "time") {
        const at = parseEtLocal(start.at);
        if (!at) return { ok: false, error: "Pick a start date and time." };
        if (at.getTime() - now.getTime() > MAX_QUICK_DRAW_START_DAYS * 86400000) {
            return { ok: false, error: `Pick a start time within ${MAX_QUICK_DRAW_START_DAYS} days.` };
        }
        if (at.getTime() > now.getTime()) {
            first = nextQuickDrawSlotAfter(new Date(at.getTime() - 1));
            let cursor = next;
            while (cursor.getTime() < first.getTime()) {
                cursor = nextQuickDrawSlotAfter(cursor);
                offsetFromNext += 1;
            }
        } else {
            return { ok: false, error: "Pick a start time after now." };
        }
    }
    const slots = quickDrawSlots(first, count);
    return { ok: true, game: "quickdraw", games: count, first: slots[0], last: slots[slots.length - 1], slots, offsetFromNext };
}

export function weeklyStartChoices(game, now = new Date(), count = WEEKLY_START_CHOICES) {
    return upcomingWeeklyDraws(game, now, count);
}

// startDate: ET YYYY-MM-DD of an upcoming draw, or empty for the next draw.
export function planWeeklySlip({ game, startDate = "", games = 1, now = new Date() }) {
    const count = parseInt(games, 10) || 1;
    const capError = gamesError(game, count);
    if (capError) return { ok: false, error: capError };
    const choices = weeklyStartChoices(game, now);
    if (choices.length === 0) return { ok: false, error: "The draw schedule is unavailable." };
    let begin = choices[0];
    if (startDate) {
        const found = choices.find((instant) => etDateKey(instant) === startDate);
        if (!found) return { ok: false, error: "Pick one of the upcoming draw dates." };
        begin = found;
    }
    const slots = upcomingWeeklyDraws(game, new Date(begin.getTime() - 1), count);
    if (slots.length < count) return { ok: false, error: "The draw schedule is unavailable." };
    return {
        ok: true,
        game,
        games: count,
        first: slots[0],
        last: slots[slots.length - 1],
        slots,
        drawDates: slots.map(etDateKey)
    };
}

// Matches entered numbers against loaded draws, newest first.
export function checkPastDraws({ game, numbers, bonus = null, draws, lookback }) {
    if (!Array.isArray(draws) || draws.length === 0) return { ok: false, reason: "unavailable" };
    const usable = draws.filter((row) => rowFitsEra(game, row));
    if (usable.length === 0) return { ok: false, reason: "unavailable" };
    const size = Math.min(Math.max(1, parseInt(lookback, 10) || usable.length), usable.length);
    const slice = usable.slice(0, size);
    const played = numbers.map(Number);
    const weekly = game !== "quickdraw";
    const perDraw = slice.map((row) => {
        const winning = (row.winning_numbers || []).map(Number);
        const matched = played.filter((n) => winning.includes(n));
        const bonusHit = weekly && bonus !== null && row.bonus_number != null && Number(row.bonus_number) === Number(bonus);
        return {
            drawNumber: row.draw_number,
            drawDate: row.draw_date || null,
            drawAt: row.draw_at || null,
            matched,
            hits: matched.length,
            bonus: bonusHit,
            label: weekly ? weeklyHitLabel(game, matched.length, bonusHit) : `${matched.length}/${played.length}`
        };
    });
    let best = perDraw[0];
    perDraw.forEach((entry) => {
        if (entry.hits > best.hits || (entry.hits === best.hits && entry.bonus && !best.bonus)) best = entry;
    });
    const atLeast = [];
    for (let n = 1; n <= played.length; n++) {
        atLeast.push({ n, draws: perDraw.filter((entry) => entry.hits >= n).length });
    }
    return {
        ok: true,
        rows: slice,
        checked: perDraw.length,
        perDraw,
        best,
        atLeast,
        bonusDraws: weekly ? perDraw.filter((entry) => entry.bonus).length : null
    };
}
