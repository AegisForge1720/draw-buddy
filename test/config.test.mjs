import assert from "node:assert/strict";
import test from "node:test";
import { annualSavings, isBrowserSafeSupabaseKey } from "../js/config.js";
import { isSubscribed } from "../js/entitlement.js";

test("annual plan savings stay $6.88 versus $1.99 monthly", () => {
    assert.equal(annualSavings(1.99, 17), 6.88);
});

test("browser key check rejects a service role JWT and accepts a publishable key", () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const service = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
    const anon = Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url");
    assert.equal(isBrowserSafeSupabaseKey(`${header}.${service}.sig`), false);
    assert.equal(isBrowserSafeSupabaseKey(`${header}.${anon}.sig`), true);
    assert.equal(isBrowserSafeSupabaseKey("sb_publishable_example"), true);
    assert.equal(isBrowserSafeSupabaseKey("sb_secret_example"), false);
    assert.equal(isBrowserSafeSupabaseKey(""), false);
});

test("production entitlement stays locked unless a store result says otherwise", () => {
    assert.equal(isSubscribed({ debug: false, debugTier: "pro" }), false);
    assert.equal(isSubscribed({ debug: true, debugTier: "free" }), false);
    assert.equal(isSubscribed({ debug: true, debugTier: "pro" }), true);
    assert.equal(isSubscribed({ debug: true, debugTier: "pro", storeEntitlement: false }), false);
    assert.equal(isSubscribed({ debug: false, storeEntitlement: true }), true);
});
