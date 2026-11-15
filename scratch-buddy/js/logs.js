export const LOG_KEY = "scratch_buddy_prize_logs";

export function todayInNewYork(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(now);
    const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${lookup.year}-${lookup.month}-${lookup.day}`;
}


export function verificationFlags({ locationConfirmed, photoAttached }) {
    const flags = [];
    if (locationConfirmed) flags.push("location-confirmed");
    if (photoAttached) flags.push("photo-attached");
    if (!flags.length) flags.push("unverified");
    return flags;
}

export function verificationLabel(flags) {
    const set = new Set(flags || []);
    if (set.has("location-confirmed") && set.has("photo-attached")) {
        return "Location-confirmed and photo-attached";
    }
    if (set.has("location-confirmed")) return "Location-confirmed";
    if (set.has("photo-attached")) return "Photo-attached";
    return "Unverified";
}

// Heat-map weight: unverified 1, either confirmation 2, both 3 (1+2, or 2+2 capped conceptually as both=3).
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

function readMoney(value) {
    if (typeof value === "number") return value;
    const text = String(value ?? "").trim().replace(/^[$\s]+/, "");
    if (text === "") return Number.NaN;
    return Number(text);
}

export function parsePrizeLog(input) {
    const game = String(input.game || "").trim();
    const prizeAmount = readMoney(input.prizeAmount);
    const ticketPrice = input.ticketPrice === "" || input.ticketPrice == null
        ? null
        : readMoney(input.ticketPrice);
    const occurredOn = String(input.occurredOn || "").trim();
    const retailerId = String(input.retailerId || "").trim();
    const retailerName = String(input.retailerName || "").trim();
    const path = input.path === "bought_at_venue" ? "bought_at_venue" : "standard";
    const presentConfirmed = input.presentConfirmed === true;
    const locationConfirmed = input.locationConfirmed === true;
    const photoAttached = input.photoAttached === true;

    if (!input.handle) return { ok: false, reason: "Sign in on this device before logging a prize." };
    if (!game) return { ok: false, reason: "Enter the game name." };
    if (!Number.isFinite(prizeAmount) || prizeAmount <= 0) {
        return { ok: false, reason: "Enter the prize amount paid to you." };
    }
    if (ticketPrice != null && (!Number.isFinite(ticketPrice) || ticketPrice < 0)) {
        return { ok: false, reason: "Enter the ticket price you paid, or leave it blank." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
        return { ok: false, reason: "Enter the date for this prize." };
    }
    if (input.today && occurredOn > input.today) {
        return { ok: false, reason: "The date cannot be in the future." };
    }
    if (!retailerId || !retailerName) {
        return { ok: false, reason: "Pick the retailer or venue from the official list." };
    }
    if (!presentConfirmed) {
        return { ok: false, reason: "Confirm that you were at this location." };
    }
    if (path === "bought_at_venue" && !input.retailerQuickDraw) {
        return { ok: false, reason: "The venue path is only for retailers the official list marks as offering Quick Draw." };
    }
    if (path === "bought_at_venue" && !photoAttached) {
        return { ok: false, reason: "The venue path needs a photo of the ticket." };
    }

    const flags = verificationFlags({ locationConfirmed, photoAttached });
    return {
        ok: true,
        log: {
            id: input.id || (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}`),
            createdAt: input.createdAt || new Date().toISOString(),
            handle: String(input.handle).trim(),
            path,
            game,
            prizeAmount,
            ticketPrice,
            occurredOn,
            retailerId,
            retailerName,
            retailerStreet: input.retailerStreet || "",
            retailerCity: input.retailerCity || "",
            retailerZip: input.retailerZip || "",
            retailerLat: Number.isFinite(input.retailerLat) ? input.retailerLat : null,
            retailerLng: Number.isFinite(input.retailerLng) ? input.retailerLng : null,
            retailerQuickDraw: Boolean(input.retailerQuickDraw),
            presentConfirmed: true,
            locationConfirmed,
            checkin: locationConfirmed ? (input.checkin || null) : null,
            photoAttached,
            photoId: photoAttached ? (input.photoId || null) : null,
            verification: flags,
            localOnly: true
        }
    };
}

export function loadLogs(storage = localStorage) {
    try {
        const parsed = JSON.parse(storage.getItem(LOG_KEY) || "null");
        return Array.isArray(parsed) ? parsed.filter((row) => row && row.retailerId && row.game) : [];
    } catch {
        return [];
    }
}

export function saveLogs(logs, storage = localStorage) {
    storage.setItem(LOG_KEY, JSON.stringify(logs));
}

export function aggregatePayouts(logs) {
    const groups = new Map();
    for (const log of logs || []) {
        if (!log || !Number.isFinite(log.retailerLat) || !Number.isFinite(log.retailerLng)) continue;
        if (!Number.isFinite(log.prizeAmount) || log.prizeAmount <= 0) continue;
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
                count: 0,
                prizeTotal: 0,
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
        group.count += 1;
        group.prizeTotal += log.prizeAmount;
        group.weight += heatWeight(flags);
        const set = new Set(flags);
        if (set.has("location-confirmed") && set.has("photo-attached")) group.both += 1;
        else if (set.has("location-confirmed")) group.locationConfirmed += 1;
        else if (set.has("photo-attached")) group.photoAttached += 1;
        else group.unverified += 1;
    }
    return [...groups.values()];
}

export function formatDollars(amount) {
    if (!Number.isFinite(amount)) return "Data unavailable";
    const sign = amount < 0 ? "-" : "";
    const [whole, frac] = Math.abs(amount).toFixed(2).split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${sign}$${grouped}.${frac}`;
}
