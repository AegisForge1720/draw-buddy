// Public-build checks for Scratch Buddy (launch-readiness, not a launch).
// Flags default off, shipped copy follows the house rules, nothing tracks, paths are relative,
// the home-screen manifest is valid, and no secret is in the public bundle.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { BUILD, FLAGS, PRIVATE_PREVIEW, PUBLIC_DEFAULTS, resolveFlags } from "../js/flags.js";
import { HOPENY_LINE, NOT_AFFILIATED_LINE, PAST_RESULTS_LINE, PRIVACY_MARKUP, SHELL_MARKUP, TERMS_MARKUP, shellMarkup } from "../js/markup.js";
import { buildPublic, SHIP } from "../scripts/build-public.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const PAGES = ["index.html", "privacy.html", "terms.html"];

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

const DIST = buildPublic(join(tmpdir(), `scratch-buddy-dist-test-${process.pid}`));
const TEXT_EXT = /\.(html|js|mjs|css|json|webmanifest|txt)$/;
const distText = walk(DIST).filter((f) => TEXT_EXT.test(f)).map((f) => ({ f: f.slice(DIST.length + 1), s: readFileSync(f, "utf8") }));
const ownText = distText.filter(({ f }) => !f.startsWith("vendor/") && f !== "data/retailers.json");
const rendered = [SHELL_MARKUP, PRIVACY_MARKUP, TERMS_MARKUP, ...PAGES.map(read)].join("\n");

test("public build: every flag is off, and only the private-preview meta turns preview flags on", () => {
    assert.equal(BUILD, "public");
    assert.deepEqual(Object.values(PUBLIC_DEFAULTS), Object.values(PUBLIC_DEFAULTS).map(() => false));
    assert.ok(Object.values(FLAGS).every((v) => v === false), JSON.stringify(FLAGS));
    assert.ok(Object.values(resolveFlags(null)).every((v) => v === false));
    const fakeDoc = (content) => ({ querySelector: () => ({ getAttribute: () => content }) });
    assert.ok(Object.values(resolveFlags(fakeDoc("something-else"))).every((v) => v === false));
    assert.equal(resolveFlags(fakeDoc("private-preview")).quickDrawVenue, true);
    // Reserved commercial flags stay off even in the private preview (Gate 0 / §206 hold).
    ["sharedAccounts", "pricing", "shareQr"].forEach((k) => assert.equal(PRIVATE_PREVIEW[k], false, k));
    PAGES.forEach((p) => assert.equal(/name="sb-build"/.test(read(p)), false, p));
    assert.equal(SHELL_MARKUP.includes("retailer-qd-only"), false);
    assert.equal(SHELL_MARKUP.includes("log-path-venue"), false);
    assert.equal(SHELL_MARKUP.includes("preview-banner"), false);
    assert.equal(/Quick Draw venue/.test(SHELL_MARKUP), false);
    assert.match(shellMarkup(PRIVATE_PREVIEW), /log-path-venue/);
});

test("copy rules: house lines present and banned words absent from every shipped surface", () => {
    PAGES.forEach((p) => {
        const html = read(p);
        assert.ok(html.includes(HOPENY_LINE), `${p} HOPENY`);
        assert.ok(html.includes(NOT_AFFILIATED_LINE), `${p} not affiliated`);
        assert.ok(html.includes(PAST_RESULTS_LINE), `${p} past results`);
        assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
    });
    [SHELL_MARKUP, PRIVACY_MARKUP, TERMS_MARKUP].forEach((m) => {
        assert.ok(m.includes(HOPENY_LINE));
        assert.ok(m.includes(NOT_AFFILIATED_LINE));
    });
    assert.equal(HOPENY_LINE, "18+. Gambling problem? Call 1-877-8-HOPENY or text HOPENY (467369).");
    const banned = [/\blive\b/i, /real-time/i, /real time/i, /\bwin\b/i, /\bwins\b/i, /\bwinn(er|ers|ing)\b/i, /\bwon\b/i, /jackpot/i,
        /penny arcade/i, /®/, /™/, /\blucky?\b/i, /\bhot (store|spot)s?\b/i, /\bheat\b/i, /\bpayout/i, /\bodds\b/i, /\bguarantee/i];
    for (const { f, s } of ownText) {
        banned.forEach((re) => assert.equal(re.test(s), false, `${re} in ${f}`));
    }
    banned.forEach((re) => assert.equal(re.test(rendered), false, `${re} in rendered markup`));
    // "predict" only inside the required D1 line.
    assert.equal(rendered.replaceAll(PAST_RESULTS_LINE, "").toLowerCase().includes("predict"), false);
});

