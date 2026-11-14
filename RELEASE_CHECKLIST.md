# Release checklist

Draw Buddy is not ready for the App Store or Google Play. This is what still has to happen before submission. Do not treat the draft legal pages or the plan buttons as finished.

## Billing

- [ ] Connect App Store and Google Play subscriptions at **$1.99 per month** and **$17 per year**.
- [ ] Return that result from `readStoreEntitlement()` in `js/app.js` so `isSubscribed()` in `js/entitlement.js` is the only gate. RevenueCat is a reasonable plug-in. Do not unlock paid tools from `localStorage`.
- [ ] Keep `?debug=1` out of store builds, or leave it as an obvious debug switch that cannot ship as the purchase path.
- [ ] Remove any leftover Stripe test Payment Link. This preview does not link to one.

## Legal review

- [ ] Counsel reviews `MINIMUM_AGE` in `js/config.js` (currently 18) and the age-gate copy. The constant is marked TODO.
- [ ] Replace `terms.html` and `privacy.html`. Both are labeled **DRAFT / pending legal review** and are not terms or a privacy policy.
- [ ] Confirm the responsible-play disclaimer and the Gamblers Anonymous link are the wording counsel wants.
- [ ] Confirm the app’s store age rating and gambling classification.

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
