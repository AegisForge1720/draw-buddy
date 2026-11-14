# Release checklist

Draw Buddy is not ready for the App Store or Google Play. This is what still has to happen before submission. Do not treat the draft legal pages or the plan buttons as finished.

## Growth-plan memo (demo copy)

Code-complete for a screen recording of this preview:

- [x] B2: no sportsbook, Lotto.com, courier, affiliate, or `ref=` links, and no buy-tickets control. `DEMO_FLAGS.showAffiliateLinks` stays false.
- [x] B3: picks are labeled “random or stats-based number picks,” with D3 beside them. The expected-value badge is off. Scratch-off odds, prizes-remaining, and the scanner are hidden. The page does not say hot, due, system, winning numbers, ROI, edge, or profit.
- [x] D1, D2, D4, and D5 are in the footer. D7 and the price line sit on the plans screen. There is no trial, so D9 is not sent. The annual price is shown as $17 per year, not as a monthly breakdown.
- [x] No leaderboard and no ticket purchase. Approved taglines on the page: “Track your play. Know your limits.” and “Lottery stats, not lottery tips.”

Not code-complete (still needs a person, a lawyer, or a store/platform account):

- [ ] B1: Certificate of Publication and the §206 suspension. **Needs legal review.**
- [ ] B4 / D9 / D10: real App Store and Play billing, a trial-ending reminder, the 15–45 day annual renewal notice, a confirmation of the terms, and an in-app path that is as easy as sign-up. The D7 text is on screen; the buttons do not bill anyone.
- [ ] B5: platform-policy table corrections and written ad-platform approval before any spend.
- [ ] B6 / D11: referral program, offer codes, and share-sheet disclosure. Not built.
- [ ] B7 and 3.4 #2, #5, #6, #9: 21+ ad targeting, bios, video disclaimers, print, Search Ads, and creator agreements.
- [ ] 3.4 #1: store name, subtitle, keywords, review notes, and screenshots. Game names stay out of the app name. **Needs a person.**
- [ ] 3.4 #3 / D13 / D14: email and SMS are not sent from this preview.
- [ ] 3.4 #7: the press release itself. The app no longer promises scratch-off scanning or a leaderboard.
- [ ] 3.4 #8 and #10: Reddit affiliation process, ATT, and retargeting exclusions. Pixels stay off.
- [ ] 3.7: a 4-year archive of ads. There are no ads in this repo.
- [ ] 3.11 location: not collected here. Apple privacy labels still need a person.
- [ ] Trademark clearance for the game names. **Needs legal review.**

## Billing

- [ ] Connect App Store and Google Play subscriptions at **$1.99 per month** and **$17 per year**.
- [ ] Return that result from `readStoreEntitlement()` in `js/app.js` so `isSubscribed()` in `js/entitlement.js` is the only gate. RevenueCat is a reasonable plug-in. Do not unlock paid tools from `localStorage`.
- [ ] Keep `?debug=1` out of store builds, or leave it as an obvious debug switch that cannot ship as the purchase path.
- [ ] Remove any leftover Stripe test Payment Link. This preview does not link to one.

## Legal review

The site-privacy build below follows the November 13, 2026 requirements. It is not go-live approval. Terms are still a draft. The privacy notice is a working draft pending a licensed New York attorney.

- [ ] Counsel reviews the age-gate copy, the privacy notice, and the banner. `LEGAL_ENTITY` in `js/config.js` is the operator name.
- [ ] Confirm the app’s store age rating and gambling classification. The site gate is 18+. Marketing stays 21+.

## Site privacy go-live (§5 of the legal spec)

Status words: **code-complete** means this preview implements it. **Needs legal review** means a licensed New York attorney has not signed off. **Needs a person** means someone has to do it outside the repo (file, inbox, store console, or platform account). Nothing here is permission to go live.

### 5.1 Preconditions

