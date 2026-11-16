/* Draw Buddy: all NY draw games engine (preview). Pure math, no DOM, no network.
 * Real official history only: rows come from Supabase tables filled by ny-draws-ingest (data.ny.gov).
 * Nothing here predicts a draw. Every draw is independent; past results don't predict future draws.
 * Works in the browser (window.DGEngine) and in Node (module.exports) for tests. */
(function (root) {
  'use strict';
  const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };

  // ---------- Official game rules (NY). Sources noted per game; Ralph to review wording. ----------
  // Prize keys for lotto-style games: `${mainMatches}` or `${mainMatches}b` (bonus ball matched).
  // A prize value that is a string is not a fixed cash amount (jackpot / annuity / pari-mutuel).
  const GAMES = {
    powerball: {
      key: 'powerball', name: 'Powerball', kind: 'lotto', pick: 5, max: 69, drawn: 5,
      bonus: { name: 'Powerball', max: 26, picked: true },
      price: 2, priceNote: '$2 per play',
      options: [
        { key: 'powerplay', label: 'Power Play', cost: 1, note: 'Multiplies non-jackpot prizes 2X–10X (10X only when the jackpot is under $150 million). Match 5 becomes $2 million.' },
        { key: 'doubleplay', label: 'Double Play', cost: 1, note: 'Same numbers in a second drawing about 30 minutes later; $10 million top prize. NY since June 2, 2026. Double Play results are not in the data.ny.gov feed, so Draw Buddy has no Double Play history.' }
      ],
      schedule: [{ session: 'main', label: 'Mon/Wed/Sat 10:59 PM ET', days: [1, 3, 6], h: 22, m: 59, close: '10:00 PM ET' }],
      maxDraws: 10, table: 'powerball_history', era: '2015-10-07', eraNote: '5 of 1–69 + Powerball 1–26 since Oct 7, 2015',
      prizes: { '5b': 'Jackpot', '5': 1000000, '4b': 50000, '4': 100, '3b': 100, '3': 7, '2b': 7, '1b': 4, '0b': 4 },
      ppPrizes: { '5': 2000000 }, // Power Play: match 5 is a flat $2 million; other non-jackpot prizes × multiplier
      dpPrizes: { '5b': 10000000, '5': 500000, '4b': 50000, '4': 500, '3b': 500, '3': 20, '2b': 20, '1b': 10, '0b': 7 },
      // Power Play multiplier odds when 10X is available (official chart). History multipliers come from data.ny.gov.
      ppOdds: [[2, 1 / 1.79], [3, 1 / 3.31], [4, 1 / 14.33], [5, 1 / 21.5], [10, 1 / 43]],
      source: 'NY Lottery Powerball rules and prize chart; draws: data.ny.gov d6yy-54nr'
    },
    megamillions: {
      key: 'megamillions', name: 'Mega Millions', kind: 'lotto', pick: 5, max: 70, drawn: 5,
      bonus: { name: 'Mega Ball', max: 24, picked: true },
      price: 5, priceNote: '$5 per play (every ticket has a built-in 2X–10X multiplier; no Megaplier since Apr 8, 2025)',
      options: [],
      schedule: [{ session: 'main', label: 'Tue/Fri 11:00 PM ET', days: [2, 5], h: 23, m: 0, close: '10:00 PM ET' }],
      maxDraws: 10, table: 'megamillions_history', era: '2025-04-08', eraNote: '5 of 1–70 + Mega Ball 1–24 since Apr 8, 2025',
      prizes: { '5b': 'Jackpot', '5': 1000000, '4b': 10000, '4': 500, '3b': 200, '3': 10, '2b': 10, '1b': 7, '0b': 5 },
      multOdds: [[2, 1 / 2.13], [3, 1 / 3.2], [4, 1 / 8], [5, 1 / 16], [10, 1 / 32]], builtInMultiplier: true,
      source: 'Mega Millions rules (Apr 8, 2025 change) and NY prize chart; draws: data.ny.gov 5xaw-6ayf'
    },
    millionaire: {
      key: 'millionaire', name: 'Millionaire for Life', kind: 'lotto', pick: 5, max: 58, drawn: 5,
      bonus: { name: 'Millionaire Ball', max: 5, picked: true },
      price: 5, priceNote: '$5 per play', options: [],
      schedule: [{ session: 'main', label: 'Daily 11:15 PM ET', days: [0, 1, 2, 3, 4, 5, 6], h: 23, m: 15, close: '10:15 PM ET' }],
      maxDraws: 10, table: 'ny_draw_history', game: 'millionaire', era: '2026-02-22', eraNote: 'New game: first draw Feb 22, 2026 (replaced Cash4Life)',
      prizes: { '5b': '$1M a year for life', '5': '$100K a year for life', '4b': 7500, '4': 500, '3b': 250, '3': 50, '2b': 25, '2': 8, '1b': 8 },
      source: 'NYS Gaming Commission (Feb 12, 2026) prize chart; draws: data.ny.gov a4w9-a3tp'
    },
    nylotto: {
      key: 'nylotto', name: 'NY Lotto', kind: 'lotto', pick: 6, max: 59, drawn: 6,
      bonus: { name: 'Bonus', max: 59, picked: false }, // drawn from the remaining 53; only counts with 5 matches
      price: 0.5, minPlays: 2, priceNote: '$1 for two plays (minimum two)', options: [],
      schedule: [{ session: 'main', label: 'Wed/Sat 8:15 PM ET', days: [3, 6], h: 20, m: 15, close: '8:00 PM ET' }],
      maxDraws: 10, table: 'ny_draw_history', game: 'nylotto', era: '2001-09-12', eraNote: '6 of 1–59 + Bonus (all of the data.ny.gov history, since Sep 12, 2001)',
      prizes: { '6': 'Jackpot (pari-mutuel)', '5b': '2nd prize (pari-mutuel)', '5': '3rd prize (pari-mutuel)', '4': '4th prize (pari-mutuel)', '3': 1 },
      source: 'NY Lottery Lotto rules; draws: data.ny.gov 6nbc-h7bj'
    },
    take5: {
      key: 'take5', name: 'Take 5', kind: 'lotto', pick: 5, max: 39, drawn: 5, bonus: null,
      price: 1, priceNote: '$1 per play', options: [],
      schedule: [
        { session: 'midday', label: 'Midday 2:30 PM ET', days: [0, 1, 2, 3, 4, 5, 6], h: 14, m: 30, close: '2:20 PM ET' },
        { session: 'evening', label: 'Evening 10:30 PM ET', days: [0, 1, 2, 3, 4, 5, 6], h: 22, m: 30, close: '10:20 PM ET' }],
      maxDraws: 10, table: 'ny_draw_history', game: 'take5', era: '1992-01-17', eraNote: '5 of 1–39 (midday draws since Jul 26, 2021)',
      prizes: { '5': 'Top prize (pari-mutuel)', '4': 'pari-mutuel', '3': 'pari-mutuel', '2': 'Free Quick Pick' },
      source: 'NY Lottery Take 5 rules; draws: data.ny.gov dg63-4siq'
    },
    pick10: {
      key: 'pick10', name: 'Pick 10', kind: 'keno', pick: 10, max: 80, drawn: 20, bonus: null,
      price: 1, priceNote: '$1 per play', options: [],
      schedule: [{ session: 'main', label: 'Daily 8:30 PM ET', days: [0, 1, 2, 3, 4, 5, 6], h: 20, m: 30, close: '8:00 PM ET' }],
      maxDraws: 10, table: 'ny_draw_history', game: 'pick10', era: '1987-01-12', eraNote: '10 picked, 20 of 1–80 drawn (all history since 1987)',
      prizes: { '10': 500000, '9': 6000, '8': 300, '7': 40, '6': 10, '0': 4 },
      source: 'NY Lottery Pick 10 prize chart; draws: data.ny.gov bycu-cw7c'
    },
    numbers: {
      key: 'numbers', name: 'Numbers', kind: 'digits', digits: 3, bonus: null,
      wagers: [0.5, 1], price: 0.5, priceNote: '50¢ or $1 per play', options: [],
      schedule: [
        { session: 'midday', label: 'Midday 2:30 PM ET', days: [0, 1, 2, 3, 4, 5, 6], h: 14, m: 30, close: '2:15 PM ET' },
        { session: 'evening', label: 'Evening 10:30 PM ET', days: [0, 1, 2, 3, 4, 5, 6], h: 22, m: 30, close: '10:20 PM ET' }],
      maxDraws: 10, table: 'ny_draw_history', game: 'numbers', era: '1980-09-02', eraNote: '3 digits 0–9, midday since Dec 2, 2001',
      source: 'NY Lottery Numbers prize chart; draws: data.ny.gov hsys-3def'
    },
    win4: {
      key: 'win4', name: 'Win 4', kind: 'digits', digits: 4, bonus: null,
      wagers: [0.5, 1], price: 0.5, priceNote: '50¢ or $1 per play', options: [],
      schedule: [
        { session: 'midday', label: 'Midday 2:30 PM ET', days: [0, 1, 2, 3, 4, 5, 6], h: 14, m: 30, close: '2:15 PM ET' },
        { session: 'evening', label: 'Evening 10:30 PM ET', days: [0, 1, 2, 3, 4, 5, 6], h: 22, m: 30, close: '10:20 PM ET' }],
      maxDraws: 10, table: 'ny_draw_history', game: 'win4', era: '1981-07-21', eraNote: '4 digits 0–9, midday since Dec 2, 2001',
      source: 'NY Lottery Win 4 prize chart; draws: data.ny.gov hsys-3def'
    }
  };
  const ORDER = ['powerball', 'megamillions', 'millionaire', 'nylotto', 'take5', 'pick10', 'numbers', 'win4'];
  const RETIRED = { cash4life: 'Cash4Life is retired: its last draw was Feb 21, 2026 (data.ny.gov kwxv-fwze). Millionaire for Life replaced it.' };

  // ---------- Numbers / Win 4 play types (official $1 prizes; 50¢ pays half) ----------
  // ways = number of distinct orderings of the chosen digits.
  function digitWays(ds) { const c = {}; ds.forEach(d => c[d] = (c[d] || 0) + 1); let f = 1; for (let i = 2; i <= ds.length; i++) f *= i; Object.values(c).forEach(v => { for (let i = 2; i <= v; i++) f /= i; }); return f; }
  const NUM_BOX = { 3: 160, 6: 80 }, NUM_SB = { 3: [330, 80], 6: [290, 40] };
  const W4_BOX = { 4: 1198, 6: 800, 12: 400, 24: 200 }, W4_SB = { 4: [3099, 599], 6: [2900, 400], 12: [2700, 200], 24: [2600, 100] };
  // Returns { cost, prizeOn(drawnDigits) , pWin, label } for a $1 or 50¢ play.
  function digitPlay(game, type, ds, wager) {
    const n = game === 'numbers' ? 3 : 4, straightTop = n === 3 ? 500 : 5000, w = wager === 0.5 ? 0.5 : 1, ways = digitWays(ds), space = Math.pow(10, n);
    const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const sorted = a => a.slice().sort((x, y) => x - y);
    const anyOrder = (a, b) => same(sorted(a), sorted(b));
    const box = n === 3 ? NUM_BOX : W4_BOX, sb = n === 3 ? NUM_SB : W4_SB;
    if (type === 'straight') return { cost: w, pWin: 1 / space, top: straightTop * w, prizeOn: d => same(d, ds) ? straightTop * w : 0, label: 'Straight (exact order)' };
    if (type === 'box') {
      if (ways === 1) return null; // all digits the same: Box not offered
      const pz = box[ways] * w; return { cost: w, pWin: ways / space, top: pz, prizeOn: d => anyOrder(d, ds) ? pz : 0, label: `${ways}-Way Box (any order)` };
    }
    if (type === 'straightbox') {
      if (ways === 1) return null; const [ex, any] = sb[ways]; // $1 minimum play
      return { cost: 1, pWin: ways / space, top: ex, prizeOn: d => same(d, ds) ? ex : anyOrder(d, ds) ? any : 0, label: `${ways}-Way Straight/Box ($1)` };
    }
    if (type === 'combo') {
      return { cost: w * ways, pWin: ways / space, top: straightTop * w, prizeOn: d => anyOrder(d, ds) ? straightTop * w : 0, label: `${ways}-Way Combination ($${(w * ways).toFixed(2)})` };
    }
    if (type === 'frontpair' || type === 'backpair') {
      const pz = 50 * w, front = type === 'frontpair', idx = front ? [0, 1] : [n - 2, n - 1];
      return { cost: w, pWin: 1 / 100, top: pz, prizeOn: d => (d[idx[0]] === ds[idx[0]] && d[idx[1]] === ds[idx[1]]) ? pz : 0, label: front ? 'Front Pair' : 'Back Pair', pairIdx: idx };
    }
    return null;
  }
  const DIGIT_TYPES = ['straight', 'box', 'straightbox', 'combo', 'frontpair', 'backpair'];

  // ---------- Lotto-style math ----------
  // keno (Pick 10): pick 10, 20 drawn of 80: P(h) = C(20,h) C(60,10-h) / C(80,10)
  function pKeno(g, h) { return C(g.drawn, h) * C(g.max - g.drawn, g.pick - h) / C(g.max, g.pick); }
  function tierProb(g, key) {
    if (g.kind === 'keno') return pKeno(g, parseInt(key, 10));
    const h = parseInt(key, 10), b = key.endsWith('b');
    const pm = C(g.pick, h) * C(g.max - g.pick, g.pick - h) / C(g.max, g.pick);
    if (!g.bonus || !g.bonus.picked) {
      if (g.key === 'nylotto') { // Bonus drawn from the 53 remaining; matters only for 5 matches
        if (h === 5) { const pB = 1 / (g.max - g.pick); return b ? pm * pB : pm * (1 - pB); }
        return b ? 0 : pm;
      }
      return b ? 0 : pm;
    }
    const pb = 1 / g.bonus.max; return pm * (b ? pb : 1 - pb);
  }
  function multMean(odds) { let s = 0, w = 0; odds.forEach(([m, p]) => { s += m * p; w += p; }); return s / w; }
  // Fixed-cash return per $1 from the official prize chart (jackpots, annuities and pari-mutuel tiers count as $0).
  function fixedReturn(g, opts) {
    opts = opts || {}; let ev = 0, pAny = 0, cost = g.price * (g.minPlays || 1) / (g.minPlays || 1);
    const mm = g.builtInMultiplier ? multMean(g.multOdds) : 1, pp = opts.powerplay && g.ppOdds ? multMean(g.ppOdds) : 1;
    Object.keys(g.prizes).forEach(k => {
      const p = tierProb(g, k), v = g.prizes[k]; if (p > 0) pAny += p;
      if (typeof v !== 'number') return;
      let val = v * mm;
      if (opts.powerplay) val = (g.ppPrizes && g.ppPrizes[k]) ? g.ppPrizes[k] : v * pp;
      ev += p * val;
    });
    if (g.key === 'take5') pAny = ['5', '4', '3', '2'].reduce((s, k) => s + tierProb(g, k), 0);
    if (opts.powerplay) cost += 1;
    if (opts.doubleplay && g.dpPrizes) { Object.keys(g.dpPrizes).forEach(k => { ev += tierProb(g, k) * g.dpPrizes[k]; }); cost += 1; }
    return { ev, cost, perDollar: ev / cost, pAny };
  }
  // Official return per $1 of a digit play (exact odds).
  function digitReturnPer$(game, type, ds, wager) {
    const n = game === 'numbers' ? 3 : 4, pl = digitPlay(game, type, ds, wager); if (!pl) return null;
    if (type === 'straightbox') { const any = (n === 3 ? NUM_SB : W4_SB)[digitWays(ds)][1]; return (pl.top / Math.pow(10, n) + (pl.pWin - 1 / Math.pow(10, n)) * any) / pl.cost; }
    return pl.top * pl.pWin / pl.cost;
  }

  // ---------- History helpers ----------
  // rows: newest first, each { key, date, session, nums:[...], bonus, mult }
  function prefix(rows, size) {
    const P = [new Uint32Array(size + 1)];
    rows.forEach((r, i) => { const a = new Uint32Array(P[i]); r.nums.forEach(n => { if (n >= 0 && n <= size) a[n]++; }); P.push(a); });
    return P;
  }
  function prefixBonus(rows, size) {
    const P = [new Uint32Array(size + 1)];
    rows.forEach((r, i) => { const a = new Uint32Array(P[i]); if (r.bonus != null && r.bonus <= size) a[r.bonus]++; P.push(a); });
    return P;
  }
  function rankWindow(P, from, to, lo, hi) { const a = P[to], b = P[from], sc = []; for (let n = lo; n <= hi; n++) sc.push([n, a[n] - b[n]]); sc.sort((x, y) => y[1] - x[1] || x[0] - y[0]); return sc; }
  function topK(P, from, to, k, lo, hi) { return rankWindow(P, from, to, lo, hi).slice(0, k).map(x => x[0]).sort((x, y) => x - y); }
  function overdue(rows, lookback, k, lo, hi, exclude) {
    const slice = rows.slice(0, lookback), gap = {}, cnt = {};
    for (let i = lo; i <= hi; i++) { gap[i] = slice.length; cnt[i] = 0; }
    slice.forEach((d, idx) => d.nums.forEach(n => { if (cnt[n] === undefined) return; cnt[n]++; if (gap[n] === slice.length) gap[n] = idx; }));
    const ex = new Set(exclude || []);
    const nums = Object.keys(gap).map(Number).filter(n => !ex.has(n)).sort((a, b) => gap[b] - gap[a] || cnt[a] - cnt[b] || a - b).slice(0, k);
    return { nums: nums.slice().sort((a, b) => a - b), gaps: nums.map(n => gap[n]) };
  }
  function freq(rows, lookback, lo, hi, bonus) {
    const f = {}; for (let i = lo; i <= hi; i++) f[i] = 0;
    rows.slice(0, lookback).forEach(r => { if (bonus) { if (r.bonus != null && f[r.bonus] !== undefined) f[r.bonus]++; } else r.nums.forEach(n => { if (f[n] !== undefined) f[n]++; }); });
    return f;
  }
  const WINDOWS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300];
  const BT = 100, MIN_BT = 20;

  // Prize for one lotto ticket on one real draw (fixed cash only; jackpot-type tiers return their label).
  function lottoPrize(g, pick, bonus, row, opts) {
    opts = opts || {};
    const h = pick.filter(n => row.nums.includes(n)).length;
    let bHit = false;
    if (g.bonus && g.bonus.picked) bHit = bonus != null && row.bonus === bonus;
    else if (g.key === 'nylotto') bHit = h === 5 && pick.includes(row.bonus);
    const key = g.kind === 'keno' ? String(h) : (bHit ? h + 'b' : String(h));
    let v = g.prizes[key];
    if (v === undefined && g.kind !== 'keno' && bHit && g.prizes[String(h)] !== undefined && !(g.bonus && g.bonus.picked)) v = g.prizes[String(h)];
    let cash = typeof v === 'number' ? v : 0, label = typeof v === 'string' ? v : null;
    if (g.builtInMultiplier && cash) cash *= (row.mult || 1);
    if (opts.powerplay && cash && g.key === 'powerball') cash = (g.ppPrizes[key] || cash * (row.mult || 1));
    return { h, bHit, key, cash, label, won: cash > 0 || !!label };
  }

  // ---------- Auto picks (4 buttons, same idea as Quick Draw: frequency windows chosen by backtest) ----------
  const MODE_NAMES = { hits: '🎯 Hits Pick', best: '⚖️ Best Spot Pick', one: '1️⃣ 1 Spot Pick', jackpot: '🏆 Jackpot Pick' };
  function modeMeaning(g) {
    if (g.kind === 'digits') return {
      hits: 'Straight play: per position, the digit most drawn in the backtested window',
      best: 'Play type with the best official return per $1, then digits by backtest',
      one: 'Smallest real play: Front or Back Pair (2 digits), whichever backtested better',
      jackpot: '$1 Straight: the top prize for this game'
    };
    const b = g.bonus && g.bonus.picked ? g.bonus.name : null;
    return {
      hits: `Most-drawn numbers in the window that backtested the most matches${b ? `; ${b} by its own backtest` : ''}`,
      best: g.options.length ? 'Options with the best official fixed-prize return per $1, numbers scored by backtested prizes'
        : (g.prizes && Object.values(g.prizes).some(v => typeof v === 'number') ? 'Numbers scored by backtested fixed prizes (official chart)' : 'Numbers scored by how often the backtest won any prize tier'),
      one: b ? `Built around one ball: the ${b} that backtested best (it can win alone${g.prizes['0b'] ? `, $${g.prizes['0b']}` : ''}); main numbers from the Hits ranking`
        : 'Built around the one number that backtested best; the rest are the most overdue numbers',
      jackpot: `Scored for near-jackpot matches (${g.kind === 'keno' ? '8+' : (g.pick - 1) + '+'} of ${g.pick})${g.key === 'powerball' ? ' + Double Play for a second $10M top prize' : ''}`
    };
  }
  function lottoBacktest(g, rows, P, PB, scoreFn, fixedN, opts) {
    const lo = 1, hi = g.max, k = g.pick, bt = Math.min(BT, Math.max(0, rows.length - 5 - 1));
    if (bt < MIN_BT) return null;
    let best = null;
    const Ns = fixedN ? [fixedN] : WINDOWS.filter(N => N <= rows.length - bt);
    if (!Ns.length) Ns.push(Math.max(5, rows.length - bt));
    for (const N of Ns) {
      let tot = 0, hitsSum = 0, bHits = 0, won = 0, cash = 0, big = 0; const beat = [];
      const exp = g.kind === 'keno' ? g.pick * g.drawn / g.max : g.pick * g.pick / g.max;
      for (let t = 0; t < bt; t++) {
        if (t + 1 + N > rows.length) break;
        const pick = topK(P, t + 1, t + 1 + N, k, lo, hi);
        const bonus = (g.bonus && g.bonus.picked) ? topK(PB, t + 1, t + 1 + N, 1, 1, g.bonus.max)[0] : null;
        const pr = lottoPrize(g, pick, bonus, rows[t], opts);
        hitsSum += pr.h; if (pr.bHit) bHits++; if (pr.won) won++; cash += pr.cash; if (pr.h >= (g.kind === 'keno' ? 8 : g.pick - 1)) big++;
        beat.push(pr.h > exp);
        tot += scoreFn(pr);
      }
      const cand = { N, bt, score: tot / bt, avgHits: hitsSum / bt, bonusRate: bHits / bt, prizeRate: won / bt, cashPer$: cash / bt / ((opts && opts.cost) || g.price), big, beat, exp };
      if (!best || cand.score > best.score + 1e-12) best = cand;
    }
    return best;
  }
  function bonusBacktest(g, rows, PB) {
    const bt = Math.min(BT, Math.max(0, rows.length - 6)); if (!g.bonus || !g.bonus.picked || bt < MIN_BT) return null;
    let best = null;
    for (const N of WINDOWS.filter(N => N <= rows.length - bt)) {
      let hit = 0; for (let t = 0; t < bt; t++) { const b = topK(PB, t + 1, t + 1 + N, 1, 1, g.bonus.max)[0]; if (rows[t].bonus === b) hit++; }
      const cand = { N, bt, rate: hit / bt }; if (!best || cand.rate > best.rate + 1e-12) best = cand;
    }
    return best;
  }
  function pickLotto(g, rows, mode) {
    if (!rows || rows.length < MIN_BT + 10) return { error: `Not enough official ${g.name} draws in the current format to backtest (${rows ? rows.length : 0} loaded; need ${MIN_BT + 10}).` };
    const P = prefix(rows, g.max), PB = g.bonus && g.bonus.picked ? prefixBonus(rows, g.bonus.max) : null;
    const opts = {}, why = [];
    // Options (only Powerball has paid add-ons in NY).
    if (g.key === 'powerball') {
      const base = fixedReturn(g, {}), pp = fixedReturn(g, { powerplay: true }), dp = fixedReturn(g, { doubleplay: true }), both = fixedReturn(g, { powerplay: true, doubleplay: true });
      if (mode === 'best') {
        const c = [['none', base], ['powerplay', pp], ['doubleplay', dp], ['both', both]].sort((a, b) => b[1].perDollar - a[1].perDollar)[0];
        if (c[0] === 'powerplay' || c[0] === 'both') opts.powerplay = true; if (c[0] === 'doubleplay' || c[0] === 'both') opts.doubleplay = true;
        why.push(`Options: ${c[0] === 'none' ? 'none' : c[0] === 'both' ? 'Power Play + Double Play' : c[0] === 'powerplay' ? 'Power Play' : 'Double Play'}: best fixed-prize return per $1 (${(c[1].perDollar * 100).toFixed(1)}¢; plain $2 play ${(base.perDollar * 100).toFixed(1)}¢). Jackpots not counted.`);
      } else if (mode === 'jackpot') { opts.doubleplay = true; why.push('Double Play on: a second drawing with a fixed $10 million top prize (+$1).'); }
    }
    opts.cost = g.price * (g.minPlays || 1) + (opts.powerplay ? 1 : 0) + (opts.doubleplay ? 1 : 0);
    const fixedCash = Object.values(g.prizes).some(v => typeof v === 'number' && v > 1);
    const scoreFor = {
      hits: pr => pr.h,
      one: pr => pr.h,
      best: fixedCash ? (pr => pr.cash) : (pr => (pr.won ? 1 : 0) + pr.h * 1e-3),
      jackpot: pr => (pr.h >= (g.kind === 'keno' ? 8 : g.pick - 1) ? 1000 : 0) + (pr.bHit ? 50 : 0) + pr.h
    };
    const bt = lottoBacktest(g, rows, P, PB, scoreFor[mode], null, opts);
    if (!bt) return { error: 'Not enough draws to backtest.' };
    let nums = topK(P, 0, bt.N, g.pick, 1, g.max), bonus = null, bb = null;
    if (PB) { bb = bonusBacktest(g, rows, PB); bonus = topK(PB, 0, (bb ? bb.N : bt.N), 1, 1, g.bonus.max)[0]; }
    if (mode === 'one') {
      if (PB) {
        const od = overdue(rows, 100, g.pick, 1, g.max, []);
        nums = od.nums;
        why.push(`1 Spot: ${g.bonus.name} ${bonus} is the one ball: most drawn ${g.bonus.name} in the last ${bb.N} draws (window chosen by backtest: right ${(bb.rate * 100).toFixed(0)}% of ${bb.bt} draws vs ${(100 / g.bonus.max).toFixed(1)}% by chance).`);
        why.push(`Main numbers: the ${g.pick} most overdue in the last 100 draws (longest gaps: ${od.gaps.slice(0, 3).map(x => x + ' draws').join(', ')}…), so they don't repeat the Hits Pick.`);
      } else {
        // The single number that backtested best: for each window, how often its #1 number was drawn next.
        let best = null; const btn = Math.min(BT, rows.length - 6);
        for (const N of WINDOWS.filter(N => N <= rows.length - btn)) { let hit = 0; for (let t = 0; t < btn; t++) { const one = topK(P, t + 1, t + 1 + N, 1, 1, g.max)[0]; if (rows[t].nums.includes(one)) hit++; } if (!best || hit / btn > best.rate + 1e-12) best = { N, rate: hit / btn, bt: btn }; }
        const anchor = topK(P, 0, best.N, 1, 1, g.max)[0];
        const od = overdue(rows, 100, g.pick - 1, 1, g.max, [anchor]);
        nums = [anchor].concat(od.nums).sort((a, b) => a - b);
        why.push(`1 Spot: ${anchor} is the anchor: #1 in the last ${best.N} draws (backtest: drawn next ${(best.rate * 100).toFixed(0)}% of ${best.bt} draws vs ${(g.drawn / g.max * 100).toFixed(0)}% by chance). The other ${g.pick - 1}: most overdue in the last 100 draws (${od.nums.map((n, i) => `${n}: ${od.gaps[i]} draws ago`).slice(0, 3).join(', ')}…).`);
      }
    }
    // Number of draws: consecutive newest backtest draws the window's pick beat the chance average (1 to maxDraws), same rule as Quick Draw's Games.
    let run = 0; while (run < bt.beat.length && bt.beat[run]) run++;
    const draws = Math.max(1, Math.min(g.maxDraws, run));
    why.unshift(`Lookback: ${bt.N} draws (backtested windows ${WINDOWS[0]}–${WINDOWS[WINDOWS.length - 1]} on the newest ${bt.bt} official draws)`);
    why.push(mode === 'jackpot' ? `Backtest: ${bt.big} of ${bt.bt} draws had ${g.kind === 'keno' ? '8+' : (g.pick - 1) + '+'} matches; avg ${bt.avgHits.toFixed(2)} matches vs ${bt.exp.toFixed(2)} by chance`
      : mode === 'best' && fixedCash ? `Backtest: $${bt.cashPer$.toFixed(2)} fixed prizes back per $1; a prize in ${(bt.prizeRate * 100).toFixed(0)}% of draws`
        : `Backtest: avg ${bt.avgHits.toFixed(2)} matches vs ${bt.exp.toFixed(2)} by chance; a prize in ${(bt.prizeRate * 100).toFixed(0)}% of draws`);
    if (PB && mode !== 'one') why.push(`${g.bonus.name} ${bonus}: most drawn in the last ${bb ? bb.N : bt.N} draws (backtest ${(bb ? bb.rate * 100 : 0).toFixed(0)}% vs ${(100 / g.bonus.max).toFixed(1)}% by chance)`);
    why.push(run ? `Draws ${draws}: the pick beat chance in the newest ${run} backtest draw${run === 1 ? '' : 's'} in a row (1–${g.maxDraws})` : 'Draws 1: the pick did not beat chance in the newest backtest draw');
    const fr = fixedReturn(g, opts);
    return { mode, name: MODE_NAMES[mode], nums, bonus, opts: { powerplay: !!opts.powerplay, doubleplay: !!opts.doubleplay }, draws, lookback: bt.N, plays: g.minPlays || 1,
      costPerDraw: opts.cost, why, backtest: { N: bt.N, bt: bt.bt, avgHits: bt.avgHits, exp: bt.exp, prizeRate: bt.prizeRate, big: bt.big, cashPer$: bt.cashPer$ }, odds: fr };
  }

  // Digits: per-position frequency windows.
  function digitPrefix(rows, n) { const P = []; for (let pos = 0; pos < n; pos++) { const a = [new Uint32Array(10)]; rows.forEach((r, i) => { const x = new Uint32Array(a[i]); x[r.nums[pos]]++; a.push(x); }); P.push(a); } return P; }
  function digitTop(P, pos, from, to) { const a = P[pos][to], b = P[pos][from]; let best = 0, bv = -1; for (let d = 0; d <= 9; d++) { const v = a[d] - b[d]; if (v > bv) { bv = v; best = d; } } return best; }
  function digitOverallTop(rows, from, to, k) { const c = new Array(10).fill(0); rows.slice(from, to).forEach(r => r.nums.forEach(d => c[d]++)); return c.map((v, d) => [d, v]).sort((x, y) => y[1] - x[1] || x[0] - y[0]).slice(0, k).map(x => x[0]); }
  function pickDigits(gk, rows, mode, wager) {
    const n = gk === 'numbers' ? 3 : 4, g = GAMES[gk]; wager = wager || 1;
    if (!rows || rows.length < MIN_BT + 10) return { error: `Not enough official ${g.name} draws to backtest.` };
    const P = digitPrefix(rows, n), bt = Math.min(BT, rows.length - 6), why = [];
    const build = (type, N, t) => {
      if (type === 'box' || type === 'straightbox' || type === 'combo') { const top = digitOverallTop(rows, t + 1, t + 1 + N, n); if (new Set(top).size === 1) top[n - 1] = (top[0] + 1) % 10; return top.sort((a, b) => a - b); }
      const ds = []; for (let pos = 0; pos < n; pos++) ds.push(digitTop(P, pos, t + 1, t + 1 + N)); return ds;
    };
    const evalType = (type, N) => {
      let cash = 0, wins = 0, posHits = 0, cost = 0; const beat = [];
      for (let t = 0; t < bt; t++) {
        if (t + 1 + N > rows.length) break;
        const ds = build(type, N, t), pl = digitPlay(gk, type, ds, wager); if (!pl) return null;
        const pz = pl.prizeOn(rows[t].nums); cash += pz; cost += pl.cost; if (pz) wins++;
        const ph = ds.filter((d, i) => rows[t].nums[i] === d).length; posHits += ph; beat.push(ph > n / 10);
      }
      return { type, N, bt, cash, cost, per$: cash / cost, winRate: wins / bt, posHits: posHits / bt, beat };
    };
    let type, chosen = null;
    const Ns = WINDOWS.filter(N => N <= rows.length - bt);
    const bestN = (type, score) => { let b = null; for (const N of Ns) { const r = evalType(type, N); if (r && (!b || score(r) > score(b) + 1e-12)) b = r; } return b; };
    if (mode === 'hits') { type = 'straight'; chosen = bestN('straight', r => r.posHits); why.push(`Straight: digit by position, most drawn in the last ${chosen.N} draws (backtest avg ${chosen.posHits.toFixed(2)} digits in the right spot vs ${(n / 10).toFixed(1)} by chance)`); }
    else if (mode === 'jackpot') { type = 'straight'; wager = 1; chosen = bestN('straight', r => r.cash * 1000 + r.posHits); why.push(`$1 Straight: top prize $${n === 3 ? 500 : '5,000'} (odds 1 in ${Math.pow(10, n).toLocaleString()})`); }
    else if (mode === 'one') {
      const f = bestN('frontpair', r => r.winRate), b = bestN('backpair', r => r.winRate);
      chosen = (b && (!f || b.winRate > f.winRate + 1e-12)) ? b : f; type = chosen.type;
      why.push(`${type === 'frontpair' ? 'Front' : 'Back'} Pair: 2 digits in order; backtest won ${(chosen.winRate * 100).toFixed(1)}% of ${chosen.bt} draws vs 1.0% by chance (Front ${(f.winRate * 100).toFixed(1)}%, Back ${(b.winRate * 100).toFixed(1)}%)`);
    } else {
      // Best Spot: full-number play type (Straight, Box, Straight/Box, Combination) with the best official return per $1
      // (exact odds); a tie goes to the higher chance of winning. Pairs are the 1 Spot button. Then the digits are backtested.
      const sample = [1, 2, 3, 4].slice(0, n), cands = [];
      for (const t of ['straight', 'box', 'straightbox', 'combo']) { const pl = digitPlay(gk, t, sample, wager); if (!pl) continue; cands.push({ t, ret: digitReturnPer$(gk, t, sample, wager), p: pl.pWin, label: pl.label }); }
      const topRet = Math.max(...cands.map(c => c.ret)); const tied = cands.filter(c => Math.abs(c.ret - topRet) < 1e-9).sort((a, b) => b.p - a.p);
      type = tied[0].t; chosen = bestN(type, r => r.per$ * 1000 + r.winRate);
      why.push(`${tied[0].label}: best official return per $1 among full-number plays (${(topRet * 100).toFixed(0)}¢ per $1${tied.length > 1 ? `, tied with ${tied.slice(1).map(c => c.label).join(', ')}; the higher chance of winning breaks the tie` : ''})`);
    }
    if (!chosen) return { error: 'Backtest unavailable.' };
    const ds = build(type, chosen.N, -1), pl = digitPlay(gk, type, ds, wager);
    let run = 0; while (run < chosen.beat.length && chosen.beat[run]) run++;
    const draws = Math.max(1, Math.min(g.maxDraws, run));
    why.unshift(`Lookback: ${chosen.N} draws (backtested on the newest ${chosen.bt} official draws)`);
    why.push(`Backtest: $${chosen.per$.toFixed(2)} back per $1; won ${(chosen.winRate * 100).toFixed(1)}% of draws`);
    why.push(run ? `Draws ${draws}: beat chance in the newest ${run} backtest draw${run === 1 ? '' : 's'} in a row (1–${g.maxDraws})` : 'Draws 1: did not beat chance in the newest backtest draw');
    return { mode, name: MODE_NAMES[mode], digits: ds, playType: type, playLabel: pl.label, wager: pl.cost === 1 && type === 'straightbox' ? 1 : wager, costPerDraw: pl.cost, draws, lookback: chosen.N, why,
      odds: { pAny: pl.pWin, top: pl.top, perDollar: digitReturnPer$(gk, type, ds, wager) }, backtest: { N: chosen.N, bt: chosen.bt, per$: chosen.per$, winRate: chosen.winRate } };
  }

  // ---------- Schedule (ET) ----------
  function etParts(ms) { const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' }).formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; }); return { y: +p.year, mo: +p.month, d: +p.day, h: (+p.hour) % 24, mi: +p.minute, s: +p.second, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) }; }
  function etToMs(y, mo, d, h, mi) { // ET wall time -> instant (DST-correct by trying both offsets)
    for (const off of [4, 5]) { const t = Date.UTC(y, mo - 1, d, h + off, mi); const q = etParts(t); if (q.y === y && q.mo === mo && q.d === d && q.h === h && q.mi === mi) return t; }
    return Date.UTC(y, mo - 1, d, h + 5, mi);
  }
  function nextDraws(g, nowMs, count) {
    const out = [], now = etParts(nowMs);
    for (let add = 0; add < 15 && out.length < (count || 1) * 4; add++) {
      const base = Date.UTC(now.y, now.mo - 1, now.d + add), dd = new Date(base), y = dd.getUTCFullYear(), mo = dd.getUTCMonth() + 1, d = dd.getUTCDate(), wd = dd.getUTCDay();
      g.schedule.forEach(s => { if (!s.days.includes(wd)) return; const t = etToMs(y, mo, d, s.h, s.m); if (t > nowMs) out.push({ at: t, session: s.session, label: s.label, close: s.close, date: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` }); });
    }
    return out.sort((a, b) => a.at - b.at).slice(0, count || 1);
  }

  // ---------- Ticket grading against real rows ----------
  function grade(g, t, row) {
    if (g.kind === 'digits') { const pl = digitPlay(g.key, t.playType, t.digits, t.wager); if (!pl) return null; const cash = pl.prizeOn(row.nums); return { cash, won: cash > 0, text: cash ? `Won $${cash.toFixed(2)} (${pl.label})` : `No prize (${pl.label})` }; }
    const pr = lottoPrize(g, t.nums, t.bonus, row, t.opts || {});
    const txt = `${pr.h} of ${g.pick}${pr.bHit ? ' + ' + (g.bonus ? g.bonus.name : 'Bonus') : ''}`;
    return { ...pr, text: pr.label ? `${txt}: ${pr.label}` : pr.cash ? `${txt}: $${pr.cash.toLocaleString()}${g.builtInMultiplier && row.mult ? ` (incl. ${row.mult}X)` : ''}` : `${txt}: no prize` };
  }

  const api = { GAMES, ORDER, RETIRED, C, tierProb, fixedReturn, digitPlay, digitReturnPer$, digitWays, DIGIT_TYPES, prefix, topK, overdue, freq, lottoPrize, pickLotto, pickDigits, modeMeaning, MODE_NAMES, nextDraws, etParts, etToMs, grade, WINDOWS, BT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DGEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
