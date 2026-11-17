// Public-build flag check (Scratch Buddy's equivalent of Draw Buddy's tests/public-flags.mjs).
// The served build must have every flag off, the Quick Draw venue path hidden, the house lines
// shown, the manifest reachable, and no request to any host other than the app and the map tiles.
// It also proves the switch works: injecting the private-preview meta turns the preview flags on.
// Usage: PREVIEW_PASS=... node scratch-buddy/tests-ui/public-flags.mjs http://127.0.0.1:8876/
import { URL_BASE, context, launch, reporter } from "./_lib.mjs";
const HOPENY = "18+. Gambling problem? Call 1-877-8-HOPENY or text HOPENY (467369).";
const { ok, done } = reporter();
const b = await launch();

// 1. Age gate shows first when there is no pass, and the app shell is not rendered.
{
    const c = await context(b, 390, 844, { agePass: false });
    const p = await c.newPage();
    await p.goto(URL_BASE, { waitUntil: "networkidle" });
    const s = await p.evaluate(() => ({ gate: !!document.querySelector("#age-month"), tabs: !!document.querySelector("#tab-find") }));
    ok("age gate first: DOB form shown and app not rendered", s.gate && !s.tabs, JSON.stringify(s));
    await c.close();
}

// 2. Public build.
const c = await context(b, 390, 844);
const p = await c.newPage();
p.setDefaultTimeout(30000);
const appHost = new URL(URL_BASE).host;
const hosts = new Set();
p.on("request", (r) => { try { hosts.add(new URL(r.url()).host); } catch (e) {} });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
await p.goto(URL_BASE, { waitUntil: "networkidle" });
await p.waitForFunction(() => /Source:/.test(document.getElementById("retailer-source")?.innerText || ""));
const f = await p.evaluate(() => ({ build: window.SB_BUILD, flags: window.SB_FLAGS }));
ok("public build: SB_BUILD is public", f.build === "public", f.build);
ok("public build: every flag off", f.flags && Object.values(f.flags).every((v) => v === false), JSON.stringify(f.flags));
const dom = await p.evaluate(() => ({
    qd: !!document.getElementById("retailer-qd-only"),
    venue: !!document.getElementById("log-path-venue"),
    banner: !!document.querySelector(".preview-banner"),
    text: document.body.innerText,
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute("href"),
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content")
}));
ok("public build: no Quick Draw venues-only filter", !dom.qd);
ok("public build: no Bought at a venue path", !dom.venue);
ok("public build: no preview banner", !dom.banner);
ok("public build: noindex meta kept", dom.robots === "noindex,nofollow", dom.robots);
ok("footer: exact HOPENY line", dom.text.includes(HOPENY));
ok("footer: Not affiliated with any lottery.", dom.text.includes("Not affiliated with any lottery."));
ok("footer: Past results don't predict future draws.", dom.text.includes("Past results don't predict future draws."));
ok("copy: no banned words in rendered text", !/\b(live|win|wins|won|jackpot)\b|real-time|penny arcade|[®™]/i.test(dom.text));
ok("copy: no prices or buy buttons", !/\$\d|buy now|subscribe|upgrade|checkout/i.test(dom.text));
// Search a real city and make sure results show with no Quick Draw badge.
await p.fill("#retailer-query", "Rochester");
await p.click("#retailer-search");
await p.waitForFunction(() => document.querySelectorAll("#retailer-results li").length > 0);
const res = await p.evaluate(() => ({ n: document.querySelectorAll("#retailer-results li").length, t: document.getElementById("retailer-results").innerText }));
ok("search: official rows render", res.n > 0, `${res.n} rows`);
ok("search: no Quick Draw venue badge", !/Quick Draw/.test(res.t));
await p.click("#tab-map");
await p.waitForTimeout(2500);
await p.click("#tab-log");
await p.click("#tab-logs-map");
await p.waitForTimeout(1500);
const man = await p.evaluate(async (href) => { const r = await fetch(href); const j = await r.json(); return { status: r.status, name: j.name, display: j.display }; }, dom.manifest);
ok("manifest: reachable, standalone", man.status === 200 && man.name === "Scratch Buddy" && man.display === "standalone", JSON.stringify(man));
const other = [...hosts].filter((h) => h !== appHost && !/^([abc]\.)?tile\.openstreetmap\.org$/.test(h));
ok("network: only the app host and OSM tiles were contacted", other.length === 0, [...hosts].join(", "));
ok("no page errors", errors.length === 0, errors.join(" | "));
for (const page of ["privacy.html", "terms.html"]) {
    await p.goto(URL_BASE + page, { waitUntil: "networkidle" });
    const t = await p.evaluate(() => document.body.innerText);
    ok(`${page}: contact, entity, no-warranty/on-device, HOPENY`, t.includes("ralph@insertcoinindustries.com") && t.includes("NAV Analytics LLC") && t.includes(HOPENY)
        && (page === "terms.html" ? /No warranty/i.test(t) : /What stays on your device/i.test(t)));
    ok(`${page}: no draft banner`, !/draft|pending legal review/i.test(t));
}
await c.close();

// 3. The same build with the private-preview meta injected turns the preview flags on (switch works).
{
    const c2 = await context(b, 390, 844);
    await c2.route((u) => /\/(index\.html)?$/.test(new URL(u).pathname), async (route) => {
        const r = await route.fetch();
        const body = (await r.text()).replace("<head>", '<head>\n    <meta name="sb-build" content="private-preview">');
        await route.fulfill({ response: r, body });
    });
    const p2 = await c2.newPage();
    await p2.goto(URL_BASE, { waitUntil: "networkidle" });
    const g = await p2.evaluate(() => ({ build: window.SB_BUILD, flags: window.SB_FLAGS, venue: !!document.getElementById("log-path-venue") }));
    ok("switch: private-preview meta turns quickDrawVenue on", g.build === "private-preview" && g.flags.quickDrawVenue && g.venue, JSON.stringify(g));
    ok("switch: pricing/sharedAccounts/shareQr stay off even in preview", !g.flags.pricing && !g.flags.sharedAccounts && !g.flags.shareQr);
    await c2.close();
}
await b.close();
process.exit(done());
