// UI test + screenshots for every non-Quick Draw game. Usage: PREVIEW_PASS=... node tests/allgames-ui.mjs URL [shots]
import { createRequire } from "module";
const require = createRequire("/workspace/tools/");
const { chromium } = require("playwright-core");
const url = process.argv[2] || "http://127.0.0.1:8881/", shots = process.argv[3] === "shots";
const GAMES = (process.env.GAMES || "powerball,megamillions,millionaire,nylotto,take5,pick10,numbers,win4").split(",");
const BANNED = /\blive\b|real-time|realtime|play along|Penny Arcade|®|™/i;
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
let pass = 0, fail = 0; const ok = (n, c, i = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${i !== "" ? "  (" + i + ")" : ""}`); };
for (const vp of shots ? [{ w: 390, h: 844, tag: "390", mobile: true }, { w: 1280, h: 900, tag: "desktop", mobile: false }] : [{ w: 390, h: 844, tag: "390", mobile: true }]) {
  const c = await b.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.mobile ? 2 : 1, isMobile: vp.mobile, hasTouch: vp.mobile, httpCredentials: { username: "andrew", password: process.env.PREVIEW_PASS } });
  await c.addInitScript(() => { try { if (!sessionStorage.getItem('dgt')) { localStorage.removeItem('draw_buddy_dg_tickets'); sessionStorage.setItem('dgt', '1'); } } catch (e) {} });
  const p = await c.newPage(); p.setDefaultTimeout(30000); const errors = [];
  p.on("pageerror", e => errors.push(String(e).slice(0, 200))); p.on("console", m => { if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  p.on("dialog", d => d.accept());
  await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(3000);
  for (const g of GAMES) {
    await p.click(`#game-btn-${g}`);
    await p.waitForFunction(() => /official draws loaded|Data unavailable/.test(document.getElementById('dg-data')?.innerText || ''), null, { timeout: 30000 });
    const st = await p.evaluate(() => ({ panel: !document.getElementById('dg-panel').hidden, qd: getComputedStyle(document.getElementById('qd-generator-card')).display, venue: getComputedStyle(document.getElementById('quickdraw-venue-section')).display, data: document.getElementById('dg-data').innerText, count: document.getElementById('dg-count').innerText, header: document.getElementById('header-countdown').innerText, eng: document.getElementById('header-engine-mode').innerText }));
    ok(`${g} [${vp.tag}]: panel shown, Quick Draw + venues hidden`, st.panel && st.qd === "none" && st.venue === "none", `${st.qd}/${st.venue}`);
    ok(`${g} [${vp.tag}]: official history loaded`, /official draws loaded/.test(st.data), st.data.slice(0, 90));
    ok(`${g} [${vp.tag}]: countdown + header`, /\d/.test(st.count) && /\d/.test(st.header), `${st.count} | header ${st.header} | ${st.eng}`);
    await p.waitForFunction(() => /Official result|vs this result/.test(document.getElementById('dg-bd-result').innerText), null, { timeout: 40000 });
    const balls = await p.evaluate(() => document.querySelectorAll('#dg-bd-stage .dg-ball, #dg-bd-stage .bd-cell.bd-lit').length);
    ok(`${g} [${vp.tag}]: ball drop replayed the latest official result`, balls > 0, balls + " balls");
    if (shots) { await p.locator('#dg-head').screenshot({ path: `/workspace/debug/allgames-${g}-${vp.tag}-0-header.png` }).catch(() => {}); await p.locator('#dg-balldrop').screenshot({ path: `/workspace/debug/allgames-${g}-${vp.tag}-1-balldrop.png` }); }
    for (const m of ["hits", "best", "one", "jackpot"]) {
      await p.click(`#dg-auto-grid [data-dgmode="${m}"]`);
      await p.waitForFunction(() => !document.getElementById('dg-ticket').hidden, null, { timeout: 20000 });
      const t = await p.evaluate(() => ({ txt: document.getElementById('dg-ticket').innerText, st: document.getElementById('dg-auto-status').innerText }));
      ok(`${g} [${vp.tag}] ${m}: ticket with disclaimer`, /Past results don't predict future draws/.test(t.txt) && !/Not enough/.test(t.st), t.st.slice(0, 80));
      if (shots && m === "best") { await p.locator('#dg-settings').screenshot({ path: `/workspace/debug/allgames-${g}-${vp.tag}-2-settings.png` }); }
      if (shots && m === "hits") { await p.locator('#dg-ticket').screenshot({ path: `/workspace/debug/allgames-${g}-${vp.tag}-3-autopick-hits.png` }); }
    }
    if (shots) {
      await p.locator('#dg-auto-grid').screenshot({ path: `/workspace/debug/allgames-${g}-${vp.tag}-4-autopick-buttons.png` });
      await p.locator('#dg-stats').screenshot({ path: `/workspace/debug/allgames-${g}-${vp.tag}-5-stats.png` });
    }
    await p.click('#dg-t-reveal'); await p.waitForFunction(() => /That's your pick/.test(document.getElementById('dg-bd-result').innerText), null, { timeout: 40000 });
    if (shots) await p.locator('#dg-balldrop').screenshot({ path: `/workspace/debug/allgames-${g}-${vp.tag}-6-pick-reveal.png` });
    await p.click('#dg-t-log'); await p.waitForTimeout(300);
    const logged = await p.evaluate(gk => JSON.parse(localStorage.getItem('draw_buddy_dg_tickets') || '[]').filter(t => t.game === gk).length, g);
    ok(`${g} [${vp.tag}]: ticket logged`, logged >= 1, logged);
    const all = await p.evaluate(() => document.getElementById('dg-panel').innerText);
    const bad = all.match(BANNED); ok(`${g} [${vp.tag}]: wording rules (no live/real-time/play along/®/™)`, !bad, bad ? bad[0] : "");
    ok(`${g} [${vp.tag}]: Ralph lines present`, all.includes("18+. Gambling problem? Call 1-877-8-HOPENY or text HOPENY (467369).") && all.includes("Not affiliated with any lottery.") && all.includes("Past results don't predict future draws."));
    const mascot = await p.evaluate(() => Array.from(document.querySelectorAll('#dg-panel img')).map(i => i.src));
    ok(`${g} [${vp.tag}]: no mascot images next to picks/results`, mascot.length === 0, mascot.join(","));
    const buy = await p.evaluate(() => Array.from(document.querySelectorAll('#dg-panel a, #dg-panel button')).map(x => x.innerText).filter(t => /buy|checkout|order|purchase|subscribe/i.test(t)));
    ok(`${g} [${vp.tag}]: no buy/checkout buttons in the panel`, buy.length === 0, buy.join(","));
  }
  ok(`[${vp.tag}] no page errors`, errors.length === 0, errors.join(" | "));
  await c.close();
}
console.log(`${pass}/${pass + fail} passed`); await b.close(); process.exit(fail ? 1 : 0);
