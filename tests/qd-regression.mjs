// Quick Draw regression: the QD screen must behave the same before and after the all-games work.
// Usage: PREVIEW_PASS=... node tests/qd-regression.mjs http://127.0.0.1:8881/
import { createRequire } from "module";
const require = createRequire("/workspace/tools/");
const { chromium } = require("playwright-core");
const url = process.argv[2] || "http://127.0.0.1:8881/";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, httpCredentials: { username: "andrew", password: process.env.PREVIEW_PASS } });
const p = await c.newPage(); p.setDefaultTimeout(30000);
const errors = []; p.on("pageerror", e => errors.push(String(e).slice(0, 200)));
p.on("console", m => { if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
p.on("dialog", d => d.accept());
const results = []; const check = (name, ok, info = "") => { results.push({ name, ok: !!ok, info }); };
await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(6000);
const st = await p.evaluate(() => ({ game: activeGameKey, draws: cachedDraws.length, heat: document.querySelectorAll('#heatmap-grid > *').length, venue: getComputedStyle(document.getElementById('quickdraw-venue-section')).display, picks: !document.getElementById('four-picks-panel').hidden, countdown: document.getElementById('header-countdown').innerText }));
check("starts on Quick Draw", st.game === "quickdraw", st.game);
check("Quick Draw history loaded", st.draws > 0, st.draws);
check("heatmap has 80 cells", st.heat === 80, st.heat);
check("venue hub visible on QD", st.venue !== "none", st.venue);
check("auto picks panel visible", st.picks);
check("countdown ticking", /\d/.test(st.countdown), st.countdown);
for (const mode of ["hits", "best", "one", "jackpot"]) {
  await p.click(`#auto-grid [data-auto="${mode}"]`); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => ({ shown: !document.getElementById('play-card').classList.contains('hidden'), nums: (lastGeneratedNumbers || []).length, spot: document.getElementById('spot-tier').value }));
  check(`QD ${mode} pick fills Your Ticket`, r.shown && r.nums > 0 && r.nums === Number(r.spot), JSON.stringify(r));
}
const fns = await p.evaluate(() => ['previewBdAnimate', 'previewBdCheck', 'previewModeBuild', 'previewBacktest', 'generateTicket', 'logTicketToCloud', 'renderHeatmap'].filter(f => typeof window[f] !== 'function'));
check("QD functions present", fns.length === 0, fns.join(","));
// Switch away and back (if the picker has other games) and confirm QD still works.
const others = await p.evaluate(() => Array.from(document.querySelectorAll('#game-picker button[id^="game-btn-"]')).map(b => b.id.replace('game-btn-', '')).filter(k => k !== 'quickdraw'));
for (const k of others) { await p.click(`#game-btn-${k}`); await p.waitForTimeout(1500); }
await p.click("#game-btn-quickdraw"); await p.waitForTimeout(4000);
const back = await p.evaluate(() => ({ game: activeGameKey, heat: document.querySelectorAll('#heatmap-grid > *').length, venue: getComputedStyle(document.getElementById('quickdraw-venue-section')).display, picks: !document.getElementById('four-picks-panel').hidden, spotOpts: document.getElementById('spot-tier').options.length }));
check("back on QD after visiting other games", back.game === "quickdraw" && back.heat === 80 && back.venue !== "none" && back.picks && back.spotOpts === 10, JSON.stringify(back) + " visited=" + others.join(","));
await p.click(`#auto-grid [data-auto="hits"]`); await p.waitForTimeout(2500);
const again = await p.evaluate(() => (lastGeneratedNumbers || []).length);
check("QD pick works after switching back", again > 0, again);
check("no page errors", errors.length === 0, errors.join(" | "));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.info !== "" ? "  (" + r.info + ")" : ""}`);
const failed = results.filter(r => !r.ok).length; console.log(`${results.length - failed}/${results.length} passed`);
await b.close(); process.exit(failed ? 1 : 0);
