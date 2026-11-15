import { AGE_BLOCK_KEY, classifyDob, readAgePass, writeAgePass } from "./age.js";
import { evaluateCheckIn, formatDistance, haversineMeters, requestDevicePosition } from "./geo.js";
import {
    aggregatePayouts,
    formatDollars,
    heatGroupStyle,
    loadLogs,
    parsePrizeLog,
    saveLogs,
    todayInNewYork,
    verificationLabel
} from "./logs.js";
import { createPayoutHeatMap, createRetailerMap, waitForLeaflet } from "./map.js";
import { SHELL_MARKUP } from "./markup.js";
import { deletePhoto, getPhoto, isImageFile, photoObjectUrl, savePhoto } from "./photos.js";
import {
    formatCacheTimestamp,
    formatRetailerAddress,
    findRetailerById,
    loadRetailerCache,
    nearbyRetailers,
    searchRetailers
} from "./retailers.js";
import { clearSession, readSession, writeSession } from "./session.js";

const FAIL_COPY = {
    under13: "Sorry — Scratch Buddy is not offered to children under 13.",
    under18: "Sorry — Scratch Buddy is for adults 18 and over."
};

function $(id) {
    return document.getElementById(id);
}

function sessionAgeBlocked() {
    try {
        return sessionStorage.getItem(AGE_BLOCK_KEY) === "1";
    } catch {
        return false;
    }
}

function showAgeFail(outcome) {
    try {
        sessionStorage.setItem(AGE_BLOCK_KEY, "1");
    } catch {
        /* Private mode can block session storage. */
    }
    const card = $("age-gate").querySelector(".age-card");
    card.replaceChildren();
    const title = document.createElement("h2");
    title.id = "age-gate-title";
    title.tabIndex = -1;
    title.textContent = FAIL_COPY[outcome] || FAIL_COPY.under18;
    card.appendChild(title);
    document.documentElement.classList.remove("age-cleared");
    $("app-shell").inert = true;
    title.focus();
}

const findState = {
    cache: null,
    loadError: null,
    loadPromise: null,
    listedRows: [],
    listedKind: "none",
    lastPosition: null
};

const mapState = {
    api: null,
    promise: null
};

const logState = {
    session: null,
    path: "standard",
    selectedRetailer: null,
    checkin: null,
    photoFile: null,
    photoPreviewUrl: null,
    logs: []
};

const heatState = {
    api: null,
    promise: null
};

function showTab(name) {
    const tabs = document.querySelectorAll('[role="tab"]');
    const panels = {
        find: $("panel-find"),
        map: $("panel-map"),
        log: $("panel-log"),
        heat: $("panel-heat")
    };
    tabs.forEach((tab) => {
        const selected = tab.dataset.tab === name;
        tab.setAttribute("aria-selected", selected ? "true" : "false");
    });
    Object.entries(panels).forEach(([key, panel]) => {
        if (!panel) return;
        panel.hidden = key !== name;
    });
    if (name === "map") {
        ensureMap().then((api) => {
            if (api) api.invalidate();
        });
    }
    if (name === "heat") {
        ensureHeatMap().then((api) => {
            if (api) api.invalidate();
        });
    }
}

function formatCount(value) {
    return Number(value).toLocaleString("en-US");
}

function describeSource(cache) {
    const retrieved = formatCacheTimestamp(cache.retrievedAt);
    const sourceUpdated = formatCacheTimestamp(cache.sourceRowsUpdatedAt);
    const page = cache.sourcePage || "https://data.ny.gov/Government-Finance/NYS-Lottery-Retailers/2vvn-pdyi";
    const retrievedLine = retrieved
        ? `This cache was retrieved ${retrieved}.`
        : "The retrieved-at date is not in this cache.";
    const updatedLine = sourceUpdated
        ? ` The official rows were last updated ${sourceUpdated}.`
        : "";
    const countLine = Number.isInteger(cache.count)
        ? ` ${formatCount(cache.count)} licensed retailer locations`
        : "";
    const qdLine = Number.isInteger(cache.quickDrawCount)
        ? ` (${formatCount(cache.quickDrawCount)} marked Quick Draw).`
        : ".";
    return {
        html: [
            `Source: <a href="${page}" target="_blank" rel="noopener noreferrer">${cache.source || "NYS Lottery Retailers"}</a>`,
            cache.sourceAgency ? `, ${cache.sourceAgency}` : "",
            cache.datasetId ? `, dataset ${cache.datasetId}` : "",
            ". ",
            retrievedLine,
            updatedLine,
            countLine,
            qdLine,
            " This is a list of licensed locations, not individual ticket machines. The official dataset does not flag which locations sell scratch-off tickets separately from other lottery products."
        ].join("")
    };
}

