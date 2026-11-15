NOT FOR DEPLOYMENT. Pending legal review.

# Scratch Buddy

Scratch Buddy is a separate static app and a sibling to Draw Buddy. It is a fun, social companion for scratch-off tickets, not a tool for placing wagers. It is not part of Draw Buddy's published pages, and this branch is not for deployment.

## Retailer list

Search uses a local cache of the official **NYS Lottery Retailers** dataset from NY Open Data (dataset [`2vvn-pdyi`](https://data.ny.gov/Government-Finance/NYS-Lottery-Retailers/2vvn-pdyi)), published by the New York State Gaming Commission.

- Source API: https://data.ny.gov/resource/2vvn-pdyi.json
- Local cache: `data/retailers.json`
- Retrieved at: November 15, 2026 at 6:07 PM ET (`2026-11-15T18:07:43-05:00`)
- Official rows last updated: November 15, 2026, 2:02 AM ET
- Count in this cache: 13,129 licensed retailer locations (6,182 marked Quick Draw)
- Every cached row has published latitude and longitude

The official dataset lists licensed retailer locations that sell New York Lottery products. It does not identify individual ticket machines, and it does not flag which locations sell scratch-off tickets separately from other lottery products. `quickDraw` is true when the official Quick Draw field is `Y`.

The app searches that cache by name, address, city, or ZIP. Near me is opt-in: the in-app prompt runs first, then the browser location prompt. The device position is used only to sort nearby retailers in that browser session and is not saved.

No payout or prize-log data is shown yet. Empty lists stay empty. Nothing in the cache was invented or generated.


## Retailer map

The Map tab shows the same official cache on an interactive map:

- Leaflet 1.9.4 with OpenStreetMap tiles
- Leaflet.markercluster for the 13,129 locations
- No analytics or tracking pixels
- Search and Near me results can be shown on the map (gold markers). Each search row has a Show on map button that opens that location's details.
- Tap a cluster to zoom in, or tap a marker for the name, address, and Quick Draw flag when the official list has one

Prize logging and the payout heat map are not connected yet. The map does not invent locations or payouts.

## Age check

An 18+ age check runs before the app, the privacy draft, and the terms draft. It stores only `flag: "18plus"` and an expiry in `scratch_buddy_age_gate`. The date of birth is not kept.

`privacy.html` and `terms.html` are drafts and are marked pending legal review.

If the repository root is published, `/scratch-buddy/` is a public URL. The age check is not a server wall. A `noindex,nofollow` meta tag is on each page. That is not a substitute for a host-level age wall.

## Run

This preview is served privately on port 8876 with basic auth (user `andrew`, password in `~/.secrets/scratch_preview_pass`). Do not print that password.

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
