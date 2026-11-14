import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const DRAW_BUDDY_FILES = [
    "index.html",
    "privacy.html",
    "terms.html",
    "js/app.js",
    "js/config.js",
    "js/notices.js",
    "README.md",
    "sw.js",
    "manifest.webmanifest",
    "robots.txt"
];

test("Draw Buddy pages do not mention scratch-off tools or link to the other app", () => {
    DRAW_BUDDY_FILES.forEach((file) => {
        const text = readFileSync(file, "utf8").toLowerCase();
        assert.equal(text.includes("scratch"), false, file);
        assert.equal(text.includes("scratch-buddy"), false, file);
    });
});
