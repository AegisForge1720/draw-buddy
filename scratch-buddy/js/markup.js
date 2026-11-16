export const AFFILIATION = "Scratch Buddy is an independent app from NAV Analytics LLC. It is not affiliated with, endorsed by, or sponsored by the New York Lottery or the New York State Gaming Commission.";

// Exact house wording from Ralph's Scratch Buddy review (§4.6), also used as
// the short D3 fragment, short D1+age line, and short D4 in
// /workspace/legal/paid_ads_platform_classification_memo.md and
// /workspace/legal/teaser_week1_review.md. Do not paraphrase these three lines.
export const PAST_RESULTS_LINE = "Past results don't predict future draws.";
export const HOPENY_LINE = "18+. Gambling problem? Call 1-877-8-HOPENY or text HOPENY (467369).";
export const NOT_AFFILIATED_LINE = "Not affiliated with any lottery.";
export const LOG_DISCLOSURE = "Prize logs are self-reported by users and are not checked against New York Lottery records. They do not show which stores sell more prizes.";
export const AGE_FAIL_COPY = "Sorry — Scratch Buddy is for adults 18 and over.";

export const REQUIRED_LINES_MARKUP = `
            <p>${PAST_RESULTS_LINE}</p>
            <p>${HOPENY_LINE}</p>
            <p>${NOT_AFFILIATED_LINE}</p>
`;

export const COIN_MARKUP = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="42" height="42" role="img" aria-hidden="true">
  <defs>
    <radialGradient id="sbCoinGold" cx="50%" cy="38%" r="60%">
      <stop offset="0%" stop-color="#FFEE55"/>
      <stop offset="70%" stop-color="#FFD700"/>
      <stop offset="100%" stop-color="#CC9900"/>
    </radialGradient>
  </defs>
  <circle cx="64" cy="64" r="60" fill="url(#sbCoinGold)" stroke="#FFF8DC" stroke-width="4"/>
  <circle cx="64" cy="64" r="48" fill="none" stroke="#A16207" stroke-width="2" stroke-dasharray="4 3"/>
  <rect x="40" y="44" width="48" height="40" rx="4" fill="#111827" stroke="#FDE047" stroke-width="2"/>
  <path d="M48 56h32M48 64h24M48 72h16" stroke="#FACC15" stroke-width="3" stroke-linecap="round"/>
