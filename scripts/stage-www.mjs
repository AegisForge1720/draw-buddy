import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const www = join(root, "www");

await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });

const files = ["index.html", "terms.html", "privacy.html", "manifest.webmanifest", "sw.js"];
const dirs = ["css", "js", "icons", "vendor"];

for (const file of files) {
    await cp(join(root, file), join(www, file));
}
for (const dir of dirs) {
    await cp(join(root, dir), join(www, dir), { recursive: true });
}

console.log("Staged Capacitor web assets in www/. Do not commit that folder.");
