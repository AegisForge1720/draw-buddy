// preview-only, Ralph no-go user-log heat layer (verification weights).
// Behind FEATURES.userLogHeatLayer. Not for public use.

import { verificationFlags } from "./logs.js";

export function heatWeight(flags) {
    const set = new Set(flags || []);
    if (set.has("location-confirmed") && set.has("photo-attached")) return 3;
    if (set.has("location-confirmed") || set.has("photo-attached")) return 2;
    return 1;
}

export function heatColor(flags) {
    const set = new Set(flags || []);
    if (set.has("location-confirmed") && set.has("photo-attached")) return "#facc15";
    if (set.has("location-confirmed")) return "#22d3ee";
    if (set.has("photo-attached")) return "#f59e0b";
    return "#64748b";
}

export function aggregateLogHeat(logs) {
    const groups = new Map();
    for (const log of logs || []) {
        if (!log || !Number.isFinite(log.retailerLat) || !Number.isFinite(log.retailerLng)) continue;
        const key = log.retailerId || `${log.retailerLat},${log.retailerLng}`;
        let group = groups.get(key);
        if (!group) {
            group = {
                retailerId: log.retailerId,
                retailerName: log.retailerName,
                street: log.retailerStreet || "",
                city: log.retailerCity || "",
                zip: log.retailerZip || "",
                lat: log.retailerLat,
                lng: log.retailerLng,
                entries: [],
                count: 0,
                weight: 0,
                unverified: 0,
                locationConfirmed: 0,
                photoAttached: 0,
                both: 0
            };
            groups.set(key, group);
        }
        const flags = Array.isArray(log.verification)
            ? log.verification
            : verificationFlags(log);
        group.entries.push(log);
        group.count += 1;
        group.weight += heatWeight(flags);
        const set = new Set(flags);
        if (set.has("location-confirmed") && set.has("photo-attached")) group.both += 1;
        else if (set.has("location-confirmed")) group.locationConfirmed += 1;
        else if (set.has("photo-attached")) group.photoAttached += 1;
        else group.unverified += 1;
    }
    return [...groups.values()];
}

export function logHeatStyle(group) {
    const flags = [];
    if ((group && group.both > 0) || (group && group.locationConfirmed > 0 && group.photoAttached > 0)) {
        flags.push("location-confirmed", "photo-attached");
    } else if (group && group.locationConfirmed > 0) {
        flags.push("location-confirmed");
    } else if (group && group.photoAttached > 0) {
        flags.push("photo-attached");
    } else {
        flags.push("unverified");
    }
    const weight = Number(group && group.weight) || 1;
    return {
        flags,
        color: heatColor(flags),
        weight,
        radius: 10 + Math.min(weight, 10) * 3
    };
}

export const LOG_HEAT_LEGEND = [
    { color: "#facc15", label: "GPS check-in and photo on this device" },
    { color: "#22d3ee", label: "GPS check-in near store" },
    { color: "#f59e0b", label: "Photo on this device" },
    { color: "#64748b", label: "Self-reported only" }
];