test("no ads, pixels, analytics, prices, buy buttons or Stripe in the public bundle", () => {
    const trackers = [/googletagmanager/i, /google-analytics/i, /\bgtag\(/, /\bfbq\(/, /connect\.facebook/i, /facebook\.net/i, /doubleclick\.net/i,
        /adsbygoogle/i, /goatcounter/i, /plausible/i, /mixpanel/i, /segment\.(io|com)/i, /hotjar/i, /clarity\.ms/i, /posthog/i,
        /amplitude/i, /tiktok/i, /sentry/i, /navigator\.sendBeacon/, /stripe/i, /paypal/i, /checkout/i, /\bbuy now\b/i,
        /\bsubscribe\b/i, /\bupgrade\b/i, /\$1\.99/, /\$17/, /\bper month\b|\/mo\b/i];
    // data/retailers.json is official state data (it lists real stores such as "STRIPES"), so it is
    // checked for hosts below rather than for words.
    for (const { f, s } of distText.filter(({ f }) => f !== "data/retailers.json")) {
        trackers.forEach((re) => assert.equal(re.test(s), false, `${re} in ${f}`));
    }
    const allowedHosts = new Set(["tile.openstreetmap.org", "www.openstreetmap.org", "data.ny.gov", "www.gamblersanonymous.org"]);
    for (const { f, s } of ownText) {
        for (const m of s.matchAll(/https?:\/\/(?:\{s\}\.)?([a-z0-9.-]+)/gi)) {
            assert.ok(allowedHosts.has(m[1].toLowerCase()), `unexpected host ${m[1]} in ${f}`);
        }
    }
});

test("relative asset paths only, and a valid home-screen manifest", () => {
    PAGES.forEach((p) => {
        for (const m of read(p).matchAll(/\s(?:src|href)="([^"]+)"/g)) {
            assert.ok(m[1].startsWith("./"), `${p}: ${m[1]} is not a relative ./ path`);
            const local = m[1].replace(/^\.\//, "").split(/[?#]/)[0];
            assert.ok(existsSync(join(ROOT, local)), `${p}: ${m[1]} missing`);
            assert.ok(SHIP.some((s) => local === s || local.startsWith(s + "/")), `${p}: ${m[1]} not shipped`);
        }
        assert.match(read(p), /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
        assert.match(read(p), /<link rel="apple-touch-icon"/);
    });
    for (const { f, s } of ownText.filter(({ f }) => f.startsWith("js/"))) {
        for (const m of s.matchAll(/(?:src|href)="(\/[^"]*)"/g)) assert.fail(`${f}: root-absolute path ${m[1]}`);
        for (const m of s.matchAll(/fetch\(\s*["'](\/[^"']*)/g)) assert.fail(`${f}: root-absolute fetch ${m[1]}`);
    }
    const manifest = JSON.parse(read("manifest.webmanifest"));
    assert.equal(manifest.name, "Scratch Buddy");
    assert.equal(manifest.display, "standalone");
    assert.ok(manifest.start_url.startsWith("./") && manifest.scope === "./");
    const sizes = manifest.icons.map((i) => i.sizes);
    assert.ok(sizes.includes("192x192") && sizes.includes("512x512"));
    assert.ok(manifest.icons.some((i) => i.purpose === "maskable"));
    manifest.icons.forEach((i) => {
        assert.ok(i.src.startsWith("./"));
        const buf = readFileSync(join(ROOT, i.src));
        const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
        assert.equal(`${w}x${h}`, i.sizes, i.src);
    });
});

test("no secrets in the public bundle", () => {
    const patterns = [/sk_(live|test)_[0-9a-z]/i, /rk_(live|test)_/i, /eyJhbGciOi/, /service_role/i, /AKIA[0-9A-Z]{16}/, /ghp_[0-9A-Za-z]{20}/,
        /github_pat_/, /xox[bap]-/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /supabase\.co/i, /\.secrets/, /password\s*[:=]/i];
    const secretFiles = [];
    const dir = join(homedir(), ".secrets");
    if (existsSync(dir)) {
        for (const name of readdirSync(dir)) {
            const full = join(dir, name);
            if (!statSync(full).isFile() || statSync(full).size > 4096) continue;
            const v = readFileSync(full, "utf8").trim();
            // Short letters-only values (the current preview passwords) are ordinary words that also
            // appear in normal copy, so a substring match proves nothing; they are reported as weak
            // in LAUNCH-READINESS.md instead. Everything key-like is checked.
            if (v.length >= 8 && !/^[A-Za-z -]{1,15}$/.test(v)) secretFiles.push({ name, v });
        }
    }
    for (const { f, s } of distText) {
        patterns.forEach((re) => assert.equal(re.test(s), false, `${re} in ${f}`));
        // Never print the secret; report only the file name.
        secretFiles.forEach(({ name, v }) => assert.equal(s.includes(v), false, `value of ~/.secrets/${name} found in ${f}`));
    }
    ["README.md", "COMPLIANCE.md", "supabase", "test", "scripts", "tests-ui"].forEach((x) => assert.equal(existsSync(join(DIST, x)), false, x));
});
