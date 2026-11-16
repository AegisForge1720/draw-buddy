// Venue chat (flag venueChat, private preview only). Two phones checked in to the same venue see each other's
// messages; a third phone at a different venue does not; word/name filters; Report and Hide person; flag off in public.
// Posts real rows to Supabase under test venue ids "DBTEST..."; clean up afterwards with:
//   delete from public.venue_messages where venue_id like 'DBTEST%';
// Usage: PREVIEW_PASS=... node tests/venue-chat.mjs http://127.0.0.1:8879/ [screenshot.png]
import { createRequire } from "module";
const require = createRequire("/workspace/tools/");
const { chromium } = require("playwright-core");
const url = process.argv[2] || "http://127.0.0.1:8879/";
const shot = process.argv[3] || null;
const run = Date.now().toString(36).toUpperCase();
const V1 = "DBTEST" + run + "A", V2 = "DBTEST" + run + "B";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const results = []; const check = (name, ok, info = "") => results.push({ name, ok: !!ok, info });
async function phone(venue, name, opts = {}) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, httpCredentials: { username: "andrew", password: process.env.PREVIEW_PASS } });
  if (opts.public) await c.route(u => new URL(u).pathname === "/" || new URL(u).pathname === "/index.html", async route => {
    const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace(/\s*<meta name="db-build" content="private-preview">/, "") });
  });
  await c.addInitScript(([v, n]) => {
    localStorage.setItem("draw_buddy_age_ok", String(Date.now()));
    localStorage.setItem("draw_buddy_venue", JSON.stringify({ id: v, name: "Test Venue " + v.slice(-1) + " (automated test)", street: "", city: "Test", zip: "" }));
    localStorage.setItem("draw_buddy_venue_checkin", JSON.stringify({ id: v, at: Date.now(), how: "tap", meters: null }));
    if (n) localStorage.setItem("draw_buddy_chat_name", JSON.stringify(n));
  }, [venue, name || null]);
  const p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
  await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
  return { c, p, errs };
}
const bodies = p => p.evaluate(() => Array.from(document.querySelectorAll('#vc-list .vc-body')).map(e => e.textContent));
const waitFor = async (p, text, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await bodies(p)).includes(text)) return true; await p.waitForTimeout(500); } return false; };

