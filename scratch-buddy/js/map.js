import { FLAGS, TILE_PROVIDER } from "./flags.js";

export const NY_BOUNDS = [
    [40.4774, -79.7626],
    [45.0159, -71.7517]
];

export function waitForLeaflet(timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
        if (window.L && typeof window.L.markerClusterGroup === "function") {
            resolve(window.L);
            return;
        }
        const started = Date.now();
        const timer = setInterval(() => {
            if (window.L && typeof window.L.markerClusterGroup === "function") {
                clearInterval(timer);
                resolve(window.L);
            } else if (Date.now() - started > timeoutMs) {
                clearInterval(timer);
                reject(new Error("The map library could not be loaded. No locations are shown."));
            }
        }, 30);
    });
}

function pinIcon(L, highlighted) {
    return L.divIcon({
        className: highlighted ? "sb-pin sb-pin-match" : "sb-pin",
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -8]
    });
}

function clusterIcon(L, cluster, highlighted) {
    const count = cluster.getChildCount();
    let size = "sm";
    if (count >= 100) size = "md";
    if (count >= 500) size = "lg";
    return L.divIcon({
        html: `<span>${count}</span>`,
        className: `sb-cluster sb-cluster-${size}${highlighted ? " sb-cluster-match" : ""}`,
        iconSize: size === "lg" ? [48, 48] : size === "md" ? [40, 40] : [32, 32]
    });
}

function buildPopup(row, formatAddress, onLogPrize) {
    const wrap = document.createElement("div");
    wrap.className = "sb-popup";
    const title = document.createElement("h3");
    title.textContent = row.name || "Unnamed retailer";
    wrap.appendChild(title);
    const address = document.createElement("p");
    address.textContent = formatAddress(row) || "Address not in the source data.";
    wrap.appendChild(address);
    if (FLAGS.quickDrawVenue && row.quickDraw) {
        const badge = document.createElement("p");
        badge.className = "qd-badge";
        badge.textContent = "Quick Draw venue";
        wrap.appendChild(badge);
    }
    if (typeof onLogPrize === "function") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn-secondary btn-compact";
        button.textContent = "Log a prize here";
        button.addEventListener("click", () => onLogPrize(row));
        wrap.appendChild(button);
    }
    return wrap;
}

function makeCluster(L, highlighted) {
    return L.markerClusterGroup({
        chunkedLoading: true,
        chunkInterval: 25,
        chunkDelay: 10,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 17,
        maxClusterRadius: 55,
        iconCreateFunction: (cluster) => clusterIcon(L, cluster, highlighted)
    });
}

function withCoords(rows) {
    return (rows || []).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));
}