</svg>
`;

export const SHELL_MARKUP = `
    <header class="app-header">
        <div class="max-w-md mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
                <h1 class="sr-only">Scratch Buddy</h1>
                ${COIN_MARKUP}
                <div class="min-w-0">
                    <p class="text-white font-black text-sm tracking-wide leading-none">Scratch Buddy</p>
                    <p class="text-[9px] text-cyan-300/80 font-semibold tracking-wide mt-1">A social companion</p>
                </div>
            </div>
            <a class="btn-secondary btn-compact" href="#preview-features" id="preview-features-jump">Preview features</a>
        </div>
    </header>

    <main class="max-w-md mx-auto px-3 pt-3 pb-8 space-y-3">
        <p class="preview-banner">Private preview only. Official amount layers, the color-coded heat map, and the prizes-remaining table are off until you switch them on below. They are preview-only, Ralph no-go, and are not cleared for public use. My Log Map markers come only from prize logs on this device and stay empty until you log a prize. No sample points are included. A shared database is not connected.</p>

        <section id="preview-features" class="filter-box preview-features-panel">
            <h2 id="preview-features-heading" class="section-title">Preview features</h2>
            <p class="source-note">Each switch below is preview-only, Ralph no-go. All of them start off. Turn one on to see it in this private preview only. The choice stays on this device and is easy to turn back off.</p>
            <div id="preview-features-list" class="preview-features-list"></div>
        </section>

        <div class="flex w-full" role="tablist" aria-label="Scratch Buddy sections">
            <button type="button" class="tab-btn" id="tab-find" role="tab" aria-controls="panel-find" aria-selected="true" data-tab="find">Find</button>
            <button type="button" class="tab-btn" id="tab-map" role="tab" aria-controls="panel-map" aria-selected="false" data-tab="map">Map</button>
            <button type="button" class="tab-btn" id="tab-log" role="tab" aria-controls="panel-log" aria-selected="false" data-tab="log">Prize Log</button>
            <button type="button" class="tab-btn" id="tab-logs-map" role="tab" aria-controls="panel-logs-map" aria-selected="false" data-tab="logs-map">My Log Map</button>
            <button type="button" class="tab-btn" id="tab-prizes" role="tab" aria-controls="panel-prizes" aria-selected="false" data-tab="prizes" data-preview-flag="prizesRemainingTable" hidden>Prizes remaining</button>
        </div>

        <section id="panel-find" class="panel space-y-3" role="tabpanel" aria-labelledby="find-heading">
            <h2 id="find-heading" class="section-title">Find a licensed retailer</h2>
            <p id="retailer-source" class="source-note">Loading the official retailer list…</p>
            <form id="retailer-search-form" class="space-y-3">
                <label class="block">
                    <span class="sr-only">Search for a licensed retailer</span>
                    <input id="retailer-query" class="input-shell" type="search" name="q" placeholder="Search by name, address, city, or ZIP" autocomplete="off" enterkeyhint="search">
                </label>
                <label class="check-row">
                    <input id="retailer-qd-only" type="checkbox">
                    <span>Quick Draw venues only</span>
                </label>
                <div id="sales-filter-controls" class="filter-box" data-preview-flag="storeSalesSortFilter" hidden>
                    <p class="field-label">Sort and filter by official amounts</p>
                    <label class="block">
                        <span class="field-label">Official field</span>
                        <select id="sales-sort-metric" class="input-shell">
                            <option value="">Search order</option>
                            <option value="ig_paid">Daily IG PAID Sales</option>
                            <option value="draw_paid">Daily DRAW PAID Sales</option>
                            <option value="ig_settles">Daily IG SETTLES Sales</option>
                        </select>
                    </label>
                    <label class="block">
                        <span class="field-label">Date range</span>
                        <select id="sales-sort-range" class="input-shell">
                            <option value="latest">Latest sales date</option>
                            <option value="days7">7-day total</option>
                            <option value="days30" selected>30-day total</option>
                        </select>
                    </label>
                    <label class="block">
                        <span class="field-label">Order</span>
                        <select id="sales-sort-dir" class="input-shell">
                            <option value="desc" selected>Highest first</option>
                            <option value="asc">Lowest first</option>
                        </select>
                    </label>
                    <label class="check-row">
                        <input id="sales-filter-scratchoffs" type="checkbox">
                        <span>Sells scratch-offs (Daily IG SETTLES Sales over 30 days is greater than 0)</span>
                    </label>
                    <label class="check-row">
                        <input id="sales-filter-hide-none" type="checkbox">
                        <span>Hide stores with no sales in 30 days</span>
                    </label>
                </div>
                <div class="flex gap-2">
                    <button type="submit" class="btn-primary flex-1" id="retailer-search">Search</button>
                    <button type="button" class="btn-secondary flex-1" id="retailer-near">Near me</button>
                </div>
            </form>
            <div id="location-prompt" class="location-prompt" hidden>
                <p class="location-prompt-title">Use your location?</p>
                <p>Scratch Buddy can use your device location to list nearby licensed retailers. That position is used only to sort this list in this session and is not saved. Map tiles still go to the tile provider and can show the area you view. Location is optional and off until you agree.</p>
                <div class="flex gap-2">
                    <button type="button" class="btn-primary flex-1" id="location-allow">Use my location</button>
                    <button type="button" class="btn-secondary flex-1" id="location-deny">Not now</button>
                </div>
            </div>
            <p id="retailer-status" class="empty-note" role="status">Enter a name, address, city, or ZIP, or use Near me. The full official list is not shown all at once.</p>
            <ul id="retailer-results" class="retailer-list"></ul>
        </section>

        <section id="panel-map" class="panel space-y-3" role="tabpanel" aria-labelledby="map-heading" hidden>
            <h2 id="map-heading" class="section-title">Retailer Map</h2>
            <div class="flex gap-2" role="group" aria-label="Map list">
                <button type="button" class="btn-secondary flex-1" id="map-mode-all" aria-pressed="true">All locations</button>
                <button type="button" class="btn-secondary flex-1" id="map-mode-results" aria-pressed="false" disabled>Search results</button>
            </div>
            <div id="official-heat-controls" class="filter-box" data-preview-flag="officialSalesHeatMap" hidden>
                <p class="field-label">Official amounts layer (preview only)</p>
                <label class="check-row">
                    <input id="map-official-heat" type="checkbox" checked>
                    <span>Show color-coded official amounts</span>
                </label>
                <label class="check-row">
                    <input id="map-retailer-pins" type="checkbox" checked>
                    <span>Show licensed retailer pins</span>
                </label>
                <label class="check-row">
                    <input id="map-heat-hide-none" type="checkbox">
                    <span>Hide stores with no sales in 30 days</span>
                </label>
                <label class="block">
                    <span class="field-label">Official field</span>
                    <select id="map-heat-metric" class="input-shell">
                        <option value="ig_paid" selected>Daily IG PAID Sales</option>
                        <option value="draw_paid">Daily DRAW PAID Sales</option>
                        <option value="ig_settles">Daily IG SETTLES Sales</option>
                    </select>
                </label>
                <label class="block">
                    <span class="field-label">Date range</span>
                    <select id="map-heat-range" class="input-shell">
                        <option value="latest">Latest sales date</option>
                        <option value="days7">7-day total</option>
                        <option value="days30" selected>30-day total</option>
                    </select>
                </label>
                <div id="official-heat-legend" class="heat-legend" hidden></div>
            </div>
            <div id="retailer-map" class="retailer-map" role="application" aria-label="Map of licensed retailers"></div>
            <p id="map-status" class="source-note" role="status">Loading the map…</p>
            <p id="official-sales-caveat" class="source-note" data-preview-flag="officialStoreSales" hidden>Source: Lottery Daily Retailer Sales (By Game): Beginning 2024 (NY Open Data dataset xyvi-fbb9). This is unaudited NY Open Data. Under-$600 cash-outs only show where tickets were cashed. Missing official rows are shown as no data.</p>
            <p class="source-note">${LOG_DISCLOSURE}</p>
            <div class="required-lines">${REQUIRED_LINES_MARKUP}</div>
        </section>

        <section id="panel-log" class="panel space-y-3" role="tabpanel" aria-labelledby="log-heading" hidden>
            <h2 id="log-heading" class="section-title">Prize Log</h2>
            <p class="source-note">This is a preview account saved on this device only. A shared sign-in is not connected yet. No Supabase project or table has been created.</p>
            <p class="source-note">${LOG_DISCLOSURE}</p>
            <div class="required-lines">${REQUIRED_LINES_MARKUP}</div>

            <div id="log-session-form" class="space-y-2">
                <label class="block">
                    <span class="field-label">Display name</span>
                    <input id="log-handle" class="input-shell" type="text" maxlength="40" autocomplete="nickname" placeholder="Name for this device">
                </label>
                <button type="button" class="btn-primary w-full" id="log-signin">Save preview sign-in</button>
                <p id="log-session-status" class="empty-note" role="status"></p>
            </div>
            <div id="log-session-on" class="session-on" hidden>
                <p id="log-session-label" class="empty-note"></p>
                <button type="button" class="btn-secondary btn-compact" id="log-signout">Clear preview sign-in</button>
            </div>

            <form id="prize-log-form" class="space-y-3">
                <div class="flex gap-2" role="group" aria-label="Prize log path">
                    <button type="button" class="btn-secondary flex-1" id="log-path-standard" aria-pressed="true">Standard log</button>
                    <button type="button" class="btn-secondary flex-1" id="log-path-venue" aria-pressed="false">Bought at a venue</button>
                </div>
                <p id="log-path-note" class="source-note">Standard path: pick any official retailer, confirm you were there, and optionally add a GPS check-in or a ticket photo.</p>

                <label class="block">
                    <span class="field-label">Game name</span>
                    <input id="log-game" class="input-shell" type="text" maxlength="80" autocomplete="off">
                </label>
                <div class="row-2">
                    <label class="block">
                        <span class="field-label">Prize amount ($)</span>
                        <input id="log-prize" class="input-shell" type="number" inputmode="decimal" min="0.01" step="0.01">
                    </label>
                    <label class="block">
                        <span class="field-label">Ticket price (optional)</span>
                        <input id="log-price" class="input-shell" type="number" inputmode="decimal" min="0" step="0.01">
                    </label>
                </div>
                <label class="block">
                    <span class="field-label">Date</span>
                    <input id="log-date" class="input-shell" type="date">
                </label>

                <div class="space-y-2">
                    <label class="block">
                        <span class="field-label" id="log-retailer-label">Retailer or venue</span>
                        <input id="log-retailer-query" class="input-shell" type="search" placeholder="Search the official list" autocomplete="off">
                    </label>
                    <ul id="log-retailer-choices" class="retailer-list"></ul>
                    <p id="log-retailer-selected" class="empty-note">No retailer selected yet.</p>
                </div>

                <label class="check-row">
                    <input id="log-present" type="checkbox">
                    <span>I confirm I was at this location when I received this prize.</span>
                </label>

                <div class="space-y-2">
                    <button type="button" class="btn-secondary w-full" id="log-checkin">Optional GPS check-in</button>
                    <div id="checkin-prompt" class="location-prompt" hidden>
                        <p class="location-prompt-title">Optional location check-in</p>
                        <p>Scratch Buddy can compare your device position with this retailer's published coordinates. The position is used once for this check and is not kept. Only a pass or fail, the date, and a coarse distance band are stored if the check passes. Location is optional and off until you agree.</p>
                        <div class="flex gap-2">
                            <button type="button" class="btn-primary flex-1" id="checkin-allow">Use my location</button>
                            <button type="button" class="btn-secondary flex-1" id="checkin-deny">Not now</button>
                        </div>
                    </div>
                    <p id="log-checkin-status" class="source-note">No GPS check-in yet. A log without a matching check-in is marked self-reported unless a photo is attached.</p>
                </div>

                <div class="space-y-2">
                    <label class="block">
                        <span class="field-label" id="log-photo-label">Ticket photo (optional)</span>
                        <input id="log-photo" class="input-shell" type="file" accept="image/*">
                    </label>
                    <p class="source-note">A photo is optional, including on the venue path. Before a photo can be saved, cover the barcode, validation number, and PIN by drawing over them or cropping them out. The stored copy is re-encoded so hidden camera data (EXIF, including GPS) is removed. Photos stay on this device. No photo bucket has been created. If you cannot cover those details, do not attach a photo.</p>
                    <div id="photo-redact" class="photo-redact" hidden>
                        <p class="field-label">Cover or crop sensitive details</p>
                        <canvas id="photo-redact-canvas" class="photo-canvas" aria-label="Ticket photo redaction canvas"></canvas>
                        <div class="flex gap-2">
                            <button type="button" class="btn-secondary flex-1" id="photo-mode-cover" aria-pressed="true">Draw cover</button>
                            <button type="button" class="btn-secondary flex-1" id="photo-mode-crop" aria-pressed="false">Crop</button>
                            <button type="button" class="btn-secondary flex-1" id="photo-redact-reset">Reset</button>
                        </div>
                        <label class="check-row">
                            <input id="photo-redact-confirm" type="checkbox" disabled>
                            <span>I have covered the barcode, validation number, and PIN on this photo.</span>
                        </label>
                        <button type="button" class="btn-primary w-full" id="photo-redact-apply">Use this redacted photo</button>
                    </div>
                    <p id="log-photo-status" class="source-note">No photo attached.</p>
                    <img id="log-photo-preview" class="photo-preview" alt="Ticket photo preview" hidden>
                </div>

                <button type="submit" class="btn-primary w-full" id="log-submit">Save prize log</button>
                <p id="log-form-status" class="empty-note" role="status"></p>
            </form>

            <h3 class="section-title">Logs on this device</h3>
            <p id="log-list-status" class="empty-note" role="status">No prize logs on this device yet.</p>
            <ul id="prize-log-list" class="retailer-list"></ul>
            <button type="button" class="btn-secondary w-full" id="delete-all-data">Delete all my data</button>
            <div id="delete-all-prompt" class="location-prompt" hidden>
                <p class="location-prompt-title">Delete all my data?</p>
                <p>This removes the age pass, preview sign-in, prize logs, and ticket photos stored in this browser. It cannot be undone. If other Scratch Buddy tabs are open, close them so photos can be fully removed.</p>
                <div class="flex gap-2">
                    <button type="button" class="btn-primary flex-1" id="delete-all-confirm">Delete all my data</button>
                    <button type="button" class="btn-secondary flex-1" id="delete-all-cancel">Cancel</button>
                </div>
            </div>
            <p id="delete-all-status" class="empty-note" role="status"></p>
        </section>

        <section id="panel-logs-map" class="panel space-y-3" role="tabpanel" aria-labelledby="logs-map-heading" hidden>
            <h2 id="logs-map-heading" class="section-title">My Log Map</h2>
            <p class="source-note">This map is built only from prize logs on this device. It does not include official prize records or invented points. Every store marker looks the same unless you turn on the optional heat layer. The uniform view does not rank stores.</p>
            <p class="source-note">${LOG_DISCLOSURE}</p>
            <div id="log-heat-controls" class="filter-box" role="group" aria-label="My Log Map layers" data-preview-flag="userLogHeatLayer" hidden>
                <p class="field-label">Layer (preview only)</p>
                <label class="check-row">
                    <input id="log-map-style-uniform" type="radio" name="log-map-style" value="uniform" checked>
                    <span>Uniform markers</span>
                </label>
                <label class="check-row">
                    <input id="log-map-style-heat" type="radio" name="log-map-style" value="heat">
                    <span>Heat layer with verification weights</span>
                </label>
                <div id="log-heat-legend" class="heat-legend" hidden></div>
            </div>
            <button type="button" class="btn-secondary w-full" id="logs-map-locate">Optional: center on my location</button>
            <div id="logs-map-location-prompt" class="location-prompt" hidden>
                <p class="location-prompt-title">Use your location?</p>
                <p>Scratch Buddy can use your device location to center this map. The position is used only to center the map, is not saved, and is not used to add prize logs. Map tiles still go to the tile provider and can show the area you view. Location is optional and off until you agree.</p>
                <div class="flex gap-2">
                    <button type="button" class="btn-primary flex-1" id="logs-map-locate-allow">Use my location</button>
                    <button type="button" class="btn-secondary flex-1" id="logs-map-locate-deny">Not now</button>
                </div>
            </div>
            <div id="my-log-map" class="retailer-map" role="application" aria-label="Map of prize logs on this device"></div>
            <p id="logs-map-status" class="empty-note" role="status">No prize logs on this map yet. Prize logs from this device will appear here after you add them. Nothing has been logged.</p>
            <div class="required-lines">${REQUIRED_LINES_MARKUP}</div>
        </section>

        <section id="panel-prizes" data-preview-flag="prizesRemainingTable" class="panel space-y-3" role="tabpanel" aria-labelledby="prizes-heading" hidden>
            <h2 id="prizes-heading" class="section-title">Statewide prizes remaining</h2>
            <p class="preview-banner">Preview only. Not cleared for public use.</p>
            <p id="prizes-source" class="source-note">Loading the official prize status report…</p>
            <p class="source-note">Source: Scratch-Off Game Daily Prize Status Report (NY Open Data dataset nzqa-7unk). These are statewide official counts for each game and prize tier. They are not per store and do not say where tickets were sold or cashed. Missing official figures are shown as no data.</p>
            <label class="block">
                <span class="sr-only">Search prize status by game</span>
                <input id="prizes-query" class="input-shell" type="search" placeholder="Search by game name or number" autocomplete="off">
            </label>
            <p id="prizes-status" class="empty-note" role="status"></p>
            <div id="prizes-table" class="prizes-table-wrap"></div>
            <div class="required-lines">${REQUIRED_LINES_MARKUP}</div>
        </section>
        <footer class="text-center text-[10px] text-slate-500 px-1 py-3 space-y-2">
            <p>Scratch Buddy is a fun, social companion for scratch-off tickets you already bought. It does not sell tickets, and it is not a tool for placing wagers or picking places to play.</p>
            <div class="help-box required-lines">
                ${REQUIRED_LINES_MARKUP}
                <p>You can also visit <a href="https://www.gamblersanonymous.org" target="_blank" rel="noopener noreferrer" class="underline font-bold text-yellow-400 hover:text-white">Gamblers Anonymous</a>.</p>
            </div>
            <p><a href="./privacy.html">Privacy notice (draft)</a> · <a href="./terms.html">Terms (draft)</a></p>
            <p>${AFFILIATION}</p>
            <p>© 2026 NAV Analytics LLC</p>
        </footer>
    </main>
