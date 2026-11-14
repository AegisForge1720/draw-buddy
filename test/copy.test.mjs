import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../css/app.css", import.meta.url), "utf8");

test("picks card keeps both pick modes, the next-draw label, and the independence line", () => {
    assert.match(html, /Make random or stats-based number picks/);
    assert.match(html, /id="header-draw-label"[^>]*>Next draw #/);
    assert.match(html, /id="header-countdown"/);
    assert.match(html, /id="card-draw-label"/);
    assert.match(html, /Every draw is independent; picks don't improve your odds\./);
    assert.match(html, /id="picks-last-updated"/);
    assert.match(app, /projectNextDraw/);
    assert.match(app, /Draws #\$\{start\} – #\$\{end\}/);
});

test("heatmap copy uses one scale and names observed and expected repeat rates", () => {
    assert.match(html, /Gaps don't make a number due\./);
    assert.match(html, /Observed <span id="stat-markov">/);
    assert.match(html, /Expected <span id="stat-expected">/);
    assert.equal(html.includes("heatmap-hot"), false);
    assert.equal(html.includes("bg-red-500"), false);
    assert.equal(html.includes("text-red-300"), false);
    assert.equal(app.includes("heatmap-hot"), false);
    assert.equal(app.includes("bg-red-500"), false);
    assert.equal(app.includes("hotCutoff"), false);
    assert.match(app, /expectedOneStepRepeatRate/);
    assert.match(app, /hsl\(217 72%/);
    assert.equal(css.includes("heatmap-hot"), false);
});

test("results show a last-updated line and the delay notice", () => {
    assert.match(html, /id="results-updated"/);
    assert.match(html, /Results may be delayed; check official sources\./);
    assert.match(app, /Last updated /);
    assert.match(app, /formatDrawDate/);
});