function renderResults(rows) {
    const list = $("retailer-results");
    list.replaceChildren();
    rows.forEach((row) => {
        const item = document.createElement("li");
        item.className = "retailer-card";

        const name = document.createElement("h3");
        name.textContent = row.name || "Unnamed retailer";
        item.appendChild(name);

        const address = document.createElement("p");
        address.textContent = formatRetailerAddress(row) || "Address not in the source data.";
        item.appendChild(address);

        const meta = document.createElement("div");
        meta.className = "retailer-meta";
        if (row.quickDraw) {
            const badge = document.createElement("span");
            badge.className = "qd-badge";
            badge.textContent = "Quick Draw venue";
            meta.appendChild(badge);
        }
        if (Number.isFinite(row.distanceM)) {
            const distance = document.createElement("span");
            distance.className = "distance-badge";
            distance.textContent = formatDistance(row.distanceM);
            meta.appendChild(distance);
        }
        if (meta.childElementCount) item.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "flex gap-2";
        if (Number.isFinite(row.lat) && Number.isFinite(row.lng)) {
            const show = document.createElement("button");
            show.type = "button";
            show.className = "btn-secondary btn-compact";
            show.textContent = "Show on map";
            show.addEventListener("click", () => showRetailerOnMap(row.id, { preferResults: true }));
            actions.appendChild(show);
        }
        const logHere = document.createElement("button");
        logHere.type = "button";
        logHere.className = "btn-secondary btn-compact";
        logHere.textContent = "Log a prize here";
        logHere.addEventListener("click", () => startLogForRetailer(row));
        actions.appendChild(logHere);
        item.appendChild(actions);
        list.appendChild(item);
    });
}

function updateMapModeButtons() {
    const allBtn = $("map-mode-all");
    const resultBtn = $("map-mode-results");
    const hasResults = findState.listedRows.length > 0;
    if (resultBtn) {
        resultBtn.disabled = !hasResults;
        const labelKind = findState.listedKind === "nearby" ? "Nearby results" : "Search results";
        const count = hasResults ? ` (${findState.listedRows.length})` : "";
        resultBtn.textContent = `${labelKind}${count}`;
    }
    const mode = mapState.api ? mapState.api.getMode() : "all";
    if (allBtn) allBtn.setAttribute("aria-pressed", mode === "all" ? "true" : "false");
    if (resultBtn) resultBtn.setAttribute("aria-pressed", mode === "results" ? "true" : "false");
}

function describeMapStatus() {
    const api = mapState.api;
    if (!api) return;
    const status = $("map-status");
    if (!status) return;
    if (api.getMode() === "results") {
        status.textContent = `Showing ${formatCount(api.resultCount())} result${api.resultCount() === 1 ? "" : "s"} from your search or Near me list. Gold markers are those locations. Switch to All locations to see the full official list. Tiles are from OpenStreetMap. Tap a marker or cluster for details.`;
        return;
    }
    status.textContent = `${formatCount(api.allCount())} licensed locations from the official cache, grouped into clusters. Tiles are from OpenStreetMap. Tap a cluster to zoom in, or tap a marker for details.`;
}

function syncMapResults() {
    if (!mapState.api) return;
    mapState.api.setResultRetailers(findState.listedRows);
    if (findState.lastPosition) mapState.api.setUserPosition(findState.lastPosition);
    updateMapModeButtons();
    describeMapStatus();
}

async function ensureMap() {
    if (mapState.api) {
        mapState.api.invalidate();
        return mapState.api;
    }
    if (mapState.promise) return mapState.promise;
    const status = $("map-status");
    mapState.promise = (async () => {
        try {
            if (status) status.textContent = "Loading the map…";
            await waitForLeaflet();
            if (findState.loadPromise) await findState.loadPromise;
            if (!findState.cache) {
                throw new Error(findState.loadError || "The official retailer list could not be loaded. No locations are shown.");
            }
            const container = $("retailer-map");
            if (!container) throw new Error("The map container is missing.");
            const api = createRetailerMap({
                container,
                formatAddress: formatRetailerAddress,
                onLogPrize: startLogForRetailer
            });
            const count = api.setAllRetailers(findState.cache.retailers);
            api.setResultRetailers(findState.listedRows);
            if (findState.lastPosition) api.setUserPosition(findState.lastPosition);
            api.applyMode("all");
            api.fitNewYork();
            mapState.api = api;
            requestAnimationFrame(() => api.invalidate());
            if (status && count === 0) {
                status.textContent = "No retailers with published coordinates are in this cache. No locations are shown.";
            } else {
                describeMapStatus();
            }
            updateMapModeButtons();
            container.dataset.ready = "true";
            return api;
        } catch (error) {
            const message = error && error.message
                ? error.message
                : "The map could not be loaded. No locations are shown.";
            if (status) status.textContent = message;
            mapState.promise = null;
            return null;
        }
    })();
    return mapState.promise;
}