`;

export const PRIVACY_MARKUP = `
<main class="max-w-md mx-auto px-3 py-6 space-y-3">
    <p class="preview-banner">Draft privacy notice. Pending review by a licensed New York attorney. It describes this preview as built.</p>
    <h1 class="text-white font-black text-lg">Privacy notice</h1>
    <p class="empty-note">Effective November 15, 2026. Last updated November 15, 2026.</p>
    <div class="required-lines">${REQUIRED_LINES_MARKUP}</div>
    <p class="empty-note">Scratch Buddy is an 18+ social companion. This preview has an age check, a retailer search, an interactive map of official retailer locations, official unaudited sales amounts from NY Open Data when those preview flags are on, a prize log that stays on this device, My Log Map, and a statewide prizes-remaining table from the official prize status report. Leaflet and the page styles are self-hosted. Passing the age check is not consent to tracking. Scratch Buddy does not install advertising pixels or other trackers.</p>
    <h2 class="section-title">Who we are</h2>
    <p class="empty-note">NAV Analytics LLC operates Scratch Buddy. Postal address: 58 Owaissa Dr, Rochester, NY 14622. Privacy contact: privacy@insertcoinindustries.com. The inbox is not monitored yet.</p>
    <p class="empty-note">${AFFILIATION}</p>
    <p class="empty-note">${NOT_AFFILIATED_LINE}</p>
    <p class="empty-note">Scratch Buddy does not sell lottery tickets or accept wagers.</p>
    <h2 class="section-title">What this preview stores</h2>
    <ul class="empty-note list-disc pl-4 space-y-1">
        <li>Age check. Under 18, only a session-only block flag is kept until the tab is closed; no date of birth is kept. At 18 or older, only an 18plus pass flag on this device for up to 90 days. The date of birth is not kept.</li>
        <li>Optional Near me and optional map centering use your device location once, in this session, to sort a list or center a view. The position is not saved.</li>
        <li>Optional GPS check-in uses your device location once to compare it with a retailer's published coordinates. Only a pass or fail, the date, and a coarse distance band (&lt;50 m or 50-150 m) may be stored with a prize log. Coordinates, accuracy, and exact distance are not kept.</li>
        <li>A preview sign-in stores only a display name on this device. It is not a shared account.</li>
        <li>Prize logs you choose to save stay in this browser (localStorage and IndexedDB) until you delete them. There is no server copy in this preview.</li>
        <li>A ticket photo is optional. A photo is stored only if you first cover the barcode, validation number, and PIN, or you crop those details out. The stored copy is re-encoded so hidden camera data (EXIF, including GPS) is removed. Photos stay on this device. No photo bucket has been created.</li>
        <li>My Log Map reads only those local prize logs. The default uniform markers do not rank stores. An optional preview heat layer can size and color those same local logs by verification weight; it is not official data.</li>
        <li>Official per-store amounts, when shown, come from the local cache of Lottery Daily Retailer Sales (By Game): Beginning 2024 (xyvi-fbb9). The amounts use the official field names Daily DRAW PAID Sales, Daily IG PAID Sales, and Daily IG SETTLES Sales. This is unaudited NY Open Data. Under-$600 cash-outs only show where tickets were cashed. Missing official rows are shown as no data.</li>
        <li>The prizes-remaining table, when shown, comes from the local cache of the Scratch-Off Game Daily Prize Status Report (nzqa-7unk). Those counts are statewide, not per store.</li>
    </ul>
    <h2 class="section-title">Network requests this preview makes</h2>
    <p class="empty-note">Map tiles are fetched from OpenStreetMap (tile.openstreetmap.org) at the area you view. That tile host receives your IP address and the approximate map area and zoom. Leaflet and Tailwind are self-hosted in this preview, so those libraries are not requested from a third-party CDN. The official retailer list, the official daily retailer sales cache (dataset xyvi-fbb9), and the official scratch-off prize status cache (dataset nzqa-7unk) are read from files served with this preview. This preview does not call data.ny.gov while you use it. There are no advertising or analytics pixels.</p>
    <h2 class="section-title">Retention and deletion</h2>
    <p class="empty-note">On this device, the age pass, preview sign-in, prize logs, and ticket photos are kept until you delete them. Use "Delete all my data" below, or remove a single prize log from the Prize Log tab. If a shared server is later approved, the proposed rule is: keep logs until you delete them, or delete them after 24 months of inactivity, and never keep raw location.</p>
    <button type="button" class="btn-secondary w-full" id="delete-all-data">Delete all my data</button>
    <div id="delete-all-prompt" class="location-prompt" hidden>
        <p class="location-prompt-title">Delete all my data?</p>
        <p>This removes the age pass, preview sign-in, prize logs, and ticket photos stored in this browser. It cannot be undone. If other Scratch Buddy tabs are open, close them so photos can be fully removed.</p>
        <div class="flex gap-2">
            <button type="button" class="btn-primary flex-1" id="delete-all-confirm">Delete all my data</button>
            <button type="button" class="btn-secondary flex-1" id="delete-all-cancel">Cancel</button>
        </div>
    </div>
    <p id="delete-all-status" class="empty-note" role="status"></p>
    <h2 class="section-title">Responsible play</h2>
    <div class="required-lines">${REQUIRED_LINES_MARKUP}</div>
    <p class="empty-note"><a href="./index.html">Back to Scratch Buddy</a> · <a href="./terms.html">Terms (draft)</a></p>
    <p class="empty-note">${AFFILIATION}</p>
    <p class="empty-note">© 2026 NAV Analytics LLC</p>
</main>
`;

export const TERMS_MARKUP = `
<main class="max-w-md mx-auto px-3 py-6 space-y-3">
    <p class="preview-banner">DRAFT — pending legal review. This is not a terms of service. Do not rely on it.</p>
    <h1 class="text-white font-black text-lg">Terms (draft)</h1>
    <div class="required-lines">${REQUIRED_LINES_MARKUP}</div>
    <p class="empty-note">Scratch Buddy is a preview from NAV Analytics LLC, 58 Owaissa Dr, Rochester, NY 14622.</p>
    <p class="empty-note">${AFFILIATION}</p>
    <p class="empty-note">${NOT_AFFILIATED_LINE}</p>
    <p class="empty-note">18+ only. Scratch Buddy does not sell lottery tickets or accept wagers. It is a fun, social companion, not a tool for placing wagers.</p>
    <p class="empty-note">${HOPENY_LINE}</p>
    <p class="empty-note">${PAST_RESULTS_LINE}</p>
    <p class="empty-note"><a href="./index.html">Back to Scratch Buddy</a> · <a href="./privacy.html">Privacy notice (draft)</a></p>
    <p class="empty-note">${AFFILIATION}</p>
    <p class="empty-note">© 2026 NAV Analytics LLC</p>
</main>
`;
