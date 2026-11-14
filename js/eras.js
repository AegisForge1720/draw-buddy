// Draw-matrix eras, so a stored draw is checked against the range of its own era.

// Mega Millions matrix by draw date (first draw date of each era, ET).
// Only eras confirmed by megamillions.com are listed:
// - 5/75 + 1/15 from the October 22, 2013 drawing
//   (megamillions.com/news/2013/mega-millions-to-become-even-more-mega-beginning.aspx)
// - 5/70 + 1/25 from the change that began October 28, 2017
//   (megamillions.com/News/2017/Mega-Millions-enhanced-Starting-jackpots-increase.aspx)
// - 5/70 + 1/24 from the April 8, 2025 drawing
//   (megamillions.com/News/2025/New-Mega-Millions%C2%AE-arrives-in-April.aspx)
// Draws before October 19, 2013 have no confirmed range here, so they are not range-checked.
export const MEGA_MILLIONS_ERAS = [
    { from: "2013-10-19", whiteMax: 75, bonusMax: 15 },
    { from: "2017-10-28", whiteMax: 70, bonusMax: 25 },
    { from: "2025-04-05", whiteMax: 70, bonusMax: 24 }
];

export function megaMillionsEra(drawDate) {
    if (typeof drawDate !== "string") return null;
    let era = null;
    MEGA_MILLIONS_ERAS.forEach((entry) => {
        if (drawDate >= entry.from) era = entry;
    });
    return era;
}

// False when a stored row is outside its own era's confirmed range.
export function rowFitsEra(game, row) {
    if (game !== "megamillions" || !row) return true;
    const era = megaMillionsEra(row.draw_date);
    if (!era) return true;
    const whites = (row.winning_numbers || []).map(Number);
    if (whites.some((n) => !Number.isInteger(n) || n < 1 || n > era.whiteMax)) return false;
    const bonus = Number(row.bonus_number);
    return Number.isInteger(bonus) && bonus >= 1 && bonus <= era.bonusMax;
}
