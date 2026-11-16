import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    PHOTO_DELETE_BLOCKED_COPY,
    bindPhotoDatabaseDelete
} from "../js/photos.js";

function fakeRequest() {
    const request = {
        error: null,
        _success: null,
        _error: null,
        _blocked: null
    };
    Object.defineProperty(request, "onsuccess", {
        set(fn) { request._success = fn; },
        get() { return request._success; }
    });
    Object.defineProperty(request, "onerror", {
        set(fn) { request._error = fn; },
        get() { return request._error; }
    });
    Object.defineProperty(request, "onblocked", {
        set(fn) { request._blocked = fn; },
        get() { return request._blocked; }
    });
    return request;
}

test("photo database deletion waits for success and only warns when blocked", async () => {
    const request = fakeRequest();
    let warned = false;
    const pending = bindPhotoDatabaseDelete(request, { onBlocked() { warned = true; } });
    let settled = false;
    pending.then(() => { settled = true; });
    request._blocked();
    await Promise.resolve();
    assert.equal(warned, true);
    assert.equal(settled, false);
    request._success();
    const result = await pending;
    assert.equal(result.deleted, true);
    assert.equal(result.blocked, true);
    assert.equal(PHOTO_DELETE_BLOCKED_COPY, "Close other Scratch Buddy tabs to finish deleting photos on this device.");
});

test("photo database deletion resolves only after a success event, even without a block", async () => {
    const request = fakeRequest();
    const pending = bindPhotoDatabaseDelete(request);
    let settled = false;
    pending.then(() => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, false);
    request._success();
    const result = await pending;
    assert.equal(result.deleted, true);
    assert.equal(result.blocked, false);
});

test("the app requires a cover or crop before the redaction checkbox can be used", () => {
    const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
    assert.match(app, /redactionOps/);
    assert.match(app, /function syncRedactionConfirm/);
    assert.match(app, /confirm\.disabled = !ok/);
    assert.match(app, /recordRedactionOp/);
    assert.match(app, /if \(!\(logState\.redactionOps > 0\)\)/);
    const photos = readFileSync(new URL("../js/photos.js", import.meta.url), "utf8");
    assert.equal(photos.includes("onblocked = () => resolve()"), false);
    assert.equal(photos.includes("request.onblocked = () => resolve()"), false);
});