const A = await phone(V1, null), B = await phone(V1, "Tester B"), C = await phone(V2, "Tester C");
// Name rules (A has no name yet)
const nameRow = await A.p.evaluate(() => !document.getElementById('vc-name-row').hidden && document.getElementById('vc-room').hidden);
check("new phone is asked for a display name first", nameRow);
await A.p.fill('#vc-name', 'NY Lottery'); await A.p.click('#vc-name-save');
const st1 = await A.p.evaluate(() => ({ s: document.getElementById('vc-status').innerText, room: !document.getElementById('vc-room').hidden }));
check("name filter blocks 'NY Lottery'", !st1.room && /official/i.test(st1.s), JSON.stringify(st1));
await A.p.fill('#vc-name', 'Tester A'); await A.p.click('#vc-name-save'); await A.p.waitForTimeout(800);
check("good name opens the chat", await A.p.evaluate(() => !document.getElementById('vc-room').hidden));
// Copy
const copy = await A.p.evaluate(() => document.getElementById('venue-chat-card').innerText);
check("card has the respect / personal info / not affiliated note and HOPENY line", /Be respectful\. Don't share personal info\. Not affiliated with any lottery\./.test(copy) && /1-877-8-HOPENY/.test(copy));
check("no live / real-time / win / bonus / jackpot wording in the card", !/\b(live|real-time|realtime|win|wins|winning|bonus|jackpot)\b/i.test(copy), copy.slice(0, 200));
// Same venue sees, other venue does not
const mA = "Hi from phone A, automated test " + run;
await A.p.fill('#vc-input', mA); await A.p.click('#vc-send');
check("B (same venue) sees A's message", await waitFor(B.p, mA));
const mB = "Phone B here, automated test " + run;
await B.p.waitForTimeout(500); await B.p.fill('#vc-input', mB); await B.p.click('#vc-send');
check("A sees B's reply", await waitFor(A.p, mB));
if (shot) { await A.p.evaluate(() => { const h = document.querySelector('header').getBoundingClientRect().height; const r = document.getElementById('venue-chat-card').getBoundingClientRect(); window.scrollTo(0, scrollY + r.top - h - 8); }); await A.p.waitForTimeout(600); await A.p.screenshot({ path: shot }); await B.p.evaluate(() => { const h = document.querySelector('header').getBoundingClientRect().height; const r = document.getElementById('venue-chat-card').getBoundingClientRect(); window.scrollTo(0, scrollY + r.top - h - 8); }); await B.p.waitForTimeout(600); await B.p.screenshot({ path: shot.replace(/\.png$/, '-phoneB.png') }); }
await C.p.waitForTimeout(6000);
const cb = await bodies(C.p);
check("C (different venue) sees neither message", !cb.includes(mA) && !cb.includes(mB), JSON.stringify(cb));
check("A's own message is marked (you)", await A.p.evaluate(t => Array.from(document.querySelectorAll('#vc-list .vc-msg')).some(m => m.querySelector('.vc-body').textContent === t && /\(you\)/.test(m.innerText)), mA));
// Text filter
await A.p.waitForTimeout(3500);
await A.p.fill('#vc-input', 'this is shit'); await A.p.click('#vc-send'); await A.p.waitForTimeout(1500);
const f = await A.p.evaluate(() => document.getElementById('vc-status').innerText);
check("word filter blocks a message before it is sent", /aren't allowed/.test(f), f);
await A.p.fill('#vc-input', 'text me 718-555-0101'); await A.p.click('#vc-send'); await A.p.waitForTimeout(1500);
check("phone numbers are blocked", /personal info/i.test(await A.p.evaluate(() => document.getElementById('vc-status').innerText)));
await B.p.waitForTimeout(5000);
check("blocked messages never reach B", !(await bodies(B.p)).some(t => /shit|718-555/.test(t)));
// Report hides it for the reporter
await B.p.evaluate(t => Array.from(document.querySelectorAll('#vc-list .vc-msg')).find(m => m.querySelector('.vc-body').textContent === t).querySelector('.vc-report').click(), mA);
await B.p.waitForTimeout(800);
check("Report hides the message for the reporter", !(await bodies(B.p)).includes(mA));
await A.p.waitForTimeout(5000);
check("one report does not hide it for everyone (needs 3)", (await bodies(A.p)).includes(mA));
// Hide person
await A.p.evaluate(t => Array.from(document.querySelectorAll('#vc-list .vc-msg')).find(m => m.querySelector('.vc-body').textContent === t).querySelector('.vc-hide').click(), mB);
await A.p.waitForTimeout(800);
check("Hide person hides that person's messages", !(await bodies(A.p)).includes(mB));
check("no page errors", [A, B, C].every(x => x.errs.length === 0), [A, B, C].flatMap(x => x.errs).join(" | "));
for (const x of [A, B, C]) await x.c.close();
// Public build: flag off, card hidden, no requests
const P = await phone(V1, "Tester P", { public: true });
const pub = await P.p.evaluate(() => ({ flag: window.DB_FLAGS.venueChat, shown: getComputedStyle(document.getElementById('venue-chat-card')).display !== 'none', list: document.querySelectorAll('#vc-list .vc-msg').length }));
check("public build: venueChat off, card hidden, nothing loaded", pub.flag === false && !pub.shown && pub.list === 0, JSON.stringify(pub));
await P.c.close();
await b.close();
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.info !== "" ? "  (" + r.info + ")" : ""}`);
console.log(`${results.filter(r => r.ok).length}/${results.length} passed · test venues ${V1}, ${V2}`);
process.exit(results.every(r => r.ok) ? 0 : 1);