- [ ] **Needs legal review.** Gate 0: Certificate of Publication for NAV Analytics LLC, or a NY attorney’s sign-off to proceed anyway.
- [x] **Code-complete.** Seller name on the site is `LEGAL_ENTITY.name` (**NAV Analytics LLC**, 58 Owaissa Dr, Rochester, NY 14622). Do not rename it to Insert Coin Industries LLC until the DOS amendment is filed.
- [x] **Code-complete on the site.** Lotto.com, DraftKings, FanDuel, and BetMGM links are removed. **Needs a person** to confirm the same for store listings and social profiles.
- [x] **Code-complete for the live-odds claim.** Scratch-off figures stay labeled sample data. The count legend says High / Mid / Low. The footer uses the spec’s D1–D5 wording. **Needs legal review** before anyone calls the copy final.

### 5.2 Privacy notice

- [x] **Code-complete on the site and in the app footer.** `privacy.html` is linked from the footer, the cookie banner, and the age gate. **Needs a person** for store listings and a separate in-app settings screen (this preview’s footer is the in-app link).
- [x] **Code-complete for the words.** Name, postal address, and draft email come from `LEGAL_ENTITY`. Effective date is November 14, 2026. **Needs a person:** the privacy inbox `privacy@insertcoinindustries.com` is a TODO and is not monitored.
- [x] **Code-complete for current practice.** The notice covers host IP logs, client-side consent and GPC, no precise location, no session replay, and pixels that are not installed. **Needs legal review** so the sale/share wording matches counsel’s view.
- [x] **Code-complete.** The cookie table says Meta and TikTok are not installed.
- [x] **Code-complete.** D1 long form, D2, D3, D4, and D5 are in the footer and the notice.
- [ ] **Needs a person.** Apple privacy labels and Google Data safety are not filed. They must match the notice before store submission. This preview does not collect precise location or advertising identifiers.
- [ ] **Needs legal review.** A NY attorney has not reviewed the notice, and Andrew has not accepted the risk of publishing it.

### 5.3 Age gate

- [x] **Code-complete.** Neutral month/day/year entry, with an unchecked attestation only as a fallback. It runs before the app, the privacy notice, and the terms page.
- [x] **Code-complete.** Under 13 and ages 13–17 store nothing, ask for no parent email, and load no trackers. The 18+ path stores only `flag: "18plus"` for 90 days.
- [x] **Code-complete for this web preview.** The same gate wraps the preview before Supabase is requested. **Needs a person** for a native shell if it ever initializes a different SDK.
- [ ] **Needs a person.** QA in a clean browser with tracker-blocking off, recorded against the network panel, before go-live. Automated checks in this repo see no Meta or TikTok requests. That is not a signed QA pass.

### 5.4 Consent, GPC, and pixels

- [x] **Code-complete.** Banner text and the three buttons match the spec. Reject stores an opt-out. Manage choices starts with optional boxes unchecked. Nothing optional is pre-checked.
- [x] **Code-complete.** “Do Not Sell or Share / targeted ads opt-out” is in the footer and turns optional tracking off immediately.
- [x] **Code-complete.** “Your privacy choices” reopens the choices. “Reset age check” clears the pass flag.
- [x] **Code-complete in script.** `navigator.globalPrivacyControl === true` forces analytics and advertising off and blocks Accept. **Needs a person** to test with a GPC-enabled browser. GitHub Pages cannot read the `Sec-GPC` header.
- [x] **Code-complete as a refusal.** Meta automatic advanced matching is hard-off, and the scaffold has no email or phone field. **Needs a person** to keep that toggle off in Events Manager if a real pixel is ever created.
- [x] **Code-complete as a refusal.** TikTok’s scaffold string calls `holdConsent` before `load`, and it is not inserted while tracking is disabled. No identifiers are included.
- [x] **Code-complete.** No session-replay or keystroke-capture script is installed.
- [x] **Code-complete.** No page embeds video. The pixel plan refuses to run on a page that has a video element or a YouTube, TikTok, or Vimeo iframe.
- [x] **Code-complete on the device only.** Choices are written to `localStorage` (timestamp, page, copy version, choices, GPC). **Needs a person / future host** for a 3-year server log. This static site cannot do that.
- [x] **Code-complete as a disclosure.** The notice states the GitHub Pages limits. **Needs a person** to accept those limits or move the site to a first-party host before real tracking.
- [x] **Code-complete.** Precise location is not requested, and the notice does not claim we collect it.

