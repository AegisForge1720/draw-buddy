// Regression (Nov 16 field test): a LOGGED Quick Draw ticket that is in play must
// (1) show a "waiting for results" Ball Drop panel until NY Lottery posts its draw,
// (2) start the ball drop by itself once that draw posts (no reload, no re-log),
// (3) catch up on a covered draw that posted while the phone was locked.
// Real draws only: the "not posted yet" state is made by hiding the newest real row from the server reply.
// Usage: PREVIEW_PASS=... node tests/balldrop-logged.mjs http://127.0.0.1:8879/ [done.png] [waiting.png] [prize.png]
import { createRequire } from "module";
const require = createRequire("/workspace/tools/");
const { chromium } = require("playwright-core");
const url = process.argv[2] || "http://127.0.0.1:8879/";
const shot = process.argv[3] || null; // finished-drop screenshot
const shotWait = process.argv[4] || null; // waiting-state screenshot
const auth = "Basic " + Buffer.from("andrew:" + process.env.PREVIEW_PASS).toString("base64");
const recent = await (await fetch(url + "preview-api/quickdraw/recent", { headers: { Authorization: auth } })).json();
const rows = recent.draws; const newest = rows[0].drawNumber;
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const results = []; const check = (name, ok, info = "") => results.push({ name, ok: !!ok, info });
const slip = d => ({ pickName: "My Numbers", draw: d, endDraw: d, spot: 4, games: 1, wager: 1, costPerGame: 1, baseWager: 1, hasExtra: false, numbers: rows[0].numbers.slice(0, 2).concat([1, 80].filter(n => !rows[0].numbers.slice(0, 2).includes(n))).slice(0, 4), gradedDraws: [], bestHits: 0, winningGamesCount: 0, hits: "Pending", payout: 0, timestamp: new Date(Date.now() - 600000).toISOString(), manual: true });
async function page(tickets, hideNewest) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, httpCredentials: { username: "andrew", password: process.env.PREVIEW_PASS } });
  await c.addInitScript(t => { localStorage.setItem("draw_buddy_age_ok", String(Date.now())); localStorage.setItem("draw_buddy_pl_archive", JSON.stringify(t)); }, tickets);
  const p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
  const state = { hide: hideNewest };
  await p.route("**/preview-api/quickdraw/recent", async route => {
    const r = await route.fetch(); const j = await r.json();
    if (state.hide) j.draws = j.draws.filter(d => d.drawNumber !== newest);
    await route.fulfill({ response: r, json: j });
  });
  await p.goto(url, { waitUntil: "networkidle" });
  return { c, p, errs, state };
}
const bd = p => p.evaluate(() => ({ hidden: document.getElementById('balldrop').hidden, title: document.getElementById('bd-title').innerText, mini: document.getElementById('bd-mini').innerText, sub: document.getElementById('bd-sub').innerText, grid: !document.getElementById('bd-qd').hidden }));

