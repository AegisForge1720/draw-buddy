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
  check("public wording: drop happens once the day's official results are posted", w.sub.includes("The balls drop here once the day's official results are posted, usually early the next morning.") && !/as soon as/.test(w.sub), w.sub);
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
// ===== Always-available dropper (Andrew, Nov 25 2026: "Draw Buddy needs to be able to have the ball dropper at all times.") =====
const SHOTS = process.env.BD_SHOTS || ""; // optional folder for phone-size screenshots of each state
const shot = async (p, name) => { if (!SHOTS) return; await p.evaluate(() => { const b = document.getElementById("balldrop"); if (b && !b.hidden) b.scrollIntoView({ block: "start" }); window.scrollBy(0, -(document.querySelector("header")?.getBoundingClientRect().height || 0) - 8); }); await p.waitForTimeout(400); await p.screenshot({ path: `${SHOTS}/${name}.png` }); };
const BANNED = /\b(live|real-time|win|wins|won|winning|jackpot)\b|®/i;
const card = p => p.evaluate(() => ({ hidden: document.getElementById("balldrop").hidden, folded: document.getElementById("bd-body").hidden, mode: previewBdMode, title: document.getElementById("bd-title").innerText, mini: document.getElementById("bd-mini").innerText, sub: document.getElementById("bd-sub").innerText, text: document.getElementById("balldrop").innerText, go: document.getElementById("bd-replay").hidden ? null : document.getElementById("bd-replay-go").innerText, back: !document.getElementById("bd-replay-back").hidden, x: !document.getElementById("bd-x").hidden, result: document.getElementById("bd-result").innerText }));
const waitDone = async p => { await p.waitForFunction(() => !previewBdBusy && /Ball 20 of 20/.test(document.getElementById("bd-count").innerText), null, { timeout: 40000 }); await p.waitForTimeout(300); };
{ // no number set logged: the card is there, with the most recent posted draw ready to drop
  const { c, p, errs } = await open();
  const stored = await p.evaluate(() => previewStoredQd.rows.map(r => ({ n: Number(r.draw_number), nums: r.winning_numbers.map(Number).sort((a, b) => a - b), date: r.draw_date })));
  const newest = stored[0];
  const s = await card(p);
  check("always: card shows on Quick Draw with no number set logged", !s.hidden && !s.folded && s.mode === "idle", JSON.stringify(s));
  check("always: labeled as the most recent posted draw, with its draw number and draw date", s.mini.includes(`Most recent posted draw #${newest.n}`) && s.sub.includes(`draw #${newest.n}`) && /draw date [A-Z][a-z]{2} \d{1,2}, \d{4}/.test(s.sub) && s.sub.includes("data.ny.gov"), s.mini + " | " + s.sub);
  check("always: one tap to drop the balls", s.go === "▶ Drop the balls" && !s.x, JSON.stringify(s.go));
  check("always: idle card copy has no banned words", !BANNED.test(s.text), s.text);
  await shot(p, "1-idle-most-recent-posted");
  await p.click("#bd-replay-go"); await p.waitForTimeout(3500);
  const m = await card(p);
  check("replay: balls drop for the most recent posted draw", m.mode === "replay" && m.title.includes(`Replay · Draw #${newest.n}`) && /Ball \d+ of 20/.test(m.mini) && m.sub.startsWith(`Most recent posted draw #${newest.n}`) && m.go === null, JSON.stringify(m));
  check("replay: the 'Your numbers' block and the direction log are hidden", await p.evaluate(() => document.getElementById("bd-your-block").hidden && document.getElementById("bd-dir-block").hidden));
  await shot(p, "2-replay-dropping");
  await waitDone(p);
  const d = await card(p);
  check("replay: ends with the stored official numbers, no prize or grading", d.result.includes(`Replay of posted draw #${newest.n}: ${newest.nums.join(", ")}.`) && !/Prize/.test(d.result) && d.go === `↻ Replay draw #${newest.n}`, JSON.stringify(d));
  check("replay: lit cells match the stored numbers", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("#bd-grid .bd-lit")].map(e => Number(e.dataset.n)).sort((a, b) => a - b))) === JSON.stringify(newest.nums));
  check("replay: never writes to the wheel direction log", await p.evaluate(() => previewBdWheelDraw === null));
  check("replay copy has no banned words", !BANNED.test(d.text), d.text);
  await shot(p, "3-replay-done");
  await p.waitForTimeout(11000);
  check("replay result stays up (not replaced by the idle card on the next check)", (await card(p)).mode === "replay");
  await p.selectOption("#bd-replay-pick", String(stored[2].n));
  check("replay picker: any recent posted draw", (await card(p)).go === `▶ Replay draw #${stored[2].n}`);
  await p.click("#bd-replay-go"); await p.waitForTimeout(1500);
  const o = await card(p);
  check("replay of an older posted draw is labeled 'Posted draw', not most recent", o.title.includes(`Draw #${stored[2].n}`) && o.sub.startsWith(`Posted draw #${stored[2].n}`), o.sub);
  await waitDone(p);
  await p.click("#bd-x").catch(() => {}); // hidden in replay: the card can only be folded
  await p.click("#bd-toggle"); await p.waitForTimeout(300);
  const f = await card(p);
  check("folding keeps the card available (one line)", !f.hidden && f.folded, JSON.stringify(f));
  await p.evaluate(() => switchGameProfile("powerball")); await p.waitForTimeout(1500);
  check("other games: the Quick Draw dropper card is not shown", (await card(p)).hidden);
  await p.evaluate(() => switchGameProfile("quickdraw")); await p.waitForTimeout(1500);
  const back = await card(p);
  check("back on Quick Draw: the card is there again", !back.hidden, JSON.stringify(back));
  check("no page errors (always)", !errs.length, errs.join(" | ")); await c.close();
}
{ // number set logged for the next draw (not posted yet): wait card + watch the most recent posted draw meanwhile
  const { c, p, errs } = await open();
  const np = await p.evaluate(() => previewNextPurchasable(0).number);
  const newest = await p.evaluate(() => Number(previewStoredQd.rows[0].draw_number));
  await p.evaluate(s => { sessionTickets.push(s); saveHistoryArchive(); }, slip(np));
  await p.waitForTimeout(3000);
  const w = await card(p);
  check("waiting: tracking card keeps the public wording and offers the drop", w.mode === "wait" && w.title.includes(`#${np}`) && w.sub.includes("The balls drop here once the day's official results are posted, usually early the next morning.") && w.go === "▶ Drop the balls", JSON.stringify(w));
  await shot(p, "4-waiting-with-drop-button");
  await p.click("#bd-replay-go"); await waitDone(p);
  const r = await card(p);
  check("waiting: replay shows the most recent posted draw, labeled", r.mode === "replay" && r.sub.startsWith(`Most recent posted draw #${newest}`) && r.result.includes("Your logged number sets are checked automatically once their draw is posted."), JSON.stringify(r));
  await p.waitForTimeout(11000);
  const r2 = await card(p);
  check("waiting: 'Back to your number set' is offered after the replay", r2.mode === "replay" && r2.back, JSON.stringify(r2));
  check("waiting: the replay did not grade the number set", await p.evaluate(n => sessionTickets.filter(t => t.draw === n).every(t => t.hits === "Pending" && !(t.gradedDraws || []).length), np));
  await shot(p, "5-waiting-replay-done-back");
  await p.click("#bd-replay-back"); await p.waitForTimeout(2500);
  check("back: returns to the tracking card", (await card(p)).mode === "wait");
  await p.click("#bd-x"); await p.waitForTimeout(500);
  const x = await card(p);
  check("waiting ✕: card folds to the one-line dropper instead of disappearing", !x.hidden && x.folded && x.mode === "idle", JSON.stringify(x));
  await shot(p, "6-folded-after-dismiss");
  check("no page errors (waiting)", !errs.length, errs.join(" | ")); await c.close();
}
{ // covered posted draw still drops automatically, then the dropper stays available
  const { c, p, errs } = await open();
  const newest = await p.evaluate(() => Number(cachedDraws[0].draw_number));
  await p.evaluate(s => { sessionTickets.push(s); saveHistoryArchive(); }, slip(newest));
  await p.waitForFunction(() => previewBdMode === "qd", null, { timeout: 15000 });
  await waitDone(p); await p.waitForTimeout(3000);
  const q = await card(p);
  check("auto check: the number set's posted draw drops and is checked as before", q.mode === "qd" && q.title.includes(`Draw #${newest}`) && /hits|match/.test(q.text) && q.x, JSON.stringify(q).slice(0, 400));
  check("auto check: replay is still offered after the result", q.go !== null, String(q.go));
  await shot(p, "7-auto-check-result");
  check("no page errors (auto)", !errs.length, errs.join(" | ")); await c.close();
}
{ // private preview path (/preview-api answers with same-day unofficial rows): the dropper still uses only stored official rows
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await c.addInitScript(() => { localStorage.setItem("draw_buddy_age_ok", String(Date.now())); });
  const p = await c.newPage();
  await p.route("**/preview-api/quickdraw/recent", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ draws: [{ drawNumber: 9999999, numbers: Array.from({ length: 20 }, (_, i) => i + 1), extra: 1, drawDate: "2026-11-25", drawAtEt: new Date().toISOString() }] }) }));
  await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(5000);
  const st = await p.evaluate(() => ({ ok: previewApiOk, first: previewBdReplayRows[0] && Number(previewBdReplayRows[0].draw_number), stored: Number(previewStoredQd.rows[0].draw_number), unofficial: previewBdReplayRows.some(r => r.unofficial) }));
  check("preview path: replay rows are the stored official rows, never the same-day feed rows", st.ok && st.first === st.stored && st.first !== 9999999 && !st.unofficial, JSON.stringify(st));
  await c.close();
}
await b.close();
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.info ? "  (" + r.info + ")" : ""}`);
const pass = results.filter(r => r.ok).length; console.log(`${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
