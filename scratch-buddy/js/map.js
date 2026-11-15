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

function buildPopup(row, formatAddress) {
    const wrap = document.createElement("div");
    wrap.className = "sb-popup";
    const title = document.createElement("h3");
    title.textContent = row.name || "Unnamed retailer";
    wrap.appendChild(title);
    const address = document.createElement("p");
    address.textContent = formatAddress(row) || "Address not in the source data.";
    wrap.appendChild(address);
    if (row.quickDraw) {
        const badge = document.createElement("p");
        badge.className = "qd-badge";
        badge.textContent = "Quick Draw venue";
        wrap.appendChild(badge);
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

export function createRetailerMap({ container, formatAddress }) {
    const L = window.L;
    const map = L.map(container, {
        minZoom: 5,
        maxZoom: 18,
        zoomControl: true,
        attributionControl: true
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer" target="_blank">OpenStreetMap</a>',
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
            marker.bindPopup(() => buildPopup(row, formatAddress), { maxWidth: 260, className: "sb-popup-shell" });
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
