// Public-build flag check: the same index.html without the private-preview meta must have every flag off.
// Usage: PREVIEW_PASS=... node tests/public-flags.mjs http://127.0.0.1:8879/
import { createRequire } from "module";
const require = createRequire("/workspace/tools/");
const { chromium } = require("playwright-core");
const url = process.argv[2] || "http://127.0.0.1:8879/";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, httpCredentials: { username: "andrew", password: process.env.PREVIEW_PASS } });
await c.addInitScript(() => { try { localStorage.setItem('draw_buddy_age_ok', String(Date.now())); } catch (e) {} });
await c.route(u => new URL(u).pathname === "/" || new URL(u).pathname === "/index.html", async route => {
  const r = await route.fetch(); const body = (await r.text()).replace(/\s*<meta name="db-build" content="private-preview">/, "");
  await route.fulfill({ response: r, body });
});
const p = await c.newPage(); p.setDefaultTimeout(30000);
let pass = 0, fail = 0; const ok = (n, cond, i = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${n}${i !== "" ? "  (" + i + ")" : ""}`); };
await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(2000);
const f = await p.evaluate(() => ({ build: window.DB_BUILD, flags: window.DB_FLAGS, ui: window.DGUI && window.DGUI.flags }));
ok("public build: DB_BUILD is public", f.build === "public", f.build);
ok("public build: every flag off", Object.values(f.flags).every(v => v === false) && !f.ui.doublePlay && !f.ui.resultNotices, JSON.stringify(f.flags));
await p.click("#game-btn-powerball");
await p.waitForFunction(() => /official draws loaded|Data unavailable/.test(document.getElementById('dg-data')?.innerText || ''), null, { timeout: 30000 });
await p.click('#dg-auto-grid [data-dgmode="jackpot"]'); await p.waitForFunction(() => !document.getElementById('dg-ticket').hidden);
const t = await p.evaluate(() => ({ dp: !!document.getElementById('dg-s-dp'), txt: document.getElementById('dg-panel').innerText }));
ok("public build: no Double Play control and Jackpot Pick does not add it", !t.dp && !/Double Play on|\+ Double Play/.test(t.txt));
console.log(`${pass}/${pass + fail} passed`); await b.close(); process.exit(fail ? 1 : 0);
