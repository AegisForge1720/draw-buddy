// Single config for preview-only, Ralph no-go features on scratch-buddy-full-preview.
// Every flag below defaults to OFF. Do not turn these on in this file.
// Andrew can switch each one on in the in-app "Preview features" panel.
// These features are preview-only, Ralph no-go, and must not be merged into
// scratch-buddy-wip or main, or served on the compliant 8876 preview.

export const PREVIEW_FLAG_STORAGE_KEY = "scratch_buddy_preview_flags";
export const PREVIEW_FLAG_NOGO_LABEL = "preview-only, Ralph no-go";

// preview-only, Ralph no-go — defaults are all OFF.
export const FEATURE_FLAG_DEFAULTS = {
    officialStoreSales: false,
    officialSalesHeatMap: false,
    userLogHeatLayer: false,
    storeSalesSortFilter: false,
    prizesRemainingTable: false
};

// preview-only, Ralph no-go — labels shown in the Preview features panel.
export const FEATURE_FLAG_ITEMS = [
    {
        id: "officialStoreSales",
        name: "Official store amounts",
        blurb: "Show official Daily DRAW PAID Sales, Daily IG PAID Sales, and Daily IG SETTLES Sales on each store."
    },
    {
        id: "officialSalesHeatMap",
        name: "Official amounts heat map",
        blurb: "Color-coded official per-store amounts, with a legend and metric and date-range toggles."
    },
    {
        id: "userLogHeatLayer",
        name: "My log heat layer",
        blurb: "Optional heat layer of your own prize logs, sized and colored by verification weight."
    },
    {
        id: "storeSalesSortFilter",
        name: "Store sort and filters",
        blurb: "Sort and filter stores by official amounts, tag Sells scratch-offs, and hide stores with no sales in 30 days."
    },
    {
        id: "prizesRemainingTable",
        name: "Prizes remaining table",
        blurb: "Statewide official prize-status counts per game from nzqa-7unk."
    }
];

function readOverrides(storage) {
    try {
        const parsed = JSON.parse(storage.getItem(PREVIEW_FLAG_STORAGE_KEY) || "null");
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

export function readFeatureFlags(storage) {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : { getItem() { return null; } });
    const overrides = readOverrides(store);
    const flags = { ...FEATURE_FLAG_DEFAULTS };
    for (const key of Object.keys(FEATURE_FLAG_DEFAULTS)) {
        if (typeof overrides[key] === "boolean") flags[key] = overrides[key];
    }
    return flags;
}

export function writeFeatureFlag(name, on, storage) {
    if (!Object.prototype.hasOwnProperty.call(FEATURE_FLAG_DEFAULTS, name)) return readFeatureFlags(storage);
    const store = storage || localStorage;
    const flags = readFeatureFlags(store);
    flags[name] = on === true;
    store.setItem(PREVIEW_FLAG_STORAGE_KEY, JSON.stringify(flags));
    return flags;
}

// Current snapshot. Defaults are OFF unless the Preview features panel overrode them on this device.
export const FEATURES = readFeatureFlags();

export function isFeatureOn(name, flags = FEATURES) {
    return flags[name] === true;
}

export function anyOfficialPreviewFlagOn(flags = FEATURES) {
    return Object.values(flags).some(Boolean);
}

export function refreshFeatureFlags(storage) {
    const next = readFeatureFlags(storage);
    for (const key of Object.keys(FEATURE_FLAG_DEFAULTS)) {
        FEATURES[key] = next[key];
    }
    return FEATURES;
}
