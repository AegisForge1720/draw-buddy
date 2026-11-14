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
