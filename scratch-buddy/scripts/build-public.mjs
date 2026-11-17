// Build the public Scratch Buddy bundle into scratch-buddy/dist/ (gitignored).
// Copies only the files the app needs at runtime. README, COMPLIANCE, tests, Supabase drafts,
// the Tailwind source and brand masters are left out. Fails if any shipped page carries the
// private-preview meta, so a dist/ folder is always the public build (all flags off).
// Usage: node scratch-buddy/scripts/build-public.mjs
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist");

export const SHIP = [
    "index.html",
    "privacy.html",
    "terms.html",
    "manifest.webmanifest",
    "robots.txt",
    "js",
    "css/app.css",
    "css/tailwind.css",
    "data/retailers.json",
    "vendor",
    "brand/favicon.png",
    "brand/icon-192.png",
    "brand/apple-touch-icon.png",
    "brand/scratch-buddy-192.png",
    "brand/scratch-buddy-512.png",
    "brand/scratch-buddy-maskable-512.png",
    "brand/scratch-buddy-transparent-1024.png"
];

export function buildPublic(out = OUT) {
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    for (const rel of SHIP) {
        const src = join(ROOT, rel);
        if (!existsSync(src)) throw new Error(`Missing ship file: ${rel}`);
        const dest = join(out, rel);
        mkdirSync(dirname(dest), { recursive: true });
        cpSync(src, dest, { recursive: statSync(src).isDirectory() });
    }
    for (const page of ["index.html", "privacy.html", "terms.html"]) {
        const html = readFileSync(join(out, page), "utf8");
        if (/name="sb-build"/.test(html)) throw new Error(`${page} carries a build meta; public builds must not.`);
        if (!/<meta name="robots" content="noindex,nofollow">/.test(html)) throw new Error(`${page} lost noindex.`);
    }
    return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    console.log(`Public build written to ${buildPublic()}`);
}
