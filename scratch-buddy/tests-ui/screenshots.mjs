// Screenshots of the public build at 1024 and 390 px into /workspace/debug/scratch-ready-*.png.
// Usage: PREVIEW_PASS=... node scratch-buddy/tests-ui/screenshots.mjs http://127.0.0.1:8876/
import { mkdirSync } from "node:fs";
import { URL_BASE, context, launch } from "./_lib.mjs";
const OUT = "/workspace/debug";
mkdirSync(OUT, { recursive: true });
const b = await launch();
const saved = [];
for (const [w, h] of [[1024, 900], [390, 844]]) {
    {
        const c = await context(b, w, h, { agePass: false });
        const p = await c.newPage();
        await p.goto(URL_BASE, { waitUntil: "networkidle" });
        await p.screenshot({ path: `${OUT}/scratch-ready-${w}-agegate.png` }); saved.push(`scratch-ready-${w}-agegate.png`);
        await c.close();
    }
    const c = await context(b, w, h);
    const p = await c.newPage();
    p.setDefaultTimeout(30000);
    await p.goto(URL_BASE, { waitUntil: "networkidle" });
    await p.waitForFunction(() => /Source:/.test(document.getElementById("retailer-source")?.innerText || ""));
    await p.fill("#retailer-query", "Rochester");
    await p.click("#retailer-search");
    await p.waitForFunction(() => document.querySelectorAll("#retailer-results li").length > 0);
    await p.screenshot({ path: `${OUT}/scratch-ready-${w}-find.png`, fullPage: false }); saved.push(`scratch-ready-${w}-find.png`);
    for (const tab of ["map", "log", "logs-map"]) {
        await p.click(`#tab-${tab}`);
        await p.waitForTimeout(tab.includes("map") ? 4000 : 500);
        await p.screenshot({ path: `${OUT}/scratch-ready-${w}-${tab}.png`, fullPage: false }); saved.push(`scratch-ready-${w}-${tab}.png`);
    }
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/scratch-ready-${w}-footer.png` }); saved.push(`scratch-ready-${w}-footer.png`);
    for (const page of ["privacy", "terms"]) {
        await p.goto(`${URL_BASE}${page}.html`, { waitUntil: "networkidle" });
        await p.screenshot({ path: `${OUT}/scratch-ready-${w}-${page}.png`, fullPage: true }); saved.push(`scratch-ready-${w}-${page}.png`);
    }
    await c.close();
}
await b.close();
console.log(saved.map((s) => `${OUT}/${s}`).join("\n"));