async function showRetailerOnMap(id, { preferResults = false } = {}) {
    showTab("map");
    const api = await ensureMap();
    if (!api) return;
    api.invalidate();
    if (preferResults && findState.listedRows.length) {
        api.setResultRetailers(findState.listedRows);
        const mode = api.applyMode("results");
        if (mode === "results") {
            api.fitRows(findState.listedRows);
        }
    } else {
        api.applyMode("all");
    }
    updateMapModeButtons();
    describeMapStatus();
    requestAnimationFrame(() => {
        api.invalidate();
        const found = api.focusRetailer(id);
        if (!found) {
            const status = $("map-status");
            if (status) status.textContent = "That retailer has no published coordinates on the map.";
        }
    });
}

function bindMap() {
    const allBtn = $("map-mode-all");
    const resultBtn = $("map-mode-results");
    if (allBtn) {
        allBtn.addEventListener("click", async () => {
            const api = await ensureMap();
            if (!api) return;
            api.applyMode("all");
            api.fitNewYork();
            updateMapModeButtons();
            describeMapStatus();
        });
    }
    if (resultBtn) {
        resultBtn.addEventListener("click", async () => {
            if (!findState.listedRows.length) return;
            const api = await ensureMap();
            if (!api) return;
            api.setResultRetailers(findState.listedRows);
            api.applyMode("results");
            api.fitRows(findState.listedRows);
            updateMapModeButtons();
            describeMapStatus();
        });
    }
    updateMapModeButtons();
}

function setStatus(message) {
    const status = $("retailer-status");
    if (status) status.textContent = message;
}

function hideLocationPrompt() {
    const prompt = $("location-prompt");
    if (prompt) prompt.hidden = true;
}

function runSearch() {
    hideLocationPrompt();
    const cache = findState.cache;
    if (!cache) {
        renderResults([]);
        setStatus(findState.loadError || "The retailer list is not available yet. No retailers are shown.");
        return;
    }
    const query = $("retailer-query").value;
    const quickDrawOnly = $("retailer-qd-only").checked;
    const result = searchRetailers(cache.retailers, query, { quickDrawOnly });
    if (result.emptyQuery) {
        findState.listedRows = [];
        findState.listedKind = "none";
        renderResults([]);
        syncMapResults();
        if (mapState.api) {
            mapState.api.applyMode("all");
            updateMapModeButtons();
            describeMapStatus();
        }
        setStatus("Enter a name, address, city, or ZIP, or use Near me. The full official list is not shown all at once.");
        return;
    }
    findState.listedRows = result.rows;
    findState.listedKind = "search";
    renderResults(result.rows);
    syncMapResults();
    if (result.total === 0) {
        findState.listedRows = [];
        findState.listedKind = "none";
        setStatus("No retailers in this cache match that search.");
        return;
    }
    if (result.truncated) {
        setStatus(`Showing the first ${result.rows.length} of ${formatCount(result.total)} matching retailers. Use Show on map to open one on the Map tab.`);
        return;
    }
    setStatus(`${formatCount(result.total)} matching retailer${result.total === 1 ? "" : "s"}. Use Show on map to open one on the Map tab.`);
}

async function runNearMe() {
    const cache = findState.cache;
    if (!cache) {
        renderResults([]);
        setStatus(findState.loadError || "The retailer list is not available yet. No retailers are shown.");
        return;
    }
    setStatus("Getting your position…");
    try {
        const position = await requestDevicePosition();
        const quickDrawOnly = $("retailer-qd-only").checked;
        findState.lastPosition = position;
        const rows = nearbyRetailers(cache.retailers, position.lat, position.lng, {
            quickDrawOnly,
            distanceFn: haversineMeters
        });
        findState.listedRows = rows;
        findState.listedKind = "nearby";
        renderResults(rows);
        syncMapResults();
        if (!rows.length) {
            findState.listedRows = [];
            findState.listedKind = "none";
            setStatus("No retailers with published coordinates were found near that position.");
            return;
        }
        setStatus(`Showing the ${rows.length} closest licensed retailer${rows.length === 1 ? "" : "s"} to your position. The position was used only to sort this list and was not saved. Use Show on map to open one on the Map tab.`);
    } catch (error) {
        findState.listedRows = [];
        findState.listedKind = "none";
        renderResults([]);
        syncMapResults();
        setStatus(error && error.message ? error.message : "The device position was not available.");
    }
}