export function createRetailerMap({ container, formatAddress, onLogPrize }) {
    const L = window.L;
    const map = L.map(container, {
        minZoom: 5,
        maxZoom: 18,
        zoomControl: true,
        attributionControl: true
    });
    L.tileLayer(TILE_PROVIDER.url, {
        attribution: TILE_PROVIDER.attribution,
        maxZoom: 18
    }).addTo(map);

    const allCluster = makeCluster(L, false);
    const resultCluster = makeCluster(L, true);
    allCluster.addTo(map);

    const allById = new Map();
    const resultById = new Map();
    let mode = "all";
    let userMarker = null;

    function addMarkers(rows, cluster, store, highlighted) {
        cluster.clearLayers();
        store.clear();
        const layers = [];
        for (const row of rows) {
            const marker = L.marker([row.lat, row.lng], {
                icon: pinIcon(L, highlighted),
                title: row.name || "Retailer",
                keyboard: true
            });
            marker.bindPopup(() => buildPopup(row, formatAddress, onLogPrize), { maxWidth: 260, className: "sb-popup-shell" });
            marker.retailerId = row.id;
            store.set(row.id, { marker, row });
            layers.push(marker);
        }
        cluster.addLayers(layers);
        return layers.length;
    }

    function setAllRetailers(rows) {
        return addMarkers(withCoords(rows), allCluster, allById, false);
    }

    function setResultRetailers(rows) {
        return addMarkers(withCoords(rows), resultCluster, resultById, true);
    }

    function applyMode(next) {
        mode = next === "results" && resultById.size ? "results" : "all";
        if (mode === "results") {
            if (map.hasLayer(allCluster)) map.removeLayer(allCluster);
            if (!map.hasLayer(resultCluster)) map.addLayer(resultCluster);
        } else {
            if (map.hasLayer(resultCluster)) map.removeLayer(resultCluster);
            if (!map.hasLayer(allCluster)) map.addLayer(allCluster);
        }
        return mode;
    }

    function fitRows(rows, { maxZoom = 15 } = {}) {
        const pts = withCoords(rows);
        if (!pts.length) return;
        if (pts.length === 1) {
            map.setView([pts[0].lat, pts[0].lng], Math.min(16, maxZoom));
            return;
        }
        const bounds = L.latLngBounds(pts.map((row) => [row.lat, row.lng]));
        map.fitBounds(bounds, { padding: [28, 28], maxZoom });
    }

    function fitNewYork() {
        map.fitBounds(NY_BOUNDS, { padding: [12, 12] });
    }

    function focusRetailer(id) {
        const store = mode === "results" ? resultById : allById;
        const entry = store.get(id) || resultById.get(id) || allById.get(id);
        if (!entry) return false;
        const cluster = resultById.has(id) && mode === "results" ? resultCluster : allCluster;
        if (mode === "results" && resultById.has(id)) {
            resultCluster.zoomToShowLayer(entry.marker, () => entry.marker.openPopup());
            return true;
        }
        if (mode !== "all") applyMode("all");
        cluster.zoomToShowLayer(entry.marker, () => entry.marker.openPopup());
        return true;
    }

    function setUserPosition(position) {
        if (userMarker) {
            map.removeLayer(userMarker);
            userMarker = null;
        }
        if (!position || !Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
        userMarker = L.circleMarker([position.lat, position.lng], {
            radius: 7,
            color: "#f8fafc",
            weight: 2,
            fillColor: "#22d3ee",
            fillOpacity: 1
        }).addTo(map);
        userMarker.bindPopup("Your position (this session only, not saved)");
    }

    function invalidate() {
        map.invalidateSize();
    }

    return {
        map,
        setAllRetailers,
        setResultRetailers,
        applyMode,
        getMode: () => mode,
        resultCount: () => resultById.size,
        allCount: () => allById.size,
        fitRows,
        fitNewYork,
        focusRetailer,
        setUserPosition,
        invalidate
    };
}


export function createLogMap({ container, formatAddress, formatEntry }) {
    const L = window.L;
    const map = L.map(container, {
        minZoom: 5,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: true
    });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer(TILE_PROVIDER.url, {
        attribution: TILE_PROVIDER.attribution,
        maxZoom: 18
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    let userMarker = null;
    let groups = [];
    const markerStyle = {
        radius: 10,
        color: "#0b132b",
        weight: 1,
        fillColor: "#22d3ee",
        fillOpacity: 0.85
    };

    function popupFor(group) {
        const wrap = document.createElement("div");
        wrap.className = "sb-popup";
        const title = document.createElement("h3");
        title.textContent = group.retailerName || "Unnamed retailer";
        wrap.appendChild(title);
        const address = document.createElement("p");
        address.textContent = formatAddress({
            street: group.street,
            city: group.city,
            state: "NY",
            zip: group.zip
        }) || "Address not in the source data.";
        wrap.appendChild(address);
        const intro = document.createElement("p");
        intro.textContent = "Your prize logs at this store, on this device only:";
        wrap.appendChild(intro);
        const list = document.createElement("ul");
        const entries = Array.isArray(group.entries) ? group.entries : [];
        if (!entries.length) {
            const empty = document.createElement("p");
            empty.textContent = "No prize logs for this store are on this device.";
            wrap.appendChild(empty);
            return wrap;
        }
        for (const entry of entries) {
            const item = document.createElement("li");
            item.textContent = formatEntry ? formatEntry(entry) : (entry.game || "Prize log");
            list.appendChild(item);
        }
        wrap.appendChild(list);
        return wrap;
    }

    function setLogs(nextGroups) {
        layer.clearLayers();
        groups = Array.isArray(nextGroups) ? nextGroups : [];
        for (const group of groups) {
            if (!Number.isFinite(group.lat) || !Number.isFinite(group.lng)) continue;
            const marker = L.circleMarker([group.lat, group.lng], markerStyle);
            marker.bindPopup(() => popupFor(group), { maxWidth: 260, className: "sb-popup-shell" });
            layer.addLayer(marker);
        }
        return groups.length;
    }

    function fitLogs() {
        const pts = groups.filter((group) => Number.isFinite(group.lat) && Number.isFinite(group.lng));
        if (!pts.length) {
            map.fitBounds(NY_BOUNDS, { padding: [12, 12] });
            return;
        }
        if (pts.length === 1) {
            map.setView([pts[0].lat, pts[0].lng], 13);
            return;
        }
        map.fitBounds(pts.map((group) => [group.lat, group.lng]), { padding: [28, 28], maxZoom: 14 });
    }

    function fitNewYork() {
        map.fitBounds(NY_BOUNDS, { padding: [12, 12] });
    }

    function setUserPosition(position) {
        if (userMarker) {
            map.removeLayer(userMarker);
            userMarker = null;
        }
        if (!position || !Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
        userMarker = L.circleMarker([position.lat, position.lng], {
            radius: 7,
            color: "#f8fafc",
            weight: 2,
            fillColor: "#22d3ee",
            fillOpacity: 1
        }).addTo(map);
        userMarker.bindPopup("Your position (this session only, not saved)");
        map.setView([position.lat, position.lng], 13);
    }

    function invalidate() {
        map.invalidateSize();
    }

    return {
        map,
        setLogs,
        fitLogs,
        fitNewYork,
        setUserPosition,
        invalidate,
        count: () => groups.length
    };
}
