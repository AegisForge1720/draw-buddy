// Shared helpers for the Scratch Buddy browser checks. The preview password is read from the
// environment (PREVIEW_PASS) and never printed.
import { createRequire } from "module";
const require = createRequire("/workspace/tools/");
export const { chromium } = require("playwright-core");
export const URL_BASE = (process.argv[2] || "http://127.0.0.1:8876/").replace(/\/?$/, "/");
export async function launch() {
    return chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
}
export async function context(browser, width, height, { agePass = true } = {}) {
    const c = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1,
        httpCredentials: { username: "andrew", password: process.env.PREVIEW_PASS || "" }
    });
    if (agePass) {
        await c.addInitScript(() => {
            try {
                localStorage.setItem("scratch_buddy_age_gate", JSON.stringify({ flag: "18plus", expiresAt: Date.now() + 86400000 }));
            } catch (e) {}
        });
    }
    return c;
}
export function reporter() {
    let pass = 0, fail = 0;
    const ok = (name, cond, info = "") => {
        cond ? pass++ : fail++;
        console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info !== "" ? "  (" + info + ")" : ""}`);
    };
    const done = () => { console.log(`${pass}/${pass + fail} passed`); return fail ? 1 : 0; };
    return { ok, done };
}
