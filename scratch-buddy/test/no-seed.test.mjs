import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(new URL("../js/app.js", import.meta.url).pathname);

function walk(dir) {
    const out = [];
    for (const name of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, name.name);
        if (name.isDirectory()) {
            if (name.name === "data" || name.name === "node_modules") continue;
            out.push(...walk(path));
        } else if (/\.(js|mjs|html|md|css|sql|json)$/.test(name.name)) {
            out.push(path);
        }
    }
    return out;
}

test("the shipped app does not include prize-log seed data", () => {
    const files = walk(join(root, ".."));
    const banned = [
        "Cash Explosion · $50",
        "APPLEBEE'S #08, ROCHESTER, 14622. 2026-11-15",
        '"prizeAmount": 50'
    ];
    for (const file of files) {
        if (file.endsWith("no-seed.test.mjs") || file.endsWith("logs.test.mjs")) continue;
        const text = readFileSync(file, "utf8");
        for (const phrase of banned) {
            assert.equal(text.includes(phrase), false, `${file} contains ${phrase}`);
        }
        // No baked-in log arrays assigned to storage.
        if (file.endsWith("app.js") || file.endsWith("logs.js") || file.endsWith("markup.js")) {
            assert.equal(/scratch_buddy_prize_logs["']\s*,\s*\[/.test(text), false, file);
        }
    }
});