function bindFind() {
    const form = $("retailer-search-form");
    const near = $("retailer-near");
    const allow = $("location-allow");
    const deny = $("location-deny");
    const prompt = $("location-prompt");
    if (form) {
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            runSearch();
        });
    }
    if (near) {
        near.addEventListener("click", () => {
            if (prompt) prompt.hidden = false;
            prompt && prompt.scrollIntoView({ block: "nearest" });
        });
    }
    if (allow) {
        allow.addEventListener("click", () => {
            hideLocationPrompt();
            runNearMe();
        });
    }
    if (deny) {
        deny.addEventListener("click", () => {
            hideLocationPrompt();
            setStatus("Near me was not used. You can search by name, address, city, or ZIP instead.");
        });
    }
}

async function loadFind() {
    const source = $("retailer-source");
    findState.loadPromise = (async () => {
    try {
        const cache = await loadRetailerCache();
        if (!cache.retailers.length) {
            findState.loadError = "The retailer cache has no rows yet. No retailers are shown.";
            if (source) source.textContent = findState.loadError;
            setStatus(findState.loadError);
            return;
        }
        findState.cache = cache;
        if (source) source.innerHTML = describeSource(cache).html;
    } catch {
        findState.loadError = "The official retailer list could not be loaded. No retailers are shown.";
        if (source) source.textContent = findState.loadError;
        setStatus(findState.loadError);
    }
    })();
    return findState.loadPromise;
}


function setLogPath(path) {
    logState.path = path === "bought_at_venue" ? "bought_at_venue" : "standard";
    const standard = $("log-path-standard");
    const venue = $("log-path-venue");
    if (standard) standard.setAttribute("aria-pressed", logState.path === "standard" ? "true" : "false");
    if (venue) venue.setAttribute("aria-pressed", logState.path === "bought_at_venue" ? "true" : "false");
    const note = $("log-path-note");
    const photoLabel = $("log-photo-label");
    const retailerLabel = $("log-retailer-label");
    if (logState.path === "bought_at_venue") {
        if (note) note.textContent = "Venue path: pick a retailer the official list marks as offering Quick Draw, confirm you were there, and add a photo of the ticket. Use this if you bought the scratch-off at that venue.";
        if (photoLabel) photoLabel.textContent = "Ticket photo (required)";
        if (retailerLabel) retailerLabel.textContent = "Quick Draw venue";
        if (logState.selectedRetailer && !logState.selectedRetailer.quickDraw) {
            logState.selectedRetailer = null;
            renderSelectedRetailer();
        }
        const query = $("log-retailer-query");
        if (query && query.value.trim()) searchLogRetailers();
        else renderLogRetailerChoices([]);
    } else {
        if (note) note.textContent = "Standard path: pick any official retailer, confirm you were there, and optionally add a GPS check-in or a ticket photo.";
        if (photoLabel) photoLabel.textContent = "Ticket photo (optional)";
        if (retailerLabel) retailerLabel.textContent = "Retailer or venue";
        const query = $("log-retailer-query");
        if (query && query.value.trim()) searchLogRetailers();
    }
}

function renderSelectedRetailer() {
    const el = $("log-retailer-selected");
    if (!el) return;
    const row = logState.selectedRetailer;
    if (!row) {
        el.textContent = "No retailer selected yet.";
        return;
    }
    const address = formatRetailerAddress(row) || "Address not in the source data.";
    const qd = row.quickDraw ? " Quick Draw venue." : "";
    el.textContent = `Selected: ${row.name}, ${address}.${qd}`;
}

function renderLogRetailerChoices(rows) {
    const list = $("log-retailer-choices");
    if (!list) return;
    list.replaceChildren();
    rows.forEach((row) => {
        const item = document.createElement("li");
        item.className = "retailer-card";
        const name = document.createElement("h3");
        name.textContent = row.name || "Unnamed retailer";
        item.appendChild(name);
        const address = document.createElement("p");
        address.textContent = formatRetailerAddress(row) || "Address not in the source data.";
        item.appendChild(address);
        const pick = document.createElement("button");
        pick.type = "button";
        pick.className = "btn-secondary btn-compact";
        pick.textContent = "Use this location";
        pick.addEventListener("click", () => {
            logState.selectedRetailer = row;
            logState.checkin = null;
            const checkStatus = $("log-checkin-status");
            if (checkStatus) checkStatus.textContent = "No GPS check-in yet. A log without a matching check-in is marked unverified unless a photo is attached.";
            renderSelectedRetailer();
            renderLogRetailerChoices([]);
            const query = $("log-retailer-query");
            if (query) query.value = "";
        });
        item.appendChild(pick);
        list.appendChild(item);
    });
}

