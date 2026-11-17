NOT FOR DEPLOYMENT. Pending legal review.

# Scratch Buddy

Scratch Buddy is a separate static app and a sibling to Draw Buddy. It is a fun, social companion for scratch-off tickets, not a tool for placing wagers. It is not part of Draw Buddy's published pages, and this branch is not for deployment.

## Retailer list

Search uses a local cache of the official **NYS Lottery Retailers** dataset from NY Open Data (dataset [`2vvn-pdyi`](https://data.ny.gov/Government-Finance/NYS-Lottery-Retailers/2vvn-pdyi)), published by the New York State Gaming Commission.

- Source API: https://data.ny.gov/resource/2vvn-pdyi.json
- Local cache: `data/retailers.json`
- Retrieved at: November 17, 2026 at 8:05 AM ET (`2026-11-17T08:05:05-05:00`). Refresh with `node scratch-buddy/scripts/refresh-retailers.mjs` at least weekly and right before any public build.
- Official rows last updated: November 17, 2026, 2:01 AM ET
- Count in this cache: 13,121 licensed retailer locations (6,180 marked Quick Draw)
- Every cached row has published latitude and longitude

The official dataset lists licensed retailer locations that sell New York Lottery products. It does not identify individual ticket machines, and it does not flag which locations sell scratch-off tickets separately from other lottery products. `quickDraw` is true when the official Quick Draw field is `Y`.

The app searches that cache by name, address, city, or ZIP under the heading "Find a licensed retailer". Near me is opt-in: the in-app prompt runs first, then the browser location prompt. The device position is used only to sort nearby retailers in that browser session and is not saved.


## Retailer map

The Map tab shows the same official cache on an interactive map:

- Self-hosted Leaflet 1.9.4 with OpenStreetMap tiles
- Self-hosted Leaflet.markercluster for the 13,121 locations
- Built Tailwind CSS, self-hosted (no CDN)
- No analytics or tracking pixels
- Search and Near me results can be shown on the map (gold markers). Each search row has a Show on map button that opens that location's details.
- Tap a cluster to zoom in, or tap a marker for the name, address, and Quick Draw flag when the official list has one

The retailer map does not invent locations or prize logs.


## Prize log

The Prize Log tab is a local stub only:

- An optional display name is stored on this device. There are no accounts.
- Every log requires the person to confirm they were at the selected official retailer.
- Optional GPS check-in is opt-in (in-app prompt, then the browser prompt). A match within 150 meters, with accurate enough position data, is stored only as a pass, the date, and a coarse distance band (`<50 m` or `50-150 m`). Coordinates are not kept.
- The "Bought at a venue" path (Quick Draw venues) and the "Quick Draw venues only" filter are behind the `quickDrawVenue` flag. They are OFF in the public build (Ralph N1) and on only in a private preview that injects the private-preview meta.
- A photo can be stored only after a cover or crop step and a confirmation that the barcode, validation number, and PIN are covered. The stored copy is re-encoded to strip EXIF and stays in IndexedDB on this device. No photo bucket has been created.
- Each log is marked Self-reported, GPS check-in near store, and/or Photo on this device. Prize logs are not checked against New York Lottery records.
- "Delete all my data" clears the age pass, preview sign-in, prize logs, and ticket photos on this device.
- Draft SQL and RLS live in `supabase/migrations/0001_prize_logs.sql`. The statements are commented out. Do not apply them. A new Supabase project, table, or photo bucket needs Andrew's explicit OK. The recommendation is a separate Scratch Buddy project, not Draw Buddy's project.
- Questions for Ralph are in `COMPLIANCE.md`.

## My Log Map

The My Log Map tab plots prize logs from this device only:

- No official prize feed and no shipped sample points
- The map stays empty until a prize is logged on that device
- Every store marker is the same size and color. The map does not rank stores or show per-store totals
- Tap a marker to see only your prize logs at that store
- Optional "center on my location" is opt-in and does not add prize logs or save the position

## Age check

An 18+ age check runs before the app, the privacy draft, and the terms draft. It stores only `flag: "18plus"` and an expiry in `scratch_buddy_age_gate`. The date of birth is not kept. A failed check shows one message: "Sorry — Scratch Buddy is for adults 18 and over."

`privacy.html` and `terms.html` are drafts and are marked pending legal review.

If the repository root is published, `/scratch-buddy/` is a public URL. The age check is not a server wall. A `noindex,nofollow` meta tag is on each page. That is not a substitute for a host-level age wall.

## Public build and flags

- `js/flags.js` is an ES module imported by every entry script. `PUBLIC_DEFAULTS` are all off. Only a page carrying `<meta name="sb-build" content="private-preview">`, injected by a private preview server at serve time, gets the preview flags. If `flags.js` fails to load, the app does not start, so nothing falls back to on.
- `node scratch-buddy/scripts/build-public.mjs` writes the public bundle to `scratch-buddy/dist/` (gitignored) with only runtime files (no README, COMPLIANCE, tests, Supabase drafts or brand masters). It fails if a page carries the build meta or loses `noindex`.
- `node scratch-buddy/scripts/refresh-retailers.mjs` refreshes `data/retailers.json` from data.ny.gov. Run it right before any public build.
- `manifest.webmanifest` plus the icons in `brand/` let the app be added to a phone home screen (iPhone: Safari, Share, Add to Home Screen; Android: Chrome menu, Install app). There is no service worker, so nothing is cached outside the browser storage that "Delete all my data" clears.
- Browser checks (need the preview running): `PREVIEW_PASS=... node scratch-buddy/tests-ui/public-flags.mjs http://127.0.0.1:8876/`, `layout.mjs` (360, 390, 1024 px) and `screenshots.mjs`.
- See `/workspace/scratch-buddy/LAUNCH-READINESS.md` for what is left before anything can go public.

## Run

The launch-ready preview serves the public build (`dist/`) privately on port 8876 with basic auth (user `andrew`, password in `~/.secrets/scratch_preview_pass`) via `/workspace/scratch-ready-server/start.sh`. Do not print that password.

From this folder, for a local unauthenticated check:

```bash
python3 -m http.server 4180
```

## Test

From the repository root:

```bash
npm test
```

Scratch Buddy cases live in `scratch-buddy/test/`.
