// Engine tests for the all-games work. Real data only: rows are read from the Supabase tables
// (public read, publishable key that is already in the app). Run: node tests/engine.test.mjs
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const E = require("../js/drawgames-engine.js");
const SB = "https://kcvtuzadkyripylluqlj.supabase.co/rest/v1/", KEY = "sb_publishable_540NEFDiVfOYxHeRyemjjg_Lrrce0PA";
let pass = 0, fail = 0; const ok = (name, cond, info = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info !== "" ? "  (" + info + ")" : ""}`); };
async function rows(g) {
  const G = E.GAMES[g];
  const q = G.table === "ny_draw_history"
    ? `ny_draw_history?select=draw_key,draw_date,session,winning_numbers,bonus_number,booster&game=eq.${g}&draw_date=gte.${G.era}&order=draw_key.desc&limit=1000`
    : `${G.table}?select=draw_number,draw_date,winning_numbers,bonus_number,extra_multiplier&draw_date=gte.${G.era}&order=draw_date.desc&limit=1000`;
  for (let i = 0; i < 5; i++) { try { const r = await fetch(SB + q, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (r.ok) return (await r.json()).map(x => ({ key: x.draw_key ?? x.draw_number, date: x.draw_date, session: x.session || "main", nums: x.winning_numbers.map(Number), bonus: x.bonus_number ?? null, mult: x.extra_multiplier ?? null, booster: x.booster ?? null })); } catch (e) {} await new Promise(r => setTimeout(r, 1500)); }
  throw new Error("load failed " + g);
}
// Official odds (NY prize charts)
const near = (a, b, tol = 0.02) => Math.abs(a - b) / b < tol;
const anyOdds = g => 1 / Object.keys(E.GAMES[g].prizes).reduce((s, k) => s + E.tierProb(E.GAMES[g], k), 0);
ok("Powerball overall odds 1 in 24.87", near(anyOdds("powerball"), 24.87, 0.002), anyOdds("powerball").toFixed(3));
ok("Mega Millions overall odds 1 in 23", near(anyOdds("megamillions"), 23.07, 0.01), anyOdds("megamillions").toFixed(3));
ok("Millionaire for Life overall odds 1 in 8.47", near(anyOdds("millionaire"), 8.47, 0.005), anyOdds("millionaire").toFixed(3));
ok("Pick 10 overall odds 1 in 17", near(anyOdds("pick10"), 16.94, 0.01), anyOdds("pick10").toFixed(3));
ok("NY Lotto overall odds 1 in 46 per $1 (two plays)", near(anyOdds("nylotto") / 2, 46, 0.01), (anyOdds("nylotto") / 2).toFixed(2));
ok("Powerball jackpot odds 1 in 292,201,338", Math.round(1 / E.tierProb(E.GAMES.powerball, "5b")) === 292201338);
ok("Mega Millions jackpot odds 1 in 290,472,336", Math.round(1 / E.tierProb(E.GAMES.megamillions, "5b")) === 290472336);
ok("Millionaire for Life top odds 1 in 22,910,580", Math.round(1 / E.tierProb(E.GAMES.millionaire, "5b")) === 22910580);
ok("Pick 10 top odds 1 in 8,911,711", Math.round(1 / E.tierProb(E.GAMES.pick10, "10")) === 8911711);
ok("NY Lotto jackpot odds 1 in 45,057,474", Math.round(1 / E.tierProb(E.GAMES.nylotto, "6")) === 45057474);
ok("Take 5 top odds 1 in 575,757", Math.round(1 / E.tierProb(E.GAMES.take5, "5")) === 575757);
// Digit plays (official $1 prizes)
ok("Numbers straight $500, 1 in 1,000", E.digitPlay("numbers", "straight", [1, 2, 3], 1).top === 500 && E.digitPlay("numbers", "straight", [1, 2, 3], 1).pWin === 0.001);
ok("Numbers 6-way box $80", E.digitPlay("numbers", "box", [1, 2, 3], 1).top === 80);
ok("Win 4 24-way box $200", E.digitPlay("win4", "box", [1, 2, 3, 4], 1).top === 200);
ok("Win 4 4-way box $1,200 (50c: $600), per nylottery.ny.gov", E.digitPlay("win4", "box", [1, 1, 1, 2], 1).top === 1200 && E.digitPlay("win4", "box", [1, 1, 1, 2], 0.5).top === 600);
ok("Win 4 Straight/4-way Box $3,100 exact / $600 any order", E.digitPlay("win4", "straightbox", [1, 1, 1, 2], 1).prizeOn([1, 1, 1, 2]) === 3100 && E.digitPlay("win4", "straightbox", [1, 1, 1, 2], 1).prizeOn([2, 1, 1, 1]) === 600);
ok("Box not offered for 111", E.digitPlay("numbers", "box", [1, 1, 1], 1) === null);
ok("Back pair checks last two digits", E.digitPlay("win4", "backpair", [9, 9, 3, 4], 1).prizeOn([0, 0, 3, 4]) === 50);
// Ralph review 2026-11-16
const MM = E.GAMES.megamillions;
const mmRow = { nums: [1, 2, 3, 4, 5], bonus: 9, mult: 5 };
ok("Mega Millions: history graded at base prizes, never a draw-level multiplier", E.grade(MM, { nums: [1, 2, 3, 40, 50], bonus: 9 }, mmRow).cash === 200 && /base prize/.test(E.grade(MM, { nums: [1, 2, 3, 40, 50], bonus: 9 }, mmRow).text));
ok("Grading wording: no 'Won $' / 'would have won'", E.ORDER.every(k => { const G = E.GAMES[k]; const t = G.kind === "digits" ? { playType: "straight", digits: [1, 2, 3, 4].slice(0, G.digits), wager: 1 } : { nums: Array.from({ length: G.pick }, (_, i) => i + 1), bonus: 1 }; const row = G.kind === "digits" ? { nums: [1, 2, 3, 4].slice(0, G.digits) } : { nums: Array.from({ length: G.drawn }, (_, i) => i + 1), bonus: 1 }; const tx = E.grade(G, t, row).text; return !/\bwon\b|would have/i.test(tx) && /tier/.test(tx); }));
const OFFICIAL_MAX = { powerball: 39, megamillions: 26, millionaire: 28, nylotto: 26, take5: 7, pick10: 7 };
for (const k of E.ORDER) { const G = E.GAMES[k]; const caps = [E.drawCap(G, "any"), E.drawCap(G, "main"), E.drawCap(G, "midday"), E.drawCap(G, "evening")];
  const ok1 = G.kind === "digits" ? E.drawCap(G, "midday") <= 7 && E.drawCap(G, "evening") <= 7 && E.drawCap(G, "any") / 2 <= 7 : caps.every(c => c <= OFFICIAL_MAX[k]);
  ok(`${G.name}: draws-in-a-row app cap within the official limit (${caps.join("/")})`, ok1 && G.official && G.official.src); }
ok("Pick 10 and Take 5 capped at 7 draws", E.drawCap(E.GAMES.pick10, "main") === 7 && E.drawCap(E.GAMES.take5, "any") === 7);
ok("Sources cite official sites, not nylottery.org", E.ORDER.every(k => !/nylottery\.org/i.test(E.GAMES[k].source) && /nylottery\.ny\.gov|gaming\.ny\.gov/.test(E.GAMES[k].source)));
ok("Power Play note: 10X only at $150 million or less + table disclosure", /\$150 million or less/.test(E.GAMES.powerball.options[0].note) && /10X is available/.test(E.GAMES.powerball.options[0].note));
ok("1 Spot subtitle matches the code (overdue main numbers)", ["powerball", "megamillions", "millionaire"].every(k => /most overdue/.test(E.modeMeaning(E.GAMES[k]).one) && !/Hits ranking|can win/.test(E.modeMeaning(E.GAMES[k]).one)));
ok("Double Play off: Jackpot Pick meaning has no Double Play", !/Double Play/.test(E.modeMeaning(E.GAMES.powerball, { doublePlay: false }).jackpot));
const FL = require("../js/flags.js");
ok("Flags: public build defaults are all off", Object.values(FL.PUBLIC_DEFAULTS).every(v => v === false) && FL.buildMode(null) === "public" && Object.values(FL.resolve(null)).every(v => v === false));
ok("Flags: private preview turns on only Double Play + result notices", FL.PRIVATE_PREVIEW.doublePlay && FL.PRIVATE_PREVIEW.resultNotices && !FL.PRIVATE_PREVIEW.partnerLinks && !FL.PRIVATE_PREVIEW.shareQr && !FL.PRIVATE_PREVIEW.tierSwitcher && !FL.PRIVATE_PREVIEW.pricing);
ok("House copy is exact", FL.COPY.RG === "18+. Gambling problem? Call 1-877-8-HOPENY or text HOPENY (467369)." && FL.COPY.NA === "Not affiliated with any lottery." && FL.COPY.D1.startsWith("Past results don't predict future draws.") && FL.COPY.ENTITY === "NAV Analytics LLC");
// Schedule: Sun Nov 15, 2026 9:10 PM ET
const now = Date.UTC(2026, 10, 16, 2, 10);
const nd = g => { const d = E.nextDraws(E.GAMES[g], now, 1)[0]; const p = E.etParts(d.at); return `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][p.wd]} ${p.h}:${String(p.mi).padStart(2, "0")} ${d.session}`; };
ok("next Powerball Mon 22:59", nd("powerball") === "Mon 22:59 main", nd("powerball"));
ok("next Mega Millions Tue 23:00", nd("megamillions") === "Tue 23:00 main", nd("megamillions"));
ok("next Millionaire for Life Sun 23:15", nd("millionaire") === "Sun 23:15 main", nd("millionaire"));
ok("next NY Lotto Wed 20:15", nd("nylotto") === "Wed 20:15 main", nd("nylotto"));
ok("next Take 5 Sun 22:30 evening", nd("take5") === "Sun 22:30 evening", nd("take5"));
ok("next Pick 10 Mon 20:30", nd("pick10") === "Mon 20:30 main", nd("pick10"));
ok("next Numbers Sun 22:30 evening", nd("numbers") === "Sun 22:30 evening", nd("numbers"));
// Auto picks on real data
for (const g of E.ORDER) {
  const G = E.GAMES[g], R = await rows(g);
  ok(`${G.name}: official rows loaded (current format)`, R.length >= 100, R.length + " rows, newest " + (R[0] && R[0].date));
  ok(`${G.name}: rows are in range`, R.every(r => G.kind === "digits" ? r.nums.length === G.digits && r.nums.every(d => d >= 0 && d <= 9) : r.nums.length === G.drawn && r.nums.every(n => n >= 1 && n <= G.max) && (!G.bonus || !G.bonus.picked || (r.bonus >= 1 && r.bonus <= G.bonus.max))));
  for (const m of ["hits", "best", "one", "jackpot"]) {
    const t0 = Date.now(); const pk = G.kind === "digits" ? E.pickDigits(g, R, m, 1, "any") : E.pickLotto(G, R, m, "any", { doublePlay: true }); const ms = Date.now() - t0;
    if (pk.error) { ok(`${G.name} ${m}`, false, pk.error); continue; }
    let valid;
    if (G.kind === "digits") valid = pk.digits.length === G.digits && pk.digits.every(d => d >= 0 && d <= 9) && E.digitPlay(g, pk.playType, pk.digits, pk.wager);
    else valid = pk.nums.length === G.pick && new Set(pk.nums).size === G.pick && pk.nums.every(n => n >= 1 && n <= G.max) && (!G.bonus || !G.bonus.picked || (pk.bonus >= 1 && pk.bonus <= G.bonus.max));
    const again = G.kind === "digits" ? E.pickDigits(g, R, m, 1) : E.pickLotto(G, R, m);
    const same = JSON.stringify(again.nums || again.digits) === JSON.stringify(pk.nums || pk.digits);
    ok(`${G.name} ${m}: valid ticket, deterministic, explained, ${ms} ms`, valid && same && pk.why.length >= 3 && pk.draws >= 1 && pk.draws <= E.drawCap(G, "any") && ms < 4000,
      (pk.nums ? pk.nums.join(" ") + (pk.bonus != null ? " + " + pk.bonus : "") : pk.digits.join("") + " " + pk.playType) + ` | N=${pk.lookback} draws=${pk.draws}` + (pk.opts && (pk.opts.powerplay || pk.opts.doubleplay) ? ` | ${pk.opts.powerplay ? "PP " : ""}${pk.opts.doubleplay ? "DP" : ""}` : ""));
  }
  // grading uses the real newest row
  const t = G.kind === "digits" ? { playType: "straight", digits: R[0].nums, wager: 1 } : { nums: R[0].nums.slice(0, G.pick), bonus: R[0].bonus };
  const gr = E.grade(G, t, R[0]);
  ok(`${G.name}: grading the newest draw against itself is a top-tier match`, G.kind === "digits" ? gr.cash === (g === "numbers" ? 500 : 5000) : gr.h === G.pick, gr.text);
}
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
