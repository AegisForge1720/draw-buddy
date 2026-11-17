// Refresh data/retailers.json from the official NYS Lottery Retailers dataset (data.ny.gov 2vvn-pdyi).
// Ralph's review item 11: keep the cache current (at least weekly) and show the retrieval date.
// Every row comes from the official API; nothing is added or invented. Rows without published
// coordinates are counted in missingCoordinatesCount and kept (search still finds them).
// Usage: node scratch-buddy/scripts/refresh-retailers.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "retailers.json");
const API = "https://data.ny.gov/resource/2vvn-pdyi.json";
const META = "https://data.ny.gov/api/views/2vvn-pdyi.json";

function nyIso(date) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "longOffset"
    }).formatToParts(date).map((p) => [p.type, p.value]));
    const offset = (parts.timeZoneName || "GMT-05:00").replace("GMT", "") || "+00:00";
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

const meta = await (await fetch(META)).json();
const rows = [];
for (let offset = 0; ; offset += 50000) {
    const res = await fetch(`${API}?$limit=50000&$offset=${offset}&$order=retailer`);
    if (!res.ok) throw new Error(`data.ny.gov returned ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 50000) break;
}
const retailers = rows.map((r) => {
    const lat = Number.parseFloat(r.latitude), lng = Number.parseFloat(r.longitude);
    return {
        id: String(r.retailer || "").trim(),
        name: String(r.name || "").trim(),
        street: String(r.street || "").trim(),
        city: String(r.city || "").trim(),
        state: String(r.state || "").trim(),
        zip: String(r.zip || "").trim(),
        quickDraw: String(r.quick_draw || "").trim().toUpperCase() === "Y",
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null
    };
}).filter((r) => r.id && r.name).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
if (retailers.length < 1000) throw new Error(`Only ${retailers.length} rows; refusing to overwrite the cache.`);
const payload = {
    source: "NYS Lottery Retailers",
    sourceAgency: "New York State Gaming Commission, published on NY Open Data (data.ny.gov)",
    datasetId: "2vvn-pdyi",
    sourcePage: "https://data.ny.gov/Government-Finance/NYS-Lottery-Retailers/2vvn-pdyi",
    sourceApi: API,
    retrievedAt: nyIso(new Date()),
    retrievedAtTimeZone: "America/New_York",
    sourceRowsUpdatedAt: meta.rowsUpdatedAt ? nyIso(new Date(meta.rowsUpdatedAt * 1000)) : "",
    count: retailers.length,
    quickDrawCount: retailers.filter((r) => r.quickDraw).length,
    missingCoordinatesCount: retailers.filter((r) => r.lat == null || r.lng == null).length,
    notes: "This is a local cache of every row in the official active-licensed-retailer listing. The source lists licensed retailer locations that sell New York Lottery products; it does not identify individual ticket machines, and it does not flag which locations sell scratch-off tickets separately from other lottery products. quickDraw is true when the official Quick Draw field is Y.",
    retailers
};
writeFileSync(OUT, JSON.stringify(payload) + "\n");
console.log(`Wrote ${retailers.length} rows (retrieved ${payload.retrievedAt}; official rows updated ${payload.sourceRowsUpdatedAt}).`);