function searchLogRetailers() {
    const cache = findState.cache;
    const query = $("log-retailer-query") ? $("log-retailer-query").value : "";
    if (!cache) {
        renderLogRetailerChoices([]);
        return;
    }
    const result = searchRetailers(cache.retailers, query, {
        quickDrawOnly: logState.path === "bought_at_venue",
        limit: 8
    });
    if (result.emptyQuery) {
        renderLogRetailerChoices([]);
        return;
    }
    renderLogRetailerChoices(result.rows);
}

function startLogForRetailer(row) {
    if (!row) return;
    if (row.quickDraw) setLogPath("bought_at_venue");
    else setLogPath("standard");
    logState.selectedRetailer = row;
    logState.checkin = null;
    const checkStatus = $("log-checkin-status");
    if (checkStatus) checkStatus.textContent = "No GPS check-in yet. A log without a matching check-in is marked unverified unless a photo is attached.";
    renderSelectedRetailer();
    renderLogRetailerChoices([]);
    showTab("log");
    const game = $("log-game");
    if (game) game.focus();
}

function renderSession() {
    const off = $("log-session-form");
    const on = $("log-session-on");
    const label = $("log-session-label");
    logState.session = readSession();
    if (logState.session) {
        if (off) off.hidden = true;
        if (on) on.hidden = false;
        if (label) label.textContent = `Preview sign-in: ${logState.session.handle} (this device only).`;
    } else {
        if (off) off.hidden = false;
        if (on) on.hidden = true;
        if (label) label.textContent = "";
    }
}

function clearPhotoPreview() {
    if (logState.photoPreviewUrl) {
        URL.revokeObjectURL(logState.photoPreviewUrl);
        logState.photoPreviewUrl = null;
    }
    logState.photoFile = null;
    const preview = $("log-photo-preview");
    const status = $("log-photo-status");
    const input = $("log-photo");
    if (preview) {
        preview.hidden = true;
        preview.removeAttribute("src");
    }
    if (status) status.textContent = "No photo attached.";
    if (input) input.value = "";
}

function setPhotoFile(file) {
    const status = $("log-photo-status");
    if (!file) {
        clearPhotoPreview();
        return;
    }
    if (!isImageFile(file)) {
        clearPhotoPreview();
        if (status) status.textContent = "Choose a photo of the ticket (an image file).";
        return;
    }
    if (logState.photoPreviewUrl) URL.revokeObjectURL(logState.photoPreviewUrl);
    logState.photoFile = file;
    logState.photoPreviewUrl = URL.createObjectURL(file);
    const preview = $("log-photo-preview");
    if (preview) {
        preview.src = logState.photoPreviewUrl;
        preview.hidden = false;
    }
    if (status) status.textContent = `Photo ready on this device: ${file.name || "ticket photo"}.`;
}

function verificationBadges(flags) {
    const wrap = document.createElement("div");
    wrap.className = "retailer-meta";
    const set = new Set(flags || []);
    const add = (cls, text) => {
        const span = document.createElement("span");
        span.className = `verify-badge ${cls}`;
        span.textContent = text;
        wrap.appendChild(span);
    };
    if (set.has("location-confirmed")) add("verify-location", "Location-confirmed");
    if (set.has("photo-attached")) add("verify-photo", "Photo-attached");
    if (set.has("unverified") || !set.size) add("verify-unverified", "Unverified");
    return wrap;
}

async function renderLogList() {
    const list = $("prize-log-list");
    const status = $("log-list-status");
    if (!list) return;
    list.replaceChildren();
    logState.logs = loadLogs();
    if (!logState.logs.length) {
        if (status) status.textContent = "No prize logs on this device yet.";
        return;
    }
    if (status) status.textContent = `${logState.logs.length} prize log${logState.logs.length === 1 ? "" : "s"} on this device. These are not shared, and they have not been checked against a state record.`;
    for (const entry of logState.logs) {
        const item = document.createElement("li");
        item.className = "retailer-card";
        const title = document.createElement("h3");
        title.textContent = `${entry.game} · ${formatDollars(entry.prizeAmount)}`;
        item.appendChild(title);
        const detail = document.createElement("p");
        const place = [entry.retailerName, entry.retailerCity, entry.retailerZip].filter(Boolean).join(", ");
        const pathLabel = entry.path === "bought_at_venue" ? "Bought at a venue. " : "";
        detail.textContent = `${place}. ${entry.occurredOn}. ${pathLabel}${verificationLabel(entry.verification)}.`;
        item.appendChild(detail);
        item.appendChild(verificationBadges(entry.verification));
        if (entry.photoAttached && entry.photoId) {
            try {
                const photo = await getPhoto(entry.photoId);
                const url = photoObjectUrl(photo);
                if (url) {
                    const img = document.createElement("img");
                    img.className = "log-thumb";
                    img.alt = "Ticket photo stored on this device";
                    img.src = url;
                    item.appendChild(img);
                }
            } catch {
                /* preview can still show the log without the thumbnail */
            }
        }
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn-secondary btn-compact";
        remove.textContent = "Remove from this device";
        remove.addEventListener("click", () => removeLog(entry.id));
        item.appendChild(remove);
        list.appendChild(item);
    }
}

