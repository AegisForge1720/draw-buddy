import { AGE_BLOCK_KEY, classifyDob, readAgePass, writeAgePass } from "./age.js";
import { formatDistance, haversineMeters, requestDevicePosition } from "./geo.js";
import { createRetailerMap, waitForLeaflet } from "./map.js";
import { SHELL_MARKUP } from "./markup.js";
import {
    formatCacheTimestamp,
    formatRetailerAddress,
    loadRetailerCache,
    nearbyRetailers,
    searchRetailers
} from "./retailers.js";

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

        if (Number.isFinite(row.lat) && Number.isFinite(row.lng)) {
            const show = document.createElement("button");
            show.type = "button";
            show.className = "btn-secondary btn-compact";
            show.textContent = "Show on map";
            show.addEventListener("click", () => showRetailerOnMap(row.id, { preferResults: true }));
            item.appendChild(show);
        }
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
                formatAddress: formatRetailerAddress
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

function bindShell() {
    document.querySelectorAll('[role="tab"]').forEach((tab) => {
        tab.addEventListener("click", () => showTab(tab.dataset.tab));
    });
    showTab("find");
    bindFind();
    bindMap();
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
