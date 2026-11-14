import assert from "node:assert/strict";
import test from "node:test";

const PRE_AGE_NOTE = "Optional tracking is off. Nothing optional loads before the age check.";

function memoryStorage() {
    const data = new Map();
    return {
        getItem(key) { return data.has(key) ? data.get(key) : null; },
        setItem(key, value) { data.set(key, String(value)); },
        removeItem(key) { data.delete(key); }
    };
}

function installDom() {
    const nodes = [];
    function make(id, text, attributes = {}) {
        const listeners = {};
        const node = {
            id,
            tagName: "P",
            hidden: false,
            textContent: text,
            attributes: { ...attributes },
            classList: { add() {}, remove() {} },
            style: {},
            inert: false,
            setAttribute(name, value) { this.attributes[name] = String(value); },
            removeAttribute(name) { delete this.attributes[name]; },
            addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
            dispatch(type) {
                (listeners[type] || []).forEach((fn) => fn({ preventDefault() {} }));
            },
            focus() {},
            appendChild() {},
            querySelector() { return null; },
            querySelectorAll() { return []; },
            remove() {}
        };
        nodes.push(node);
        return node;
    }
    function matches(node, selector) {
        const found = selector.match(/^\[([^=\]]+)(?:='([^']*)')?\]$/);
        if (!found) return false;
        const [, name, value] = found;
        if (!Object.prototype.hasOwnProperty.call(node.attributes, name)) return false;
        return value === undefined || node.attributes[name] === value;
    }
    const status = make("privacy-choice-status", "");
    const optOut = make("opt-out", "Do Not Sell or Share / targeted ads opt-out", { "data-privacy-action": "opt-out" });
    const choices = make("choices", "Your privacy choices", { "data-privacy-action": "choices" });
    make("legal-main", "");
    globalThis.document = {
        documentElement: { classList: { add() {}, remove() {} } },
        body: { style: {}, appendChild(node) { nodes.push(node); } },
        getElementById(id) { return nodes.find((node) => node.id === id) || null; },
        querySelector() { return null; },
        querySelectorAll(selector) {
            const parts = selector.split(",").map((part) => part.trim());
            return nodes.filter((node) => parts.some((part) => matches(node, part)));
        },
        createElement() { return make(`created-${nodes.length}`, ""); }
    };
    globalThis.localStorage = memoryStorage();
    globalThis.sessionStorage = memoryStorage();
    globalThis.sessionStorage.setItem("draw_buddy_age_block", "1");
    globalThis.location = { origin: "http://example.test", pathname: "/privacy.html" };
    Object.defineProperty(globalThis.navigator, "globalPrivacyControl", {
        value: true,
        configurable: true
    });
    return { status, optOut, choices };
}

test("a failed age gate records nothing and shows no banner on an ungated legal page", async () => {
    const dom = installDom();
    const { startSiteGate } = await import("../js/compliance.js");
    startSiteGate({ ungated: true });
    assert.equal(dom.status.textContent, PRE_AGE_NOTE);
    assert.equal(dom.optOut.textContent, PRE_AGE_NOTE);
    assert.equal(dom.choices.textContent, PRE_AGE_NOTE);
    assert.equal(localStorage.getItem("draw_buddy_consent"), null);
    assert.equal(localStorage.getItem("draw_buddy_consent_log"), null);
    assert.equal(document.getElementById("consent-banner"), null);
    dom.optOut.dispatch("click");
    dom.choices.dispatch("click");
    assert.equal(dom.status.textContent, PRE_AGE_NOTE);
    assert.equal(localStorage.getItem("draw_buddy_consent"), null);
    assert.equal(localStorage.getItem("draw_buddy_consent_log"), null);
    assert.equal(document.getElementById("consent-banner"), null);
});