async function removeLog(id) {
    const entry = logState.logs.find((row) => row.id === id);
    const next = logState.logs.filter((row) => row.id !== id);
    saveLogs(next);
    if (entry && entry.photoId) {
        try { await deletePhoto(entry.photoId); } catch { /* local stub */ }
    }
    await renderLogList();
    refreshHeatMap();
}

function hideCheckinPrompt() {
    const prompt = $("checkin-prompt");
    if (prompt) prompt.hidden = true;
}

async function runCheckin() {
    const status = $("log-checkin-status");
    const retailer = logState.selectedRetailer;
    if (!retailer) {
        if (status) status.textContent = "Pick a retailer before using the GPS check-in.";
        return;
    }
    if (status) status.textContent = "Getting your position…";
    try {
        const position = await requestDevicePosition();
        const result = evaluateCheckIn({
            userLat: position.lat,
            userLng: position.lng,
            accuracyM: position.accuracyM,
            retailerLat: retailer.lat,
            retailerLng: retailer.lng
        });
        if (result.ok) {
            logState.checkin = {
                ok: true,
                lat: position.lat,
                lng: position.lng,
                accuracyM: result.accuracyM,
                distanceM: result.distanceM,
                at: new Date().toISOString()
            };
            if (status) {
                status.textContent = `Location-confirmed: your device was ${formatDistance(result.distanceM)} from this retailer's published coordinates.`;
            }
        } else {
            logState.checkin = null;
            const extra = Number.isFinite(result.distanceM)
                ? ` Distance recorded: ${formatDistance(result.distanceM)}.`
                : "";
            if (status) status.textContent = `${result.reason}${extra} This log will not be marked location-confirmed.`;
        }
    } catch (error) {
        logState.checkin = null;
        if (status) status.textContent = error && error.message ? error.message : "The device position was not available.";
    }
}

async function submitPrizeLog(event) {
    event.preventDefault();
    const status = $("log-form-status");
    const session = readSession();
    const retailer = logState.selectedRetailer;
    const parsed = parsePrizeLog({
        handle: session && session.handle,
        path: logState.path,
        game: $("log-game") ? $("log-game").value : "",
        prizeAmount: $("log-prize") ? $("log-prize").value : "",
        ticketPrice: $("log-price") ? $("log-price").value : "",
        occurredOn: $("log-date") ? $("log-date").value : "",
        today: todayInNewYork(),
        retailerId: retailer && retailer.id,
        retailerName: retailer && retailer.name,
        retailerStreet: retailer && retailer.street,
        retailerCity: retailer && retailer.city,
        retailerZip: retailer && retailer.zip,
        retailerLat: retailer && retailer.lat,
        retailerLng: retailer && retailer.lng,
        retailerQuickDraw: retailer && retailer.quickDraw,
        presentConfirmed: Boolean($("log-present") && $("log-present").checked),
        locationConfirmed: Boolean(logState.checkin && logState.checkin.ok),
        checkin: logState.checkin && logState.checkin.ok ? logState.checkin : null,
        photoAttached: Boolean(logState.photoFile)
    });
    if (!parsed.ok) {
        if (status) status.textContent = parsed.reason;
        return;
    }
    try {
        if (logState.photoFile) {
            await savePhoto({ id: parsed.log.id, file: logState.photoFile });
            parsed.log.photoId = parsed.log.id;
            parsed.log.photoAttached = true;
            parsed.log.verification = parsed.log.verification.includes("photo-attached")
                ? parsed.log.verification
                : parsed.log.verification.filter((flag) => flag !== "unverified").concat("photo-attached");
        }
        const next = [parsed.log, ...loadLogs()];
        saveLogs(next);
        if (status) status.textContent = `Saved on this device as ${verificationLabel(parsed.log.verification)}.`;
        $("prize-log-form").reset();
        $("log-date").value = todayInNewYork();
        logState.selectedRetailer = null;
        logState.checkin = null;
        clearPhotoPreview();
        setLogPath("standard");
        renderSelectedRetailer();
        const checkStatus = $("log-checkin-status");
        if (checkStatus) checkStatus.textContent = "No GPS check-in yet. A log without a matching check-in is marked unverified unless a photo is attached.";
        await renderLogList();
        refreshHeatMap();
    } catch (error) {
        if (status) status.textContent = error && error.message ? error.message : "The prize log could not be saved on this device.";
    }
}

