# Draw Buddy

Draw Buddy is a downloadable consumer app for exploring lottery draw statistics. It covers NY Quick Draw, Powerball, and Mega Millions, with random or stats-based number picks, a count heatmap when a source time is available, and a personal play history stored on the device.

The preview is a static site (`index.html`, vanilla JavaScript modules, a built Tailwind stylesheet, and Supabase reads). GitHub Pages can publish this folder as-is. A Capacitor config is included so the same files can later be wrapped for iOS and Android.

## Pricing

A player pays for Draw Buddy with one subscription. Both plans are meant to unlock the same tools. Billing is not connected in this preview: the plan buttons do not charge a card and do not unlock anything.

| Plan | Price |
| --- | --- |
| Monthly | $1.99 per month |
| Annual | $17 per year |

Annual saves $6.88 versus paying monthly ($1.99 × 12 = $23.88), about 29% off.

Store billing (App Store / Google Play, optionally through RevenueCat) should call `isSubscribed()` in `js/entitlement.js`. Until that returns a real entitlement, paid tools stay locked. Add `?debug=1` to the URL to show a local Locked / Subscribed preview. That switch does not bill anyone, and it is hidden without the flag.

## Play responsibly

Draw Buddy is a statistical entertainment tool from NAV Analytics LLC. It does not guarantee winnings. The site asks for a date of birth, stores only an 18+ pass flag, and then shows a tracking banner that defaults to off. Optional pixels are not installed. The privacy notice and terms are drafts pending a licensed New York attorney. The HOPEline and Gamblers Anonymous links stay in the footer.

## What is and is not live

- Draw rows come from the configured Supabase project when the request succeeds. The screen says they are loaded from that database. It does not call them an official feed.
- If the request fails or the device is offline before a load, the app shows **sample draws** generated on the device and says so. Grades against those draws are not official results.
- Quick Draw base-game expected value, Kelly fraction, and Monte Carlo use the prize table in `js/odds.js`. That table is not an official quote, and Extra is not included. Powerball and Mega Millions do not get a made-up ROI.
- The default build is a clean demo. `DEMO_FLAGS` in `js/config.js` hides scratch-off odds, ticket-photo import, stake models, the cluster helper, and the expected-value badge. Sportsbook and courier links are not in the page. Number picks use the label “random or stats-based number picks,” with the no-odds disclaimer beside them.
- The Markov & Kelly button is **coming soon**. The cluster control is a count heuristic with fixed wager steps.
- Slips are saved in `localStorage` on the device. Nothing is uploaded as a “cloud” ticket.
- The countdown is a local timer, not the official draw clock.

## Run

Modules and the service worker need a local web server. Opening `index.html` as a file will not work.

```bash
npm install
npm start
```

Then open `http://localhost:4173`. The first screen asks for a date of birth. Plans on the page are **$1.99 / mo** and **$17 / yr**. After a pass, the privacy banner appears. Reject leaves every optional pixel unloaded.

`npm install` is only required for the build tools, tests, and the local server. The committed `css/tailwind.css` and `vendor/supabase.js` are what the static site loads.

## Test

```bash
npm test
```

That runs the Node test runner against the plan math, the entitlement gate, the Quick Draw odds model, ticket grading, and the billing-notice hooks. Browser checks that still need a person or a script: age gate, game switcher, number picks, history, both plan prices, the agreement checkbox, and the draft legal pages.

## Build

```bash
npm run build
```

`build:css` compiles Tailwind from `src/tailwind.css` into `css/tailwind.css`. `build:vendor` bundles `@supabase/supabase-js` into `vendor/supabase.js` so the page does not depend on the Tailwind or Supabase CDNs at runtime. Commit both outputs when you change classes or the Supabase client. The publishable Supabase key and URL live in one block at the top of `js/config.js`.

## Deploy

GitHub Pages serves the repository root. No Pages build command is required, because the stylesheet and the Supabase bundle are already in the repo. In the repository settings, set Pages to deploy from the branch you want, folder `/` (root). The service worker caches the app shell with network-first and does not intercept `supabase.co`, and draw requests use `cache: "no-store"`.

Do not commit `node_modules/`, `www/`, `ios/`, or `android/`.

## Capacitor

The wrapper is a scaffold only. Native projects are created on a Mac or a machine with Android Studio, and they are gitignored.

```bash
npm install
npm run cap:sync    # copies the site into www/ and syncs Capacitor
npm run cap:ios     # first time: creates the Xcode project (do not commit ios/)
npm run cap:android # first time: creates the Android project (do not commit android/)
```

`capacitor.config.json` reads the staged site from `www/`. `npm run stage:www` only copies the web files. After the native project exists, open it with Xcode or Android Studio. Store billing, icons, and the legal pages still have to be finished before submission. See `RELEASE_CHECKLIST.md`.
