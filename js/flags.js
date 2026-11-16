/* Draw Buddy feature flags and house copy (loaded first, before any other app script).
 * PUBLIC DEFAULTS ARE ALL OFF. A build is only treated as the private preview when the private
 * preview server (Basic Auth + noindex) injects <meta name="db-build" content="private-preview">
 * into index.html at serve time. Any other host (GitHub Pages, a static copy, a public build)
 * gets the public defaults below.
 * Ralph review 2026-11-16: doublePlay + resultNotices may be on for Andrew's private preview only.
 * partnerLinks (Lotto.com / ref=draw_buddy_stripe / sportsbook "Partner Apps"), shareQr, tierSwitcher
 * and pricing stay OFF in every public build (Gate 0 / §206 hold).
 * Andrew 2026-11-16: his private preview shows every feature (partner links, Share/QR, Free/Pro switcher,
 * pricing) so features can be trimmed later; none of it goes public without Ralph's clearance.
 * Andrew 2026-11-16 3:37 PM: venueChat (real venue chat) built for the private preview only. */
(function (root) {
  'use strict';
  const PUBLIC_DEFAULTS = Object.freeze({
    doublePlay: false,     // Powerball Double Play add-on in settings / Jackpot Pick
    resultNotices: false,  // on-device notice when a logged ticket's draw posts to data.ny.gov
    partnerLinks: false,   // HOLD: Lotto.com courier buttons, sportsbook / partner tiles (affiliate links)
    shareQr: false,        // header Share button and QR sheet
    tierSwitcher: false,   // Free/Pro test switcher
    pricing: false,        // any price, upgrade or buy button (no prices until the §206 cure)
    venueChat: false       // Venue chat (user messages, Supabase venue_messages). Private preview only until Ralph clears UGC moderation + terms
  });
  const PRIVATE_PREVIEW = Object.freeze(Object.assign({}, PUBLIC_DEFAULTS, { doublePlay: true, resultNotices: true, partnerLinks: true, shareQr: true, tierSwitcher: true, pricing: true, venueChat: true }));
  // House copy (exact wording; Ralph's standing rules).
  const COPY = Object.freeze({
    D1: "Past results don't predict future draws. Every draw is independent.",
    RG: '18+. Gambling problem? Call 1-877-8-HOPENY or text HOPENY (467369).',
    NA: 'Not affiliated with any lottery.',
    NOT_OFFICIAL: 'Not official ticket validation. Confirm prizes with the official lottery.',
    // Pending-name placeholder: swap to 'Insert Coin Industries LLC' once the rename is accepted.
    ENTITY: 'NAV Analytics LLC'
  });
  function buildMode(doc) {
    try { const m = doc && doc.querySelector && doc.querySelector('meta[name="db-build"]'); return m && m.getAttribute('content') === 'private-preview' ? 'private-preview' : 'public'; } catch (e) { return 'public'; }
  }
  function resolve(doc) { return buildMode(doc) === 'private-preview' ? Object.assign({}, PRIVATE_PREVIEW) : Object.assign({}, PUBLIC_DEFAULTS); }
  const api = { PUBLIC_DEFAULTS, PRIVATE_PREVIEW, COPY, buildMode, resolve };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  const doc = root.document;
  root.DB_BUILD = buildMode(doc);
  root.DB_FLAGS = resolve(doc);
  root.DB_COPY = COPY;
  // <html class="flag-x"> for every flag that is on; CSS in index.html hides [data-flag~="x"] otherwise.
  try { Object.keys(root.DB_FLAGS).forEach(k => { if (root.DB_FLAGS[k]) doc.documentElement.classList.add('flag-' + k); }); } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
