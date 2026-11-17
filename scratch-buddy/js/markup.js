import { FLAGS, TILE_PROVIDER } from "./flags.js";

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

export const ROBOT_MARKUP = `
<img class="header-mascot" src="./brand/scratch-buddy-transparent-1024.png" width="56" height="56" alt="">
`;

export function shellMarkup(flags = FLAGS) {
    return `
    <header class="app-header">
        <div class="max-w-md mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
                <h1 class="sr-only">Scratch Buddy</h1>
                ${ROBOT_MARKUP}
                <div class="min-w-0">
                    <p class="text-white font-black text-sm tracking-wide leading-none">Scratch Buddy</p>
                    <p class="text-[9px] text-cyan-300/80 font-semibold tracking-wide mt-1">A social companion</p>
                </div>
            </div>
        </div>
    </header>

    <main class="max-w-md mx-auto px-3 pt-3 pb-8 space-y-3">
        ${flags.previewBanner ? `<p class="preview-banner">Private preview. My Log Map markers come only from prize logs on this device. The map stays empty until you log a prize. No sample points are included. A shared database is not connected.</p>` : ""}

        <div class="flex w-full" role="tablist" aria-label="Scratch Buddy sections">
            <button type="button" class="tab-btn" id="tab-find" role="tab" aria-controls="panel-find" aria-selected="true" data-tab="find">Find</button>
            <button type="button" class="tab-btn" id="tab-map" role="tab" aria-controls="panel-map" aria-selected="false" data-tab="map">Map</button>
            <button type="button" class="tab-btn" id="tab-log" role="tab" aria-controls="panel-log" aria-selected="false" data-tab="log">Prize Log</button>
            <button type="button" class="tab-btn" id="tab-logs-map" role="tab" aria-controls="panel-logs-map" aria-selected="false" data-tab="logs-map">My Log Map</button>
        </div>

        <section id="panel-find" class="panel space-y-3" role="tabpanel" aria-labelledby="find-heading">
            <h2 id="find-heading" class="section-title">Find a licensed retailer</h2>
            <p id="retailer-source" class="source-note">Loading the official retailer list…</p>
            <form id="retailer-search-form" class="space-y-3">
                <label class="block">
                    <span class="sr-only">Search for a licensed retailer</span>
                    <input id="retailer-query" class="input-shell" type="search" name="q" placeholder="Search by name, address, city, or ZIP" autocomplete="off" enterkeyhint="search">
                </label>
                ${flags.quickDrawVenue ? `<label class="check-row">
                    <input id="retailer-qd-only" type="checkbox">
                    <span>Quick Draw venues only</span>
                </label>` : ""}
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
            <div id="retailer-map" class="retailer-map" role="application" aria-label="Map of licensed retailers"></div>
            <p id="map-status" class="source-note" role="status">Loading the map…</p>
            <p class="source-note">${LOG_DISCLOSURE}</p>
            <div class="required-lines">${REQUIRED_LINES_MARKUP}</div>
        </section>

        <section id="panel-log" class="panel space-y-3" role="tabpanel" aria-labelledby="log-heading" hidden>
            <h2 id="log-heading" class="section-title">Prize Log</h2>
            <p class="source-note">${flags.previewBanner ? "This is a preview account saved on this device only. A shared sign-in is not connected yet. No Supabase project or table has been created." : "There are no accounts. Your display name and prize logs are saved on this device only and are never uploaded."}</p>
            <p class="source-note">${LOG_DISCLOSURE}</p>
            <div class="required-lines">${REQUIRED_LINES_MARKUP}</div>

            <div id="log-session-form" class="space-y-2">
                <label class="block">
                    <span class="field-label">Display name</span>
                    <input id="log-handle" class="input-shell" type="text" maxlength="40" autocomplete="nickname" placeholder="Name for this device">
                </label>
                <button type="button" class="btn-primary w-full" id="log-signin">Save display name</button>
                <p id="log-session-status" class="empty-note" role="status"></p>
            </div>
            <div id="log-session-on" class="session-on" hidden>
                <p id="log-session-label" class="empty-note"></p>
                <button type="button" class="btn-secondary btn-compact" id="log-signout">Clear display name</button>
            </div>

            <form id="prize-log-form" class="space-y-3">
                ${flags.quickDrawVenue ? `<div class="flex gap-2" role="group" aria-label="Prize log path">
                    <button type="button" class="btn-secondary flex-1" id="log-path-standard" aria-pressed="true">Standard log</button>
                    <button type="button" class="btn-secondary flex-1" id="log-path-venue" aria-pressed="false">Bought at a venue</button>
                </div>` : ""}
                <p id="log-path-note" class="source-note">${flags.quickDrawVenue ? "Standard path: pick" : "Pick"} any official retailer, confirm you were there, and optionally add a GPS check-in or a ticket photo.</p>

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
                        <span class="field-label" id="log-retailer-label">${flags.quickDrawVenue ? "Retailer or venue" : "Retailer"}</span>
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
                    <p class="source-note">A photo is optional${flags.quickDrawVenue ? ", including on the venue path" : ""}. Before a photo can be saved, cover the barcode, validation number, and PIN by drawing over them or cropping them out. The stored copy is re-encoded so hidden camera data (EXIF, including GPS) is removed. Photos stay on this device and are never uploaded. If you cannot cover those details, do not attach a photo.</p>
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
                <p>This removes the age pass, display name, prize logs, and ticket photos stored in this browser. It cannot be undone. If other Scratch Buddy tabs are open, close them so photos can be fully removed.</p>
                <div class="flex gap-2">
                    <button type="button" class="btn-primary flex-1" id="delete-all-confirm">Delete all my data</button>
                    <button type="button" class="btn-secondary flex-1" id="delete-all-cancel">Cancel</button>
                </div>
            </div>
            <p id="delete-all-status" class="empty-note" role="status"></p>
        </section>

        <section id="panel-logs-map" class="panel space-y-3" role="tabpanel" aria-labelledby="logs-map-heading" hidden>
            <h2 id="logs-map-heading" class="section-title">My Log Map</h2>
            <p class="source-note">This map is built only from prize logs on this device. It does not include official prize records or invented points. Every store marker looks the same. The map does not rank stores.</p>
            <p class="source-note">${LOG_DISCLOSURE}</p>
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

        <footer class="text-center text-[10px] text-slate-500 px-1 py-3 space-y-2">
            <p>Scratch Buddy is a fun, social companion for scratch-off tickets you already bought. It does not sell tickets, and it is not a tool for placing wagers or picking places to play.</p>
            <div class="help-box required-lines">
                ${REQUIRED_LINES_MARKUP}
                <p>You can also visit <a href="https://www.gamblersanonymous.org" target="_blank" rel="noopener noreferrer" class="underline font-bold text-yellow-400 hover:text-white">Gamblers Anonymous</a>.</p>
            </div>
            <p><a href="./privacy.html">Privacy</a> · <a href="./terms.html">Terms</a></p>
            <p>${AFFILIATION}</p>
            <p>© 2026 NAV Analytics LLC</p>
        </footer>
    </main>
`;
}

