// Headless check of each game's settings limits vs the official NY Lottery limits (checked Nov 16, 2026).
// Usage: PREVIEW_PASS=... node tests/limits-ui.mjs URL [shots]
import { createRequire } from "module";
const require = createRequire("/workspace/tools/");
const { chromium } = require("playwright-core");
const url = process.argv[2] || "http://127.0.0.1:8879/", shots = process.argv[3] === "shots";
// Official consecutive-draw limits: per draw for one-session games; 7 days per session for two-session games (Both = 14 draws).
const OFFICIAL = { powerball: 39, megamillions: 26, millionaire: 28, nylotto: 26, pick10: 7, take5: { one: 7, any: 14 }, numbers: { one: 7, any: 14 }, win4: { one: 7, any: 14 } };
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, httpCredentials: { username: "andrew", password: process.env.PREVIEW_PASS } });
await c.addInitScript(() => { try { localStorage.setItem('draw_buddy_age_ok', String(Date.now())); } catch (e) {} });
const p = await c.newPage(); p.setDefaultTimeout(30000); const errors = []; p.on("pageerror", e => errors.push(String(e).slice(0, 200)));
let pass = 0, fail = 0; const ok = (n, cnd, i = "") => { cnd ? pass++ : fail++; console.log(`${cnd ? "PASS" : "FAIL"}  ${n}${i !== "" ? "  (" + i + ")" : ""}`); };
await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
const opts = id => p.evaluate(id => { const el = document.getElementById(id); return el ? Array.from(el.options).map(o => o.value) : null; }, id);
const draws = () => p.evaluate(() => { const el = document.getElementById('dg-s-draws'); return { n: el.options.length, v: Number(el.value), label: el.closest('label').innerText }; });
for (const g of ["powerball", "megamillions", "millionaire", "nylotto", "take5", "pick10", "numbers", "win4"]) {
  await p.click(`#game-btn-${g}`);
  await p.waitForFunction(() => /official draws loaded|Data unavailable/.test(document.getElementById('dg-data')?.innerText || ''), null, { timeout: 30000 });
  const sessions = (await opts('dg-s-session')) || ['main'];
  for (const s of sessions) {
    if (s !== 'main') { await p.selectOption('#dg-s-session', s); await p.waitForTimeout(400); }
    const lim = typeof OFFICIAL[g] === 'number' ? OFFICIAL[g] : (s === 'any' ? OFFICIAL[g].any : OFFICIAL[g].one);
    const d = await draws();
    ok(`${g} [${s}]: settings render, draws menu 1..${d.n} within official ${lim}, label shows official limit`, d.n >= 1 && d.n <= lim && /app limit/i.test(d.label) && /official: up to \d+ consecutive/i.test(d.label), d.label.replace(/\s+/g, ' ').slice(0, 90));
    for (const m of ["hits", "best", "one", "jackpot"]) {
      await p.click(`#dg-auto-grid [data-dgmode="${m}"]`);
      await p.waitForFunction(() => !document.getElementById('dg-ticket').hidden, null, { timeout: 20000 });
      const t = await draws(), st = await p.evaluate(() => ({ type: document.getElementById('dg-s-type')?.value, wager: document.getElementById('dg-s-wager')?.value, ticket: document.getElementById('dg-ticket').innerText }));
      const okDigits = !["numbers", "win4"].includes(g) || (["straight", "box", "straightbox", "combo", "frontpair", "backpair"].includes(st.type) && ["0.5", "1"].includes(st.wager) && !/not offered/.test(st.ticket));
      ok(`${g} [${s}] ${m}: auto pick draws ${t.v} <= ${lim}${okDigits && st.type ? `, ${st.type} @ ${st.wager}` : ''}`, t.v >= 1 && t.v <= t.n && t.v <= lim && okDigits);
    }
  }
  if (["numbers", "win4"].includes(g)) {
    const types = await opts('dg-s-type'), wagers = await opts('dg-s-wager');
    ok(`${g}: play types = Straight, Box, Straight/Box, Combination, Front Pair, Back Pair`, JSON.stringify(types) === JSON.stringify(["straight", "box", "straightbox", "combo", "frontpair", "backpair"]), types.join(","));
    ok(`${g}: wagers = 50c, $1`, JSON.stringify(wagers) === JSON.stringify(["0.5", "1"]), wagers.join(","));
  }
  if (shots && ["take5", "numbers", "win4"].includes(g)) {
    if (g !== 'take5') { await p.selectOption('#dg-s-type', 'straight'); await p.selectOption('#dg-s-wager', '1'); }
    await p.selectOption('#dg-s-session', 'evening'); await p.waitForTimeout(500);
    await p.locator('#dg-settings').screenshot({ path: `/workspace/debug/drawbuddy-limits-${g}-one-session.png` });
    await p.selectOption('#dg-s-session', 'any'); await p.waitForTimeout(500);
    await p.locator('#dg-settings').screenshot({ path: `/workspace/debug/drawbuddy-limits-${g}-either-session.png` });
  }
}
ok("no page errors", errors.length === 0, errors.join(" | "));
console.log(`${pass}/${pass + fail} passed`); await b.close(); process.exit(fail ? 1 : 0);
