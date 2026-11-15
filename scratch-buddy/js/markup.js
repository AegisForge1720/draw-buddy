export const AFFILIATION = "Scratch Buddy is an independent app from NAV Analytics LLC. It is not affiliated with, endorsed by, or sponsored by the New York Lottery or the New York State Gaming Commission.";

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
                <span class="badge-ny shrink-0">NY</span>
            </div>
        </div>
    </header>

    <main class="max-w-md mx-auto px-3 pt-3 pb-8 space-y-3">
        <p class="preview-banner">Payout heat map preview. Circles come only from prize logs on this device. The map stays empty until you log a prize. No sample points are included. A shared database is not connected.</p>

        <div class="flex w-full" role="tablist" aria-label="Scratch Buddy sections">
            <button type="button" class="tab-btn" id="tab-find" role="tab" aria-controls="panel-find" aria-selected="true" data-tab="find">Find</button>
            <button type="button" class="tab-btn" id="tab-map" role="tab" aria-controls="panel-map" aria-selected="false" data-tab="map">Map</button>
            <button type="button" class="tab-btn" id="tab-log" role="tab" aria-controls="panel-log" aria-selected="false" data-tab="log">Prize Log</button>
            <button type="button" class="tab-btn" id="tab-heat" role="tab" aria-controls="panel-heat" aria-selected="false" data-tab="heat">Heat Map</button>
        </div>

        <section id="panel-find" class="panel space-y-3" role="tabpanel" aria-labelledby="find-heading">
            <h2 id="find-heading" class="section-title">Find a Machine or Venue</h2>
            <p id="retailer-source" class="source-note">Loading the official retailer list…</p>
            <form id="retailer-search-form" class="space-y-3">
                <label class="block">
                    <span class="sr-only">Search for a machine or venue</span>
                    <input id="retailer-query" class="input-shell" type="search" name="q" placeholder="Search by name, address, city, or ZIP" autocomplete="off" enterkeyhint="search">
                </label>
                <label class="check-row">
                    <input id="retailer-qd-only" type="checkbox">
                    <span>Quick Draw venues only</span>
                </label>
                <div class="flex gap-2">
                    <button type="submit" class="btn-primary flex-1" id="retailer-search">Search</button>
                    <button type="button" class="btn-secondary flex-1" id="retailer-near">Near me</button>
                </div>
            </form>
            <div id="location-prompt" class="location-prompt" hidden>
                <p class="location-prompt-title">Use your location?</p>
                <p>Scratch Buddy can use your device location to list nearby licensed retailers. In this preview, that position stays on this device and is used only to sort this list. Location is optional and off until you agree.</p>
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
            <div id="retailer-map" class="retailer-map" role="application" aria-label="Map of licensed New York Lottery retailers"></div>
            <p id="map-status" class="source-note" role="status">Loading the map…</p>
        </section>

        <section id="panel-log" class="panel space-y-3" role="tabpanel" aria-labelledby="log-heading" hidden>
            <h2 id="log-heading" class="section-title">Prize Log</h2>
            <p class="source-note">This is a preview account saved on this device only. A shared sign-in is not connected yet. No Supabase project or table has been created.</p>

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
                        <p>Scratch Buddy can compare your device position with this retailer's published coordinates. In this preview, that position is used only for this prize log and stays on this device. Location is optional and off until you agree.</p>
                        <div class="flex gap-2">
                            <button type="button" class="btn-primary flex-1" id="checkin-allow">Use my location</button>
                            <button type="button" class="btn-secondary flex-1" id="checkin-deny">Not now</button>
                        </div>
                    </div>
                    <p id="log-checkin-status" class="source-note">No GPS check-in yet. A log without a matching check-in is marked unverified unless a photo is attached.</p>
                </div>

                <div class="space-y-2">
                    <label class="block">
                        <span class="field-label" id="log-photo-label">Ticket photo (optional)</span>
                        <input id="log-photo" class="input-shell" type="file" accept="image/*">
                    </label>
                    <p class="source-note">Ticket photos can show barcodes or serial numbers. This preview stores the photo only on this device. Consider cropping those details before you add a photo. A shared photo store has not been created.</p>
                    <p id="log-photo-status" class="source-note">No photo attached.</p>
                    <img id="log-photo-preview" class="photo-preview" alt="Ticket photo preview" hidden>
                </div>

                <button type="submit" class="btn-primary w-full" id="log-submit">Save prize log</button>
                <p id="log-form-status" class="empty-note" role="status"></p>
            </form>

            <h3 class="section-title">Logs on this device</h3>
            <p id="log-list-status" class="empty-note" role="status">No prize logs on this device yet.</p>
            <ul id="prize-log-list" class="retailer-list"></ul>
        </section>

        <section id="panel-heat" class="panel space-y-3" role="tabpanel" aria-labelledby="heat-heading" hidden>
            <h2 id="heat-heading" class="section-title">Payout Heat Map</h2>
            <p class="source-note">This map is built only from prize logs on this device. It does not include official payout records or invented points. Circle size follows verification weight: unverified 1, location-confirmed or photo-attached 2, both 3.</p>
            <ul class="heat-legend" aria-label="Verification colors">
                <li><span class="heat-swatch heat-swatch-unverified"></span> Unverified</li>
                <li><span class="heat-swatch heat-swatch-location"></span> Location-confirmed</li>
                <li><span class="heat-swatch heat-swatch-photo"></span> Photo-attached</li>
                <li><span class="heat-swatch heat-swatch-both"></span> Location-confirmed and photo-attached</li>
            </ul>
            <button type="button" class="btn-secondary w-full" id="heat-locate">Optional: center on my location</button>
            <div id="heat-location-prompt" class="location-prompt" hidden>
                <p class="location-prompt-title">Use your location?</p>
                <p>Scratch Buddy can use your device location to center this payout map. In this preview, that position stays on this device, is not saved, and is not used to invent payouts. Location is optional and off until you agree.</p>
                <div class="flex gap-2">
                    <button type="button" class="btn-primary flex-1" id="heat-locate-allow">Use my location</button>
                    <button type="button" class="btn-secondary flex-1" id="heat-locate-deny">Not now</button>
                </div>
            </div>
            <div id="payout-heat-map" class="retailer-map" role="application" aria-label="Payout heat map of prize logs on this device"></div>
            <p id="heat-status" class="empty-note" role="status">No payout data yet. Prize logs from this device will appear here after you add them. Nothing has been logged.</p>
        </section>

        <footer class="text-center text-[10px] text-slate-500 px-1 py-3 space-y-2">
            <p>Scratch Buddy is a fun, social companion for scratch-off tickets you already bought. It does not sell tickets, and it is not a tool for placing wagers or picking places to play.</p>
            <div class="help-box">
                18+ only. Gambling can be addictive. If you or someone you know needs support, call the NY HOPEline at 1-877-8-HOPENY (1-877-846-7369) or text HOPENY (467369). You can also visit <a href="https://www.gamblersanonymous.org" target="_blank" rel="noopener noreferrer" class="underline font-bold text-yellow-400 hover:text-white">Gamblers Anonymous</a>.
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
    <p class="empty-note">Scratch Buddy is an 18+ social companion. This preview has an age check, a retailer search, an interactive map of official retailer locations, a prize log that stays on this device, and a payout heat map built only from those logs. The maps use OpenStreetMap tiles. It does not install advertising pixels or other trackers. Passing the age check is not consent to tracking.</p>
    <h2 class="section-title">Who we are</h2>
    <p class="empty-note">NAV Analytics LLC operates Scratch Buddy. Postal address: 58 Owaissa Dr, Rochester, NY 14622. Privacy contact: privacy@insertcoinindustries.com. The inbox is not monitored yet.</p>
    <p class="empty-note">${AFFILIATION}</p>
    <p class="empty-note">Scratch Buddy does not sell lottery tickets or accept wagers.</p>
    <h2 class="section-title">What this preview stores</h2>
    <ul class="empty-note list-disc pl-4 space-y-1">
        <li>Age check. Under 18, nothing is kept. At 18 or older, only an 18plus pass flag on this device for up to 90 days. The date of birth is not kept.</li>
        <li>Optional Near me uses your device location only to sort nearby retailers in this browser session. The position is not saved unless you later add a GPS check-in to a prize log, and it is not used until you agree on a prompt in the app and in the browser.</li>
        <li>A preview sign-in stores only a display name on this device. It is not a shared account.</li>
        <li>Prize logs you choose to save, including an optional GPS check-in and an optional ticket photo, stay in this browser (localStorage and IndexedDB). Ticket photos can show barcodes or serial numbers. Nothing is uploaded, and no Supabase table or photo bucket has been created.</li>
        <li>The payout heat map reads only those local prize logs. Optional location on that map is used only to center the view and is not saved.</li>
    </ul>
    <h2 class="section-title">Responsible play</h2>
    <p class="empty-note">18+ only. Call the NY HOPEline at 1-877-8-HOPENY (1-877-846-7369) or text HOPENY (467369).</p>
    <p class="empty-note"><a href="./index.html">Back to Scratch Buddy</a> · <a href="./terms.html">Terms (draft)</a></p>
    <p class="empty-note">${AFFILIATION}</p>
    <p class="empty-note">© 2026 NAV Analytics LLC</p>
</main>
`;

export const TERMS_MARKUP = `
<main class="max-w-md mx-auto px-3 py-6 space-y-3">
    <p class="preview-banner">DRAFT — pending legal review. This is not a terms of service. Do not rely on it.</p>
    <h1 class="text-white font-black text-lg">Terms (draft)</h1>
    <p class="empty-note">Scratch Buddy is a preview from NAV Analytics LLC, 58 Owaissa Dr, Rochester, NY 14622.</p>
    <p class="empty-note">${AFFILIATION}</p>
    <p class="empty-note">18+ only. Scratch Buddy does not sell lottery tickets or accept wagers. It is a fun, social companion, not a tool for placing wagers.</p>
    <p class="empty-note">Gambling can be addictive. Call the NY HOPEline at 1-877-8-HOPENY (1-877-846-7369) or text HOPENY (467369).</p>
    <p class="empty-note"><a href="./index.html">Back to Scratch Buddy</a> · <a href="./privacy.html">Privacy notice (draft)</a></p>
    <p class="empty-note">${AFFILIATION}</p>
    <p class="empty-note">© 2026 NAV Analytics LLC</p>
</main>
`;