function bindPrizeLog() {
    logState.logs = loadLogs();
    renderSession();
    setLogPath("standard");
    renderSelectedRetailer();
    const date = $("log-date");
    if (date) {
        date.value = todayInNewYork();
        date.max = todayInNewYork();
    }
    const signin = $("log-signin");
    if (signin) {
        signin.addEventListener("click", () => {
            const result = writeSession($("log-handle") ? $("log-handle").value : "");
            const sessionStatus = $("log-session-status");
            if (!result.ok) {
                if (sessionStatus) sessionStatus.textContent = result.reason;
                return;
            }
            if (sessionStatus) sessionStatus.textContent = "";
            renderSession();
        });
    }
    const signout = $("log-signout");
    if (signout) {
        signout.addEventListener("click", () => {
            clearSession();
            renderSession();
        });
    }
    const standard = $("log-path-standard");
    const venue = $("log-path-venue");
    if (standard) standard.addEventListener("click", () => setLogPath("standard"));
    if (venue) venue.addEventListener("click", () => setLogPath("bought_at_venue"));
    const retailerQuery = $("log-retailer-query");
    if (retailerQuery) {
        retailerQuery.addEventListener("input", searchLogRetailers);
        retailerQuery.addEventListener("search", searchLogRetailers);
    }
    const checkin = $("log-checkin");
    const prompt = $("checkin-prompt");
    if (checkin) {
        checkin.addEventListener("click", () => {
            if (prompt) {
                prompt.hidden = false;
                prompt.scrollIntoView({ block: "nearest" });
            }
        });
    }
    const allow = $("checkin-allow");
    const deny = $("checkin-deny");
    if (allow) {
        allow.addEventListener("click", () => {
            hideCheckinPrompt();
            runCheckin();
        });
    }
    if (deny) {
        deny.addEventListener("click", () => {
            hideCheckinPrompt();
            const checkStatus = $("log-checkin-status");
            if (checkStatus && !logState.checkin) {
                checkStatus.textContent = "GPS check-in was not used.";
            }
        });
    }
    const photo = $("log-photo");
    if (photo) {
        photo.addEventListener("change", () => {
            const file = photo.files && photo.files[0];
            setPhotoFile(file || null);
        });
    }
    const form = $("prize-log-form");
    if (form) form.addEventListener("submit", submitPrizeLog);
    renderLogList();
}


function describeHeatStatus(groups, locateNote) {
    const status = $("heat-status");
    if (!status) return;
    if (!groups.length) {
        status.textContent = "No payout data yet. Prize logs from this device will appear here after you add them. Nothing has been logged.";
        return;
    }
    const logs = groups.reduce((sum, group) => sum + group.count, 0);
    const base = `${formatCount(groups.length)} establishment${groups.length === 1 ? "" : "s"} from ${formatCount(logs)} prize log${logs === 1 ? "" : "s"} on this device. Circle size follows verification weight. Tiles are from OpenStreetMap. Tap a circle for the logged totals.`;
    status.textContent = locateNote ? `${base} ${locateNote}` : base;
}

function refreshHeatMap() {
    if (!heatState.api) return;
    const groups = aggregatePayouts(loadLogs());
    heatState.api.setPayouts(groups);
    heatState.api.fitPayouts();
    describeHeatStatus(groups);
    return groups;
}

async function ensureHeatMap() {
    if (heatState.api) {
        refreshHeatMap();
        heatState.api.invalidate();
        return heatState.api;
    }
    if (heatState.promise) return heatState.promise;
    const status = $("heat-status");
    heatState.promise = (async () => {
        try {
            await waitForLeaflet();
            const container = $("payout-heat-map");
            if (!container) throw new Error("The heat map container is missing.");
            const api = createPayoutHeatMap({
                container,
                formatAddress: formatRetailerAddress,
                formatDollars,
                groupStyle: heatGroupStyle
            });
            const groups = aggregatePayouts(loadLogs());
            api.setPayouts(groups);
            api.fitPayouts();
            heatState.api = api;
            requestAnimationFrame(() => api.invalidate());
            describeHeatStatus(groups);
            container.dataset.ready = "true";
            return api;
        } catch (error) {
            const message = error && error.message
                ? error.message
                : "The heat map could not be loaded. No payouts are shown.";
            if (status) status.textContent = message;
            heatState.promise = null;
            return null;
        }
    })();
    return heatState.promise;
}