export const SHELL_MARKUP = shellMarkup(FLAGS);

const CONTACT_EMAIL = "ralph@insertcoinindustries.com";
const LEGAL_UPDATED = "November 17, 2026";

export const PRIVACY_MARKUP = `
<main class="max-w-md mx-auto px-3 py-6 space-y-3">
    <p class="empty-note"><a href="./index.html">← Back to Scratch Buddy</a></p>
    <h1 class="text-white font-black text-lg">Privacy</h1>
    <p class="empty-note">Scratch Buddy is provided by NAV Analytics LLC. Last updated ${LEGAL_UPDATED}.</p>
    <div class="required-lines">${REQUIRED_LINES_MARKUP}</div>

    <h2 class="section-title">No accounts</h2>
    <p class="empty-note">Scratch Buddy has no sign-up or login and no server copy of your data. We don't ask for your real name, email or phone number. The optional display name is saved only on your device.</p>

    <h2 class="section-title">What stays on your device</h2>
    <p class="empty-note">Scratch Buddy saves the following in your browser's storage (localStorage, sessionStorage and IndexedDB) on this device only:</p>
    <ul class="empty-note list-disc pl-4 space-y-1">
        <li>Age check. At 18 or older, only an 18plus pass flag is kept on this device for up to 90 days. Under 18, only a session-only block flag is kept until the tab is closed; no date of birth is kept. The date of birth you enter is used once for the check and is never kept.</li>
        <li>An optional display name, used to label your prize logs on this device.</li>
        <li>Prize logs you choose to save: the game name, the prize amount, the optional ticket price, the date and the official retailer you picked.</li>
        <li>An optional ticket photo. A photo can be saved only after you cover or crop out the barcode, validation number and PIN. The saved copy is re-encoded on your device so hidden camera data (EXIF, including GPS) is removed. Photos are never uploaded.</li>
        <li>My Log Map reads only those prize logs. It does not rank stores or show store totals.</li>
    </ul>

    <h2 class="section-title">Location</h2>
    <p class="empty-note">Scratch Buddy never asks for your location when it loads. It asks only when you tap Near me, center My Log Map on your location, or use the optional GPS check-in, and only after you agree in the app first.</p>
    <ul class="empty-note list-disc pl-4 space-y-1">
        <li>Near me and map centering use your position once, on your device, to sort the retailer list or center the map. The position is not saved or sent to us.</li>
        <li>GPS check-in compares your position with the retailer's published coordinates on your device. Only a pass or fail, the date and a coarse distance band (&lt;50 m or 50-150 m) are saved with the prize log. Coordinates, accuracy and exact distance are not kept.</li>
    </ul>

    <h2 class="section-title">Services the app loads from</h2>
    <p class="empty-note">When you use Scratch Buddy, your browser makes requests to these services. Like any website, they receive standard request details such as your IP address and browser type.</p>
    <ul class="empty-note list-disc pl-4 space-y-1">
        <li>The website host that serves Scratch Buddy keeps standard server logs, including IP addresses.</li>
        <li>${TILE_PROVIDER.name} (${TILE_PROVIDER.host}): map images. The tile host receives your IP address and the approximate map area and zoom you view.</li>
    </ul>
    <p class="empty-note">Leaflet and Tailwind are self-hosted, so those libraries are not requested from a third-party CDN. The official retailer list (NYS Lottery Retailers, data.ny.gov) is a file served with the app, not a request to the state's site.</p>
    <p class="empty-note">Scratch Buddy has no ads, no tracking pixels and no analytics, and we don't sell or share your information. Passing the age check is not consent to tracking.</p>

    <h2 class="section-title">Keeping and deleting your data</h2>
    <p class="empty-note">Everything above stays on this device until you delete it. Remove a single prize log from the Prize Log tab, clear this site's data in your browser, or use "Delete all my data" below.</p>
    <button type="button" class="btn-secondary w-full" id="delete-all-data">Delete all my data</button>
    <div id="delete-all-prompt" class="location-prompt" hidden>
        <p class="location-prompt-title">Delete all my data?</p>
        <p>This removes the age pass, display name, prize logs, and ticket photos stored in this browser. It cannot be undone. If other Scratch Buddy tabs are open, close them so photos can be fully removed.</p>
        <div class="flex gap-2">
            <button type="button" class="btn-primary flex-1" id="delete-all-confirm">Delete all my data</button>
            <button type="button" class="btn-secondary flex-1" id="delete-all-cancel">Cancel</button>
        </div>
    </div>
    <p id="delete-all-status" class="empty-note" role="status"></p>

    <h2 class="section-title">Adults only</h2>
    <p class="empty-note">Scratch Buddy is for adults 18 and older.</p>

    <h2 class="section-title">Questions</h2>
    <p class="empty-note">Questions: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
    <div class="required-lines">${REQUIRED_LINES_MARKUP}</div>
    <p class="empty-note">${AFFILIATION}</p>
    <p class="empty-note"><a href="./terms.html">Terms</a> · © 2026 NAV Analytics LLC</p>
</main>
`;

