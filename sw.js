// App-shell cache only. Draw rows live on supabase.co and are never intercepted,
// so a cached response cannot stand in for newer draw data.
const CACHE = "draw-buddy-shell-v6";
const SHELL = [
    "./index.html",
    "./terms.html",
    "./privacy.html",
    "./css/tailwind.css",
    "./css/app.css",
    "./js/config.js",
    "./js/age.js",
    "./js/consent.js",
    "./js/pixels.js",
    "./js/utm.js",
    "./js/compliance.js",
    "./js/notices.js",
    "./js/legal-page.js",
    "./js/entitlement.js",
    "./js/odds.js",
    "./js/grading.js",
    "./js/app.js",
    "./vendor/supabase.js",
    "./manifest.webmanifest",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;
    let url;
    try {
        url = new URL(request.url);
    } catch {
        return;
    }
    if (url.hostname.endsWith("supabase.co") || url.hostname.endsWith("supabase.in")) return;
    if (url.origin !== self.location.origin) return;

    event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE);
    try {
        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone());
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
            const home = await caches.match("./index.html");
            if (home) return home;
        }
        return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
}
