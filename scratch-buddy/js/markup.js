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
        <p class="preview-banner">Styled shell preview. Fonts, colors, buttons, and layout are lined up with Draw Buddy. Search, the map, prize logging, and the heat map are not connected yet. No retailer or payout data is shown.</p>

        <div class="flex w-full" role="tablist" aria-label="Scratch Buddy sections">
            <button type="button" class="tab-btn" id="tab-find" role="tab" aria-controls="panel-find" aria-selected="true" data-tab="find">Find</button>
            <button type="button" class="tab-btn" id="tab-map" role="tab" aria-controls="panel-map" aria-selected="false" data-tab="map">Map</button>
            <button type="button" class="tab-btn" id="tab-log" role="tab" aria-controls="panel-log" aria-selected="false" data-tab="log">Prize Log</button>
            <button type="button" class="tab-btn" id="tab-heat" role="tab" aria-controls="panel-heat" aria-selected="false" data-tab="heat">Heat Map</button>
        </div>

        <section id="panel-find" class="panel space-y-3" role="tabpanel" aria-labelledby="find-heading">
            <h2 id="find-heading" class="section-title">Find a Machine or Venue</h2>
            <label class="block">
                <span class="sr-only">Search for a machine or venue</span>
                <input class="input-shell" type="search" placeholder="Search by name, address, city, or ZIP" disabled aria-disabled="true">
            </label>
            <div class="flex gap-2">
                <button type="button" class="btn-primary flex-1" disabled>Search</button>
                <button type="button" class="btn-secondary flex-1" disabled>Near me</button>
            </div>
            <p class="empty-note">No retailer list is loaded in this step yet. Search will use the official New York State lottery retailer listing in the next step.</p>
        </section>

        <section id="panel-map" class="panel space-y-3" role="tabpanel" aria-labelledby="map-heading" hidden>
            <h2 id="map-heading" class="section-title">Retailer Map</h2>
            <div class="map-frame">
                <p class="empty-note">The interactive map is not connected yet. No locations are shown.</p>
            </div>
        </section>

        <section id="panel-log" class="panel space-y-3" role="tabpanel" aria-labelledby="log-heading" hidden>
            <h2 id="log-heading" class="section-title">Prize Log</h2>
            <p class="empty-note">No prize logs on this device yet. Logging a prize, a location check-in, and a ticket photo will arrive in a later step. Nothing is filled in here.</p>
        </section>

        <section id="panel-heat" class="panel space-y-3" role="tabpanel" aria-labelledby="heat-heading" hidden>
            <h2 id="heat-heading" class="section-title">Payout Heat Map</h2>
            <div class="map-frame">
                <p class="empty-note">No payout data yet. The heat map stays empty until people log real prizes. No sample points are shown.</p>
            </div>
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
    <p class="empty-note">Scratch Buddy is an 18+ social companion. This preview has an age check and a styled shell. It does not install advertising pixels or other trackers. Passing the age check is not consent to tracking.</p>
    <h2 class="section-title">Who we are</h2>
    <p class="empty-note">NAV Analytics LLC operates Scratch Buddy. Postal address: 58 Owaissa Dr, Rochester, NY 14622. Privacy contact: privacy@insertcoinindustries.com. The inbox is not monitored yet.</p>
    <p class="empty-note">${AFFILIATION}</p>
    <p class="empty-note">Scratch Buddy does not sell lottery tickets or accept wagers.</p>
    <h2 class="section-title">What this preview stores</h2>
    <ul class="empty-note list-disc pl-4 space-y-1">
        <li>Age check. Under 18, nothing is kept. At 18 or older, only an 18plus pass flag on this device for up to 90 days. The date of birth is not kept.</li>
        <li>Later steps may store a prize log, an optional device location check-in, and an optional ticket photo on this device only. Those features are not connected yet.</li>
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
