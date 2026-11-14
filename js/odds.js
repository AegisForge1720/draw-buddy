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

// Each number's chance on an independent draw. Quick Draw is 20/80.
export function expectedOneStepRepeatRate(drawnCount, totalNumbers) {
    const drawn = Number(drawnCount);
    const total = Number(totalNumbers);
    if (!Number.isFinite(drawn) || !Number.isFinite(total) || total <= 0 || drawn < 0 || drawn > total) return null;
    return drawn / total;
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

// Chance a specific number is drawn again if each draw is an independent
// sample of `drawnCount` numbers from `totalNumbers`.
// Quick Draw draws 20 of 80, so this is 0.25. Powerball white balls are 5 of 69.
// Mega Millions white balls are 5 of 70.
export function expectedRepeatRate(drawnCount, totalNumbers) {
    const drawn = Number(drawnCount);
    const total = Number(totalNumbers);
    if (!(total > 0) || !(drawn >= 0) || drawn > total) return null;
    return drawn / total;
}
