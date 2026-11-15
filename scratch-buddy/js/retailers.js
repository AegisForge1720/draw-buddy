import { haversineMeters } from "./geo.js";

export const RETAILER_DATA_URL = "./data/retailers.json";
export const SEARCH_LIMIT = 100;
export const NEARBY_LIMIT = 50;
export const MAP_BOUNDS_LIMIT = 400;

export function normalizeQuery(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function retailerHaystack(retailer) {
    if (!retailer) return "";
    return normalizeQuery([
        retailer.name,
        retailer.street,
        retailer.city,
        retailer.state
    ].join(" "));
}

export function retailerZip(retailer) {
    return normalizeQuery(retailer && retailer.zip).replace(/ /g, "");
}

export function retailerId(retailer) {
    return normalizeQuery(retailer && retailer.id).replace(/ /g, "");
}

function tokenMatchesRetailer(token, row) {
    if (retailerHaystack(row).includes(token)) return true;
    const zip = retailerZip(row);
    if (zip && (zip === token || zip.startsWith(token))) return true;
    const id = retailerId(row);
    // IDs match exactly, so a ZIP like 14622 does not hit an id such as 114622.
    if (id && id === token) return true;
    return false;
}

export function searchRetailers(retailers, query, { quickDrawOnly = false, limit = SEARCH_LIMIT } = {}) {
    const list = Array.isArray(retailers) ? retailers : [];
    const tokens = normalizeQuery(query).split(" ").filter(Boolean);
    const pool = quickDrawOnly ? list.filter((row) => row.quickDraw) : list;
    if (!tokens.length) {
        return { total: 0, rows: [], truncated: false, emptyQuery: true };
    }
    const matches = [];
    for (const row of pool) {
        if (tokens.every((token) => tokenMatchesRetailer(token, row))) matches.push(row);
    }
    return {
        total: matches.length,
        rows: matches.slice(0, limit),
        truncated: matches.length > limit,
        emptyQuery: false
    };
}

export function nearbyRetailers(retailers, lat, lng, { limit = NEARBY_LIMIT, quickDrawOnly = false, distanceFn = haversineMeters } = {}) {
    const list = Array.isArray(retailers) ? retailers : [];
    const withDistance = [];
    for (const row of list) {
        if (quickDrawOnly && !row.quickDraw) continue;
        if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
        const distanceM = distanceFn(lat, lng, row.lat, row.lng);
        if (!Number.isFinite(distanceM)) continue;
        withDistance.push({ ...row, distanceM });
    }
    withDistance.sort((a, b) => a.distanceM - b.distanceM);
    return withDistance.slice(0, limit);
}

export function retailersInBounds(retailers, bounds, { limit = MAP_BOUNDS_LIMIT, quickDrawOnly = false } = {}) {
    const list = Array.isArray(retailers) ? retailers : [];
    const rows = [];
    for (const row of list) {
        if (quickDrawOnly && !row.quickDraw) continue;
        if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
        if (row.lat < bounds.south || row.lat > bounds.north) continue;
        if (row.lng < bounds.west || row.lng > bounds.east) continue;
        rows.push(row);
        if (rows.length >= limit) break;
    }
    return { rows, capped: rows.length >= limit };
}

export function findRetailerById(retailers, id) {
    const target = String(id || "");
    return (retailers || []).find((row) => row.id === target) || null;
}

export function formatRetailerAddress(retailer) {
    if (!retailer) return "";
    const line = [retailer.street, retailer.city, retailer.state, retailer.zip].filter(Boolean).join(", ");
    return line;
}

export async function loadRetailerCache(url = RETAILER_DATA_URL, fetchFn = fetch) {
    const response = await fetchFn(url, { cache: "no-store" });
    if (!response.ok) {
        throw new Error("The retailer cache could not be loaded.");
    }
    const payload = await response.json();
    const retailers = Array.isArray(payload && payload.retailers) ? payload.retailers : [];
    return {
        source: payload.source || "Unknown source",
        sourceAgency: payload.sourceAgency || "",
        datasetId: payload.datasetId || "",
        sourcePage: payload.sourcePage || "",
        retrievedAt: payload.retrievedAt || "",
        sourceRowsUpdatedAt: payload.sourceRowsUpdatedAt || "",
        count: Number.isInteger(payload.count) ? payload.count : retailers.length,
        quickDrawCount: Number.isInteger(payload.quickDrawCount) ? payload.quickDrawCount : retailers.filter((row) => row.quickDraw).length,
        notes: payload.notes || "",
        retailers
    };
}

export function formatCacheTimestamp(iso) {
    if (!iso || typeof iso !== "string") return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const formatted = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short"
    }).format(date);
    return formatted.replace(/ (EST|EDT|GMT-5|GMT-4)$/, " ET");
}
