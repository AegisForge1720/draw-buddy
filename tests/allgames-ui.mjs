// UI test + screenshots for every non-Quick Draw game. Usage: PREVIEW_PASS=... node tests/allgames-ui.mjs URL [shots]
import { createRequire } from "module";
const require = createRequire("/workspace/tools/");
const { chromium } = require("playwright-core");
const url = process.argv[2] || "http://127.0.0.1:8881/", shots = process.argv[3] === "shots";
const GAMES = (process.env.GAMES || "powerball,megamillions,millionaire,nylotto,take5,pick10,numbers,win4").split(",");
const BANNED = /\blive\b|real-time|realtime|play along|Penny Arcade|®|™|Ticket check|Hot Number|🔥|🤖|would have won|\bWon \$|\$[\d,.]+ won\b/i;
const NOT_OFFICIAL = "Not official ticket validation. Confirm prizes with the official lottery.";
const SAME_NOTE = "These buttons can produce the same numbers.";
const RG = "18+. Gambling problem? Call 1-877-8-HOPENY or text HOPENY (467369).", NA = "Not affiliated with any lottery.";
const CAP = { powerball: 10, megamillions: 10, millionaire: 10, nylotto: 10, take5: 7, pick10: 7, numbers: 10, win4: 10 };
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
let pass = 0, fail = 0; const ok = (n, c, i = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${i !== "" ? "  (" + i + ")" : ""}`); };
for (const vp of shots ? [{ w: 390, h: 844, tag: "390", mobile: true }, { w: 1280, h: 900, tag: "desktop", mobile: false }] : [{ w: 390, h: 844, tag: "390", mobile: true }]) {
  const ctxOpts = { viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.mobile ? 2 : 1, isMobile: vp.mobile, hasTouch: vp.mobile, httpCredentials: { username: "andrew", password: process.env.PREVIEW_PASS } };
  { // 18+ age gate on a fresh device
    const c0 = await b.newContext(ctxOpts), p0 = await c0.newPage(); await p0.goto(url, { waitUntil: "domcontentloaded" }); await p0.waitForTimeout(1500);
    const shown = await p0.evaluate(() => getComputedStyle(document.getElementById('age-gate')).display !== 'none');
    await p0.click('#age-no'); const no = await p0.evaluate(() => !document.getElementById('age-gate-no').hidden && getComputedStyle(document.getElementById('age-gate')).display !== 'none');
    await p0.click('#age-yes'); await p0.waitForTimeout(200); const gone = await p0.evaluate(() => getComputedStyle(document.getElementById('age-gate')).display === 'none');
    await p0.reload({ waitUntil: "domcontentloaded" }); await p0.waitForTimeout(800); const remembered = await p0.evaluate(() => getComputedStyle(document.getElementById('age-gate')).display === 'none');
    ok(`[${vp.tag}] 18+ age gate: shown first, 'under 18' stays blocked, '18 or older' opens, remembered`, shown && no && gone && remembered, `${shown}/${no}/${gone}/${remembered}`);
    await c0.close();
  }
  const c = await b.newContext(ctxOpts);
  await c.addInitScript(() => { try { localStorage.setItem('draw_buddy_age_ok', String(Date.now())); } catch (e) {} });
  await c.addInitScript(() => { try { if (!sessionStorage.getItem('dgt')) { localStorage.removeItem('draw_buddy_dg_tickets'); sessionStorage.setItem('dgt', '1'); } } catch (e) {} });
  const p = await c.newPage(); p.setDefaultTimeout(30000); const errors = [];
  p.on("pageerror", e => errors.push(String(e).slice(0, 200))); p.on("console", m => { if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  p.on("dialog", d => d.accept());
  await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(3000);
  { const pg = await p.evaluate(() => {
      const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      return { robots: (document.querySelector('meta[name="robots"]') || {}).content, title: document.title, build: window.DB_BUILD, flags: window.DB_FLAGS,
        partnerVisible: Array.from(document.querySelectorAll('a[href*="lotto.com"], a[href*="ref=draw_buddy_stripe"], a[href*="draftkings"], a[href*="fanduel"], a[href*="betmgm"], a[href*="jackpocket"]')).filter(vis).length,
        partnerInDom: document.querySelectorAll('a[href*="ref=draw_buddy_stripe"]').length,
        share: vis(document.getElementById('share-btn')) || vis(document.getElementById('share-qr-btn')), tier: vis(document.getElementById('dev-tier-switcher')),
        prices: Array.from(document.querySelectorAll('a[href*="buy.stripe.com"]')).filter(vis).length,
        body: document.body.innerText, house: vis(document.getElementById('house-lines')) };
    });
    ok("robots meta noindex,nofollow + title", pg.robots === "noindex,nofollow" && pg.title === "Draw Buddy", pg.robots + " | " + pg.title);
    ok("private preview build: every feature on (Andrew 2026-11-16)", pg.build === "private-preview" && pg.flags.doublePlay && pg.flags.resultNotices && pg.flags.partnerLinks && pg.flags.shareQr && pg.flags.tierSwitcher && pg.flags.pricing, JSON.stringify(pg.flags));
    ok("Private preview: partner/affiliate links shown (public builds keep them off; see public-flags test)", pg.partnerVisible > 0, `${pg.partnerVisible} visible, ${pg.partnerInDom} in DOM`);
    ok("Private preview: Share/QR and Free/Pro switcher shown in the top banner", pg.share && pg.tier);
    ok("Footer entity Insert Coin Industries LLC; no 'Draw Buddy Analytics'", /© 2026 Insert Coin Industries LLC/.test(pg.body) && !/Draw Buddy Analytics/.test(pg.body));
    ok("House lines visible on the page (HOPENY, not affiliated, D1)", pg.house && pg.body.includes(RG) && pg.body.includes(NA) && pg.body.includes("Past results don't predict future draws."));
    const bad0 = pg.body.match(BANNED); ok("Quick Draw page wording rules", !bad0, bad0 ? bad0[0] : "");
  }
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
      ok(`${g} [${vp.tag}] ${m}: Hindsight check with not-official line`, /Hindsight check:/.test(t.txt) && t.txt.includes(NOT_OFFICIAL) && !/Ticket check/.test(t.txt));
      const dr = await p.evaluate(() => { const el = document.getElementById('dg-s-draws'); return { n: el.options.length, v: Number(el.value), label: el.closest('label').innerText }; });
      ok(`${g} [${vp.tag}] ${m}: draws in a row within app cap, labeled`, dr.n <= CAP[g] && dr.v <= CAP[g] && /app limit/i.test(dr.label), `${dr.v}/${dr.n}`);
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
    ok(`${g} [${vp.tag}]: Ralph lines present`, all.includes(RG) && all.includes(NA) && all.includes("Past results don't predict future draws."));
    const top = await p.evaluate(() => { const el = document.getElementById('house-lines'), pn = document.getElementById('dg-panel'); return { txt: el.innerText, vis: el.getClientRects().length > 0, above: !!(el.compareDocumentPosition(pn) & Node.DOCUMENT_POSITION_FOLLOWING) }; });
    ok(`${g} [${vp.tag}]: HOPENY / not affiliated / D1 visible above the game screen`, top.vis && top.above && top.txt.includes(RG) && top.txt.includes(NA) && top.txt.includes("Past results don't predict future draws."));
    ok(`${g} [${vp.tag}]: same-numbers note under Auto Picks`, all.includes(SAME_NOTE));
    const mascot = await p.evaluate(() => Array.from(document.querySelectorAll('#dg-panel img')).map(i => i.src));
    ok(`${g} [${vp.tag}]: no mascot images next to picks/results`, mascot.length === 0, mascot.join(","));
    const buy = await p.evaluate(() => Array.from(document.querySelectorAll('#dg-panel a, #dg-panel button')).map(x => x.innerText).filter(t => /buy|checkout|order|purchase|subscribe/i.test(t)));
    ok(`${g} [${vp.tag}]: no buy/checkout buttons in the panel`, buy.length === 0, buy.join(","));
  }
  ok(`[${vp.tag}] no page errors`, errors.length === 0, errors.join(" | "));
  await c.close();
}
console.log(`${pass}/${pass + fail} passed`); await b.close(); process.exit(fail ? 1 : 0);
