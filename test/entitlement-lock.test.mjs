import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { isSubscribed } from "../js/entitlement.js";

const pageFiles = ["index.html", ...readdirSync(new URL("../js", import.meta.url)).filter((name) => name.endsWith(".js")).map((name) => `js/${name}`)];

function source(file) {
    return readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
}

test("the public page cannot switch a browser to Subscribed", () => {
    const forbidden = [
        /dev-tier/,
        /draw_buddy_active_tier/,
        /debugTier/,
        /switchTestTier/,
        /isDebugMode/,
        /get\("debug"\)/,
        /value="pro"/,
        /option value="pro"/,
        /[?&]debug=1/
    ];
    pageFiles.forEach((file) => {
        const text = source(file);
        forbidden.forEach((pattern) => {
            assert.equal(pattern.test(text), false, `${file} matches ${pattern}`);
        });
    });
    const app = source("js/app.js");
    const gate = source("js/entitlement.js");
    assert.match(app, /function readStoreEntitlement\(\) \{\s*return null;/);
    assert.match(app, /entitlementIsSubscribed\(\{ storeEntitlement: readStoreEntitlement\(\) \}\)/);
    assert.equal(app.includes("location.search"), false);
    assert.equal(/keydown|keyup|keypress/.test(app), false);
    assert.equal(gate.includes("debug"), false);
    assert.equal(isSubscribed({ debug: true, debugTier: "pro", storeEntitlement: null }), false);
    assert.equal(isSubscribed({ storeEntitlement: true }), true);
});
