// Official per-store amounts from the local xyvi-fbb9 cache.
// preview-only, Ralph no-go. Behind officialStoreSales / officialSalesHeatMap / storeSalesSortFilter.

export const SALES_DATA_URL = "./data/retailer-sales.json";
export const NO_DATA = "no data";

export const OFFICIAL_FIELD_LABELS = {
    draw_paid: "Daily DRAW PAID Sales",
    ig_paid: "Daily IG PAID Sales",
    ig_settles: "Daily IG SETTLES Sales"
};

export const OFFICIAL_METRICS = ["ig_paid", "draw_paid", "ig_settles"];
export const OFFICIAL_RANGES = ["latest", "days7", "days30"];

export const SALES_HEAT_COLORS = [
    "#1e3a8a",
    "#1d4ed8",
    "#0ea5e9",
    "#22c55e",
    "#facc15",
    "#f97316",
    "#dc2626"
];

export const SELLS_SCRATCH_OFFS_LABEL = "Sells scratch-offs";

export function agentKey(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const stripped = text.replace(/^0+/, "");
    return stripped === "" ? "0" : stripped;
}

export function parseOfficialAmount(value) {
    if (value == null || value === "") return null;
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
}

export function formatOfficialAmount(value) {
    if (!Number.isFinite(value)) return NO_DATA;
    const sign = value < 0 ? "-" : "";
    const [whole, frac] = Math.abs(value).toFixed(2).split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${sign}$${grouped}.${frac}`;
}

export function formatIsoDate(isoDay) {
    if (!isoDay || !/^\d{4}-\d{2}-\d{2}$/.test(String(isoDay).slice(0, 10))) return null;
    const [year, month, day] = String(isoDay).slice(0, 10).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    return new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        month: "long",
        day: "numeric",
        year: "numeric"
    }).format(date);
}

function addUtcDays(isoDay, delta) {
    const [year, month, day] = String(isoDay).slice(0, 10).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + delta));
    return date.toISOString().slice(0, 10);
}

export function latestRangeLabel(cache, todayIso) {
    const day = cache && cache.latestBusinessDay;
    if (!day) return "Latest sales date";
    const pretty = formatIsoDate(day) || day;
    if (todayIso && day === addUtcDays(todayIso, -1)) {
        return `Yesterday (${pretty})`;
    }
    return `Latest sales date in this cache (${pretty})`;
}

export function rangeLabel(range, cache, todayIso) {
    if (range === "latest") return latestRangeLabel(cache, todayIso);
    if (range === "days7") {
        const start = cache && cache.window7Start ? (formatIsoDate(cache.window7Start) || cache.window7Start) : "";
        const end = cache && cache.latestBusinessDay ? (formatIsoDate(cache.latestBusinessDay) || cache.latestBusinessDay) : "";
        return start && end ? `7-day total (${start} to ${end})` : "7-day total";
    }
    if (range === "days30") {
        const start = cache && cache.window30Start ? (formatIsoDate(cache.window30Start) || cache.window30Start) : "";
        const end = cache && cache.latestBusinessDay ? (formatIsoDate(cache.latestBusinessDay) || cache.latestBusinessDay) : "";
        return start && end ? `30-day total (${start} to ${end})` : "30-day total";
    }
    return range;
}

export function salesForRetailer(cache, retailerId) {
    if (!cache || !cache.stores) return null;
    const key = agentKey(retailerId);
    if (!key) return null;
    return cache.stores[key] || null;
}

export function metricValue(store, metric, range) {
    const windowRow = store && store[range];
    if (!windowRow) return null;
    return parseOfficialAmount(windowRow[metric]);
}

export function sellsScratchOffs(store) {
    const amount = metricValue(store, "ig_settles", "days30");
    return Number.isFinite(amount) && amount > 0;
}

export function hasSalesIn30Days(store) {
    if (!store || !store.days30) return false;
    return OFFICIAL_METRICS.some((metric) => {
        const amount = parseOfficialAmount(store.days30[metric]);
        return Number.isFinite(amount) && amount > 0;
    });
}

export function filterAndSortRetailers(retailers, cache, {
    sortMetric = null,
    sortRange = "days30",
    sortDir = "desc",
    sellsScratchOffsOnly = false,
    hideNoSales = false,
    limit = null
} = {}) {
    const list = Array.isArray(retailers) ? retailers.slice() : [];
    const filtered = [];
    for (const row of list) {
        const store = salesForRetailer(cache, row && row.id);
        if (hideNoSales && !hasSalesIn30Days(store)) continue;
        if (sellsScratchOffsOnly && !sellsScratchOffs(store)) continue;
        filtered.push(row);
    }
    if (sortMetric && OFFICIAL_METRICS.includes(sortMetric) && OFFICIAL_RANGES.includes(sortRange)) {
        const missing = sortDir === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
        filtered.sort((a, b) => {
            const aVal = metricValue(salesForRetailer(cache, a.id), sortMetric, sortRange);
            const bVal = metricValue(salesForRetailer(cache, b.id), sortMetric, sortRange);
            const aNum = Number.isFinite(aVal) ? aVal : missing;
            const bNum = Number.isFinite(bVal) ? bVal : missing;
            if (aNum === bNum) return 0;
            return sortDir === "asc" ? aNum - bNum : bNum - aNum;
        });
    }
    if (Number.isFinite(limit) && limit >= 0) {
        return {
            total: filtered.length,
            rows: filtered.slice(0, limit),
            truncated: filtered.length > limit
        };
    }
    return { total: filtered.length, rows: filtered, truncated: false };
}

export function quantileBreaks(values, binCount = SALES_HEAT_COLORS.length) {
    const sorted = (values || []).filter((value) => Number.isFinite(value)).slice().sort((a, b) => a - b);
    if (!sorted.length || binCount < 2) return [];
    const breaks = [];
    for (let i = 1; i < binCount; i += 1) {
        const index = Math.min(sorted.length - 1, Math.floor((i / binCount) * sorted.length));
        const value = sorted[index];
        if (!breaks.length || value !== breaks[breaks.length - 1]) breaks.push(value);
    }
    return breaks;
}

export function colorForAmount(value, breaks, colors = SALES_HEAT_COLORS) {
    if (!Number.isFinite(value) || !colors.length) return null;
    let index = 0;
    while (index < breaks.length && value > breaks[index]) index += 1;
    return colors[Math.min(index, colors.length - 1)];
}

export function legendItems(breaks, colors = SALES_HEAT_COLORS, values = []) {
    const finite = (values || []).filter((value) => Number.isFinite(value));
    if (!finite.length || !colors.length) return [];
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const edges = [min, ...breaks, max];
    const items = [];
    for (let i = 0; i < colors.length; i += 1) {
        const from = edges[Math.min(i, edges.length - 1)];
        const to = edges[Math.min(i + 1, edges.length - 1)];
        if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
        if (i > 0 && from === to && i === colors.length - 1) continue;
        items.push({
            color: colors[Math.min(i, colors.length - 1)],
            from,
            to,
            label: from === to
                ? formatOfficialAmount(from)
                : `${formatOfficialAmount(from)} – ${formatOfficialAmount(to)}`
        });
    }
    return items;
}

export function officialSalesCaveat(cache) {
    const source = (cache && cache.source) || "Lottery Daily Retailer Sales (By Game): Beginning 2024";
    const datasetId = (cache && cache.datasetId) || "xyvi-fbb9";
    return [
        `Source: ${source} (NY Open Data dataset ${datasetId}), published by the New York State Gaming Commission.`,
        "This is unaudited NY Open Data.",
        "Under-$600 cash-outs only show where tickets were cashed.",
        "A missing official row is shown as no data; it is not replaced with a made-up number."
    ].join(" ");
}

export async function loadOfficialSalesCache(url = SALES_DATA_URL, fetchFn = fetch) {
    const response = await fetchFn(url, { cache: "no-store" });
    if (!response.ok) {
        throw new Error("The official retailer sales cache could not be loaded.");
    }
    const payload = await response.json();
    const stores = payload && payload.stores && typeof payload.stores === "object" ? payload.stores : {};
    return {
        source: payload.source || "Lottery Daily Retailer Sales (By Game): Beginning 2024",
        sourceAgency: payload.sourceAgency || "",
        datasetId: payload.datasetId || "xyvi-fbb9",
        sourcePage: payload.sourcePage || "",
        retrievedAt: payload.retrievedAt || "",
        sourceRowsUpdatedAt: payload.sourceRowsUpdatedAt || "",
        latestBusinessDay: payload.latestBusinessDay || "",
        window7Start: payload.window7Start || "",
        window30Start: payload.window30Start || "",
        officialFields: payload.officialFields || OFFICIAL_FIELD_LABELS,
        notes: payload.notes || "",
        storeCount: Number.isInteger(payload.storeCount) ? payload.storeCount : Object.keys(stores).length,
        stores
    };
}
