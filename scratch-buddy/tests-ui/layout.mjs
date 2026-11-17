// Layout check: no horizontal overflow at 360, 390 and 1024 px wide on every tab and legal page,
// and the header lines up with the content column.
// Usage: PREVIEW_PASS=... node scratch-buddy/tests-ui/layout.mjs http://127.0.0.1:8876/
import { URL_BASE, context, launch, reporter } from "./_lib.mjs";
const { ok, done } = reporter();
const b = await launch();
for (const [w, h] of [[360, 740], [390, 844], [1024, 900]]) {
    const c = await context(b, w, h);
    const p = await c.newPage();
    p.setDefaultTimeout(30000);
    await p.goto(URL_BASE, { waitUntil: "networkidle" });
    await p.waitForSelector("#tab-find");
    for (const tab of ["find", "map", "log", "logs-map"]) {
        await p.click(`#tab-${tab}`);
        await p.waitForTimeout(tab.includes("map") ? 1500 : 300);
        const m = await p.evaluate(() => {
            const vw = document.documentElement.clientWidth;
            const wide = [...document.querySelectorAll("body *")].filter((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.right > vw + 1 && !el.closest(".leaflet-container") && getComputedStyle(el).position !== "fixed";
            }).slice(0, 3).map((el) => el.id || el.className || el.tagName);
            const hdr = document.querySelector(".app-header > div")?.getBoundingClientRect();
            const main = document.querySelector("main")?.getBoundingClientRect();
            return { vw, sw: document.documentElement.scrollWidth, wide, hdrL: hdr && Math.round(hdr.left), hdrW: hdr && Math.round(hdr.width), mainL: main && Math.round(main.left), mainW: main && Math.round(main.width) };
        });
        ok(`${w}px ${tab}: no horizontal overflow`, m.sw <= m.vw && m.wide.length === 0, `scrollWidth ${m.sw} / ${m.vw} ${m.wide.join(",")}`);
        if (tab === "find") ok(`${w}px header aligned with content`, Math.abs(m.hdrL - m.mainL) <= 1 && Math.abs(m.hdrW - m.mainW) <= 1, `header ${m.hdrL}/${m.hdrW} main ${m.mainL}/${m.mainW}`);
    }
    for (const page of ["privacy.html", "terms.html"]) {
        await p.goto(URL_BASE + page, { waitUntil: "networkidle" });
        const m = await p.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
        ok(`${w}px ${page}: no horizontal overflow`, m.sw <= m.vw, `${m.sw} / ${m.vw}`);
    }
    await c.close();
}
await b.close();
process.exit(done());