export const TERMS_MARKUP = `
<main class="max-w-md mx-auto px-3 py-6 space-y-3">
    <p class="empty-note"><a href="./index.html">← Back to Scratch Buddy</a></p>
    <h1 class="text-white font-black text-lg">Terms</h1>
    <p class="empty-note">Scratch Buddy is provided by NAV Analytics LLC. Last updated ${LEGAL_UPDATED}.</p>

    <h2 class="section-title">18+ only</h2>
    <p class="empty-note">You must be 18 or older to use Scratch Buddy.</p>

    <h2 class="section-title">What Scratch Buddy is</h2>
    <ul class="empty-note list-disc pl-4 space-y-1">
        <li>Scratch Buddy is a free companion for scratch-off tickets you already bought. It has a search and map of licensed New York Lottery retailers from public state data, and a personal prize log kept on your device.</li>
        <li>${PAST_RESULTS_LINE} Nothing in the app makes a prize more likely or tells you where to buy.</li>
        <li>Scratch Buddy does not sell lottery tickets or take wagers, and it has no accounts.</li>
        <li>${NOT_AFFILIATED_LINE}</li>
    </ul>

    <h2 class="section-title">Retailer data</h2>
    <ul class="empty-note list-disc pl-4 space-y-1">
        <li>The retailer list comes from the NYS Lottery Retailers dataset published by the New York State Gaming Commission on data.ny.gov. Addresses are the Gaming Commission's address of record and are subject to change. The list may be out of date or incomplete. Check official sources.</li>
        <li>The list shows licensed locations, not individual ticket machines, and it does not say which locations sell scratch-off tickets.</li>
    </ul>

    <h2 class="section-title">Prize logs and photos</h2>
    <ul class="empty-note list-disc pl-4 space-y-1">
        <li>${LOG_DISCLOSURE}</li>
        <li>Log only prizes you actually received. Prize logs are for your own records.</li>
        <li>Not official ticket validation. Confirm prizes with the official lottery at nylottery.ny.gov.</li>
        <li>Never share a photo showing your ticket's barcode or numbers. Anyone with them may be able to claim your prize.</li>
    </ul>

    <h2 class="section-title">No warranty</h2>
    <p class="empty-note">Scratch Buddy is provided as is, without warranties of any kind. To the extent the law allows, NAV Analytics LLC is not liable for any loss from using the app, including any ticket you buy. These terms are governed by New York law.</p>

    <h2 class="section-title">Your data</h2>
    <p class="empty-note">Prize logs, photos and settings you save stay on your device. See the <a href="./privacy.html">Privacy</a> page.</p>

    <h2 class="section-title">Questions</h2>
    <p class="empty-note">Questions: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
    <div class="required-lines">${REQUIRED_LINES_MARKUP}</div>
    <p class="empty-note">${AFFILIATION}</p>
    <p class="empty-note"><a href="./privacy.html">Privacy</a> · © 2026 NAV Analytics LLC</p>
</main>
`;