### 5.5 Social accounts

- [ ] **Needs a person.** Bios, age locks, platform re-reads, TikTok commercial disclosure, YouTube age restriction, LinkedIn staying corporate, Reddit affiliation, X policy re-read, and a 4-year post archive are account work, not this repo.
- [x] **Code-complete helper only.** `withSocialUtm()` in `js/utm.js` can tag a future organic social URL. It is not wired to a sportsbook or courier.

### 5.6 Paid ads stay off

- [x] **Code-complete.** `TRACKING.enabled` is false and both pixel ids are empty. No campaign, custom audience, or lookalike is created from this site.
- [x] **Code-complete reminder.** Retargeting stays off until platform approval, 21+ targeting, consent, GPC, and any future self-exclusion list. See §5.6 and §4.4 of the spec.

### 5.7 Sign-off

- [ ] **Needs legal review.** Ralph has not signed §5.7.
- [ ] **Needs a person.** Andrew Mourgides has not approved go-live. This checklist does not authorize sending mail, paying invoices, or filing with the State.

## Store listing

- [ ] Write the store title, subtitle, description, and keywords without claiming official lottery results, guaranteed returns, or a state-database check.
- [ ] Replace `icons/` (these are placeholders) and capture phone screenshots on iOS and Android.
- [ ] Decide whether the outbound links (Lotto.com, jukeboxes, sportsbooks) are allowed in the store listing. They are labeled as external sites and are not a partnership.
- [ ] Fill in privacy nutrition labels. The preview stores the age confirmation and play history in `localStorage`. It does not create an account.
- [ ] There is no account yet, so account deletion does not apply. Revisit this if accounts are added.

## Data

- [ ] Finish the ingest pipeline for NY Quick Draw, Powerball, and Mega Millions. The client only reads whatever is already in the database and labels it as such.
- [ ] Check rows that do not look like published drawings before calling the feed reliable.
- [ ] Verify `js/odds.js` against the current NY Quick Draw prize chart. The model excludes Extra.
- [ ] Either feed scratch-off remaining prizes from a real source or keep the **sample data** label. Scanning and photo import stay **coming soon** until they actually read a ticket.

## Supabase security

The browser uses the publishable key in `js/config.js`. A previous `index.html` committed a JWT whose role was `service_role`. That value is gone from this branch’s client, and it is still in git history. It bypasses Row Level Security until it is rotated.

- [ ] Rotate the leaked `service_role` credential. [API keys](https://supabase.com/docs/guides/getting-started/api-keys) explains why a secret key cannot ship in a browser. Prefer rotating the legacy JWT secret after nothing in the client depends on the legacy anon JWT. This app uses the publishable key only.
- [ ] Review policies on `quickdraw_history`, `powerball_history`, and `megamillions_history` so the publishable key can read draw rows and cannot write them.
- [ ] `public.live_tickets` and `public.prediction_logs` have Row Level Security and no policies (closed). Confirm that is intentional before any client writes. [RLS enabled, no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- [ ] `public.rls_auto_enable()` is a `SECURITY DEFINER` function that anon and authenticated can execute. Revoke that or move it out of the exposed API. [Public can execute security definer](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- [ ] Re-run the Supabase security advisor after those changes.

## Wrapper

- [ ] Run `npm run cap:ios` and `npm run cap:android` on machines with Xcode and Android Studio. Do not commit `ios/`, `android/`, or `www/`.
- [ ] Smoke-test the installed shell offline: the age gate, sample-draw banner, and cached app shell should still open. Draw requests must not be served from the service worker.