async function runHeatLocate() {
    const api = await ensureHeatMap();
    if (!api) return;
    const status = $("heat-status");
    try {
        const position = await requestDevicePosition();
        api.setUserPosition(position);
        const groups = aggregatePayouts(loadLogs());
        const nearby = groups.filter((group) => {
            const distance = haversineMeters(position.lat, position.lng, group.lat, group.lng);
            return Number.isFinite(distance) && distance <= 25000;
        });
        const note = groups.length
            ? `${nearby.length} logged establishment${nearby.length === 1 ? "" : "s"} ${nearby.length === 1 ? "is" : "are"} within 25 km of that position. The position was used only to center the map and was not saved.`
            : "No prize logs are on this device, so no payout circles were added. The position was used only to center the map and was not saved.";
        describeHeatStatus(groups, note);
    } catch (error) {
        if (status) {
            const prefix = status.textContent || "No payout data yet.";
            const reason = error && error.message ? error.message : "The device position was not available.";
            status.textContent = `${prefix} ${reason}`;
        }
    }
}

function bindHeatMap() {
    const locate = $("heat-locate");
    const prompt = $("heat-location-prompt");
    const allow = $("heat-locate-allow");
    const deny = $("heat-locate-deny");
    if (locate) {
        locate.addEventListener("click", () => {
            if (prompt) {
                prompt.hidden = false;
                prompt.scrollIntoView({ block: "nearest" });
            }
        });
    }
    if (allow) {
        allow.addEventListener("click", () => {
            if (prompt) prompt.hidden = true;
            runHeatLocate();
        });
    }
    if (deny) {
        deny.addEventListener("click", () => {
            if (prompt) prompt.hidden = true;
        });
    }
}

function bindShell() {
    document.querySelectorAll('[role="tab"]').forEach((tab) => {
        tab.addEventListener("click", () => showTab(tab.dataset.tab));
    });
    showTab("find");
    bindFind();
    bindMap();
    bindPrizeLog();
    bindHeatMap();
    loadFind();
}

function grant() {
    document.documentElement.classList.add("age-cleared");
    $("age-gate").hidden = true;
    const shell = $("app-shell");
    shell.innerHTML = SHELL_MARKUP;
    shell.inert = false;
    bindShell();
}

function renderAgeForm() {
    const card = $("age-gate").querySelector(".age-card");
    card.innerHTML = `
        <p class="age-kicker">Age check</p>
        <h2 id="age-gate-title">Scratch Buddy is for adults 18 and over</h2>
        <p>Enter your date of birth to continue. We use your date of birth only to check your age and do not keep the date after that check.</p>
        <div class="age-dob">
            <label>Month <select id="age-month" autocomplete="off"><option value="">Month</option></select></label>
            <label>Day <select id="age-day" autocomplete="off"><option value="">Day</option></select></label>
            <label>Year <select id="age-year" autocomplete="off"><option value="">Year</option></select></label>
        </div>
        <button type="button" id="age-dob-continue" disabled>Continue</button>
        <p id="age-date-error" role="status"></p>
    `;
    const month = card.querySelector("#age-month");
    const day = card.querySelector("#age-day");
    const year = card.querySelector("#age-year");
    ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].forEach((name, index) => {
        const option = document.createElement("option");
        option.value = String(index + 1);
        option.textContent = name;
        month.appendChild(option);
    });
    for (let value = 1; value <= 31; value += 1) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        day.appendChild(option);
    }
    const thisYear = new Date().getFullYear();
    for (let value = thisYear; value >= thisYear - 120; value -= 1) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        year.appendChild(option);
    }
    const button = card.querySelector("#age-dob-continue");
    const refresh = () => {
        button.disabled = classifyDob({ year: year.value, month: month.value, day: day.value }).outcome === "invalid";
    };
    [month, day, year].forEach((select) => select.addEventListener("change", refresh));
    button.addEventListener("click", () => {
        const decision = classifyDob({ year: year.value, month: month.value, day: day.value });
        month.value = "";
        day.value = "";
        year.value = "";
        button.disabled = true;
        if (!decision.persist) {
            if (decision.outcome !== "invalid") showAgeFail(decision.outcome);
            return;
        }
        writeAgePass(localStorage);
        grant();
    });
}

if (sessionAgeBlocked()) showAgeFail("under18");
else if (readAgePass(localStorage)) grant();
else renderAgeForm();
