// Regression (Andrew, Nov 24 2026 field test on the public site): on a public build (GitHub Pages: no /preview-api,
// it 404s) a logged Quick Draw number set must still bring up the Ball Drop card at game start, and a covered draw
// that is posted in the stored results (quickdraw_history) must start the ball drop. Real stored draws only.
// Usage: node tests/balldrop-public.mjs http://127.0.0.1:8971/draw-buddy/   (any static server, no auth)
import { createRequire } from "module";
const require = createRequire("/workspace/tools/");
const { chromium } = require("playwright-core");
const url = process.argv[2] || "http://127.0.0.1:8971/draw-buddy/";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const results = []; const check = (name, ok, info = "") => results.push({ name, ok: !!ok, info });
const slip = d => ({ game: "quickdraw", pickName: "My Numbers", draw: d, endDraw: d, spot: 4, games: 1, wager: 1, costPerGame: 1, baseWager: 1, hasExtra: false, numbers: [5, 12, 33, 71], gradedDraws: [], bestHits: 0, winningGamesCount: 0, hits: "Pending", payout: 0, timestamp: new Date().toISOString(), manual: true });
const bd = p => p.evaluate(() => ({ hidden: document.getElementById("balldrop").hidden, title: document.getElementById("bd-title").innerText, mini: document.getElementById("bd-mini").innerText, sub: document.getElementById("bd-sub").innerText, mode: previewBdMode }));
async function open() {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await c.addInitScript(() => { localStorage.setItem("draw_buddy_age_ok", String(Date.now())); });
  const p = await c.newPage(); const errs = [], api = [];
  p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
  p.on("request", r => { if (/preview-api/.test(r.url())) api.push(r.url()); });
  await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(4000);
  return { c, p, errs, api };
}
{ // game start: number set logged for the next draw
  const { c, p, errs, api } = await open();
  const np = await p.evaluate(() => previewNextPurchasable(0).number);
  await p.evaluate(s => { sessionTickets.push(s); saveHistoryArchive(); }, slip(np));
  await p.waitForTimeout(5000);
  const w = await bd(p);
  check("public build: Ball Drop card shows at game start for a logged Quick Draw number set", !w.hidden && w.mode === "wait" && w.title.includes(`#${np}`), JSON.stringify(w));
  check("waiting copy has no 'live'/'win'/'jackpot'", !/\b(live|real-time|win|wins|won|jackpot)\b/i.test(w.sub + w.mini + w.title));
  await p.waitForTimeout(12000);
  check("missing /preview-api is asked for once, not on every check", api.length <= 1, `${api.length} requests`);
  check("no page errors (start)", !errs.length, errs.join(" | ")); await c.close();
}
{ // drop: number set covering the newest stored draw
  const { c, p, errs } = await open();
  const newest = await p.evaluate(() => Number(cachedDraws[0].draw_number));
  await p.evaluate(s => { sessionTickets.push(s); saveHistoryArchive(); }, slip(newest));
  await p.waitForTimeout(6000);
  const m = await bd(p);
  check("public build: ball drop starts for a covered posted draw", !m.hidden && m.mode === "qd" && /Ball \d+ of 20/.test(m.mini), JSON.stringify(m));
  check("no page errors (drop)", !errs.length, errs.join(" | ")); await c.close();
}
await b.close();
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.info ? "  (" + r.info + ")" : ""}`);
const pass = results.filter(r => r.ok).length; console.log(`${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
