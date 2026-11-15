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

export const LABEL_SELF_REPORTED = "Self-reported";
export const LABEL_GPS_CHECKIN = "GPS check-in near store";
export const LABEL_PHOTO = "Photo on this device";

export function verificationLabel(flags) {
    const set = new Set(flags || []);
    if (set.has("location-confirmed") && set.has("photo-attached")) {
        return `${LABEL_GPS_CHECKIN} and ${LABEL_PHOTO.toLowerCase()}`;
    }
    if (set.has("location-confirmed")) return LABEL_GPS_CHECKIN;
    if (set.has("photo-attached")) return LABEL_PHOTO;
    return LABEL_SELF_REPORTED;
}

export function dateOnly(value) {
    const text = String(value || "").trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    return null;
}

const ALLOWED_BANDS = new Set(["<50 m", "50-150 m"]);

// Keep only pass/fail, the date, and a coarse distance band. Drop coordinates.
export function sanitizeCheckin(checkin) {
    if (!checkin || typeof checkin !== "object" || checkin.ok !== true) return null;
    let band = checkin.distanceBand;
    if (!ALLOWED_BANDS.has(band) && Number.isFinite(checkin.distanceM)) {
        if (checkin.distanceM < 50) band = "<50 m";
        else if (checkin.distanceM <= 150) band = "50-150 m";
        else band = null;
    }
    if (!ALLOWED_BANDS.has(band)) band = null;
    return {
        ok: true,
        at: dateOnly(checkin.at),
        distanceBand: band
    };
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
            checkin: locationConfirmed ? sanitizeCheckin(input.checkin) : null,
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
        if (!Array.isArray(parsed)) return [];
        let changed = false;
        const rows = [];
        for (const row of parsed) {
            if (!row || !row.retailerId || !row.game) continue;
            if (row.checkin) {
                const clean = sanitizeCheckin(row.checkin);
                if (clean !== row.checkin) {
                    const hadCoords = row.checkin && ("lat" in row.checkin || "lng" in row.checkin || "accuracyM" in row.checkin || "distanceM" in row.checkin);
                    if (hadCoords || JSON.stringify(clean) !== JSON.stringify(row.checkin)) changed = true;
                    row.checkin = clean;
                }
            }
            rows.push(row);
        }
        if (changed) storage.setItem(LOG_KEY, JSON.stringify(rows));
        return rows;
    } catch {
        return [];
    }
}

export function saveLogs(logs, storage = localStorage) {
    storage.setItem(LOG_KEY, JSON.stringify(logs));
}

// Group this device's prize logs by retailer for My Log Map.
// Stores are not ranked, weighted, or totaled.
export function groupLogsByRetailer(logs) {
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
                entries: []
            };
            groups.set(key, group);
        }
        group.entries.push(log);
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