// 1+2: ticket for the newest draw, which "hasn't posted yet", then posts.
{
  const { c, p, errs, state } = await page([slip(newest)], true);
  await p.waitForTimeout(6000);
  const w = await bd(p);
  check("waiting panel shows for in-play logged ticket", !w.hidden && w.title.includes(`#${newest}`) && /in play/.test(w.mini) && !w.grid, JSON.stringify(w));
  check("waiting copy has no 'live'/'win'", !/\b(live|win|wins|won)\b/i.test(w.sub + w.mini + w.title));
  const flow = await p.evaluate(() => { const box = document.getElementById('balldrop'), r = box.getBoundingClientRect(), h = document.querySelector('header').getBoundingClientRect();
    const order = (a, b) => !!(document.getElementById(a).compareDocumentPosition(document.getElementById(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { inHeader: !!box.closest('header'), inMain: !!box.closest('main'), afterHouse: order('house-lines', 'balldrop'), beforeGen: order('balldrop', 'qd-generator-card'), top: Math.round(r.top), bottom: Math.round(r.bottom), headerBottom: Math.round(h.bottom), inner: innerHeight }; });
  check("ball drop is an inline card in the page (not in the sticky header), under house lines, above Ticket Generator", !flow.inHeader && flow.inMain && flow.afterHouse && flow.beforeGen, JSON.stringify(flow));
  check("waiting card is on screen below the header", flow.top >= flow.headerBottom - 1 && flow.bottom <= flow.inner, JSON.stringify(flow));
  if (shotWait) await p.screenshot({ path: shotWait });
  const tm = await p.evaluate(() => { const np = previewNextPurchasable(0); return { mini: document.getElementById('bd-mini').innerText, sub: document.getElementById('bd-sub').innerText, delay: previewBdNextDelay(), waitAt: previewBdWaitAt, lag: previewPostLagS,
    header: document.getElementById('header-next-draw').innerText, np: np && np.number, cd: previewSecondsToNextDraw(), toSlot: np ? Math.round((np.slot - Date.now()) / 1000) : null, slotOk: np ? previewIsSlot(np.slot) : false }; });
  check("waiting copy names the draw time and the official-posted-data line; polls every 3 s once the draw time has passed", /waiting for NY Lottery/.test(tm.mini) && /Results from official posted data/.test(tm.sub) && /Checking for new results/.test(tm.sub) && tm.delay === 3000 && tm.waitAt <= Date.now(), JSON.stringify(tm));
  check("header next draw and countdown follow the 4-minute schedule", tm.header === `#${tm.np}` && tm.slotOk && Math.abs(tm.cd - tm.toSlot) <= 2, JSON.stringify(tm));
  state.hide = false;
  await p.waitForTimeout(5000);
  const d = await bd(p);
  // pacing: 20 balls + Extra wheel finish well inside the 4-minute cycle
  check("ball pacing: 20 balls in about 18 s", await p.evaluate(() => PREVIEW_BD_BALL_MS * 20 <= 30000 && PREVIEW_BD_BALL_MS * 20 >= 15000));
  check("ball drop starts by itself when the draw posts", !d.hidden && d.grid && d.title.includes(`#${newest}`) && /Ball \d+ of 20/.test(d.mini), JSON.stringify(d));
  await p.waitForTimeout(20000);
  if (shot) await p.screenshot({ path: shot });
  const fit = await p.evaluate(() => { const box = document.getElementById('balldrop'), b = document.getElementById('bd-body'); return { h: Math.round(box.getBoundingClientRect().height), top: Math.round(box.getBoundingClientRect().top), bottom: Math.round(box.getBoundingClientRect().bottom), avail: innerHeight - Math.round(document.querySelector('header').getBoundingClientRect().height), inner: innerHeight, sh: b.scrollHeight, ch: b.clientHeight, wheel: !document.getElementById('bd-wheel').hidden }; });
  check("390x844: finished drop (board + Extra wheel) fits below the header, fully on screen, no inner scroll", fit.wheel && fit.h <= fit.avail && fit.bottom <= fit.inner && fit.sh <= fit.ch + 1, JSON.stringify(fit));
  await p.setViewportSize({ width: 360, height: 740 }); await p.evaluate(() => previewBdFit()); await p.waitForTimeout(300);
  const fit2 = await p.evaluate(() => { const box = document.getElementById('balldrop'), b = document.getElementById('bd-body'); return { h: Math.round(box.getBoundingClientRect().height), avail: innerHeight - Math.round(document.querySelector('header').getBoundingClientRect().height), sh: b.scrollHeight, ch: b.clientHeight }; });
  check("360x740: finished drop fits below the header, no inner scroll", fit2.h <= fit2.avail && fit2.sh <= fit2.ch + 1, JSON.stringify(fit2));
  const pz = await p.evaluate(() => ({ amt: Array.from(document.querySelectorAll('#bd-mynums .bd-prize-amt')).map(e => e.textContent), res: document.getElementById('bd-result').innerText }));
  check("prize line shown for the logged ticket once the balls finish", pz.amt.length === 1 && /^(Prize: \$\d+\.\d\d|No prize this draw\.)$/.test(pz.amt[0]), JSON.stringify(pz));
  check("not-official line next to the amount, no win/jackpot wording", /Not official ticket validation\. Confirm prizes with the official lottery\./.test(pz.res) && !/\b(win|wins|winner|winning|jackpot|live)\b/i.test(pz.res + pz.amt.join(' ')), pz.res);
  const g = await p.evaluate(() => sessionTickets[0].gradedDraws);
  check("ticket graded for that draw", g.includes(newest), JSON.stringify(g));
  check("no page errors (1)", errs.length === 0, errs.join(" | "));
  await c.close();
}
// 4: logged 4-spot ticket (Extra on, $2/draw) holding 4 of the newest real draw's numbers: prize = official table x wager x Extra.
{
  const t = slip(newest); t.numbers = rows[0].numbers.slice(0, 4); t.spot = 4; t.baseWager = 2; t.hasExtra = true;
  const { c, p, errs } = await page([t], false);
  await p.waitForTimeout(29000);
  const r = await p.evaluate(() => ({ amt: Array.from(document.querySelectorAll('#bd-mynums .bd-prize-amt')).map(e => e.textContent), how: document.querySelector('#bd-mynums .bd-prize-how')?.textContent, tot: document.querySelector('#bd-result .bd-prize-total')?.textContent, expect: QD_PAYOUT_TABLE[4][4] * 2 * (Number(cachedDraws.concat(previewGradeDraws).find(d => d.draw_number == sessionTickets[0].draw)?.extra_multiplier) || 1), box: Math.round(document.getElementById('balldrop').getBoundingClientRect().height), avail: innerHeight - Math.round(document.querySelector('header').getBoundingClientRect().height), sh: document.getElementById('bd-body').scrollHeight, ch: document.getElementById('bd-body').clientHeight }));
  check("logged ticket with 4 of 4 shows 'Prize: $X' = table x $2 x Extra", r.amt[0] === `Prize: $${r.expect.toFixed(2)}` && r.tot === `Prize this draw: $${r.expect.toFixed(2)}`, JSON.stringify(r));
  check("prize card still fits 390x844 with no inner scroll", r.box <= r.avail && r.sh <= r.ch + 1, JSON.stringify(r));
  if (process.argv[5]) await p.screenshot({ path: process.argv[5] });
  check("no page errors (4)", errs.length === 0, errs.join(" | "));
  await c.close();
}
// 3: catch-up on a covered draw one back (posted while the phone was locked), if it posted < 15 min ago.
{
  const prev = rows[1]; const age = Date.now() - Date.parse(prev.drawAtEt);
  if (age < 14 * 60000) {
    const { c, p, errs } = await page([slip(prev.drawNumber)], false);
    await p.waitForTimeout(6000);
    const d = await bd(p);
    check("catch-up drop for a covered draw that posted while away", !d.hidden && d.grid && d.title.includes(`#${prev.drawNumber}`), JSON.stringify(d));
    check("no page errors (3)", errs.length === 0, errs.join(" | "));
    await c.close();
  } else check("catch-up drop (skipped: previous draw older than 14 min)", true);
}
await b.close();
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.info !== "" ? "  (" + r.info + ")" : ""}`);
process.exit(results.every(r => r.ok) ? 0 : 1);
