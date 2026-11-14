# Scratch Buddy

Scratch Buddy is a separate static app for a personal scratch-off log. It is not part of Draw Buddy and does not read Draw Buddy pages.

Official remaining prizes, odds, and expected value are not loaded. Those fields stay **Data unavailable**. Expected value, when a complete published prize list is supplied to `expectedValuePerTicket` in `js/scratch.js`, is the average prize minus the ticket price. The page says that figure is not a prediction or an advantage.

The log stores only tickets you type in: game name, price you paid, and amount paid to you. Totals are the sum of that log. Photos are not read, and nothing is checked against a state database. There is no network call.

An 18+ age check runs before the log, the privacy draft, and the terms draft. It stores only `flag: "18plus"` and an expiry in `scratch_buddy_age_gate`. The date of birth is not kept. There is no price and no subscription screen.

`privacy.html` and `terms.html` are drafts adapted from Draw Buddy's drafts and are marked pending legal review. They are not a finished privacy notice or terms of service.

If the repository root is published, `/scratch-buddy/` is a public URL. The age check is not a server wall. The HTML files do not include the log or the legal text; those strings are inserted only after the script accepts an 18+ pass. A `noindex,nofollow` meta tag is on each page. Someone can still open the script files directly. That is not a substitute for a host-level age wall.

The log key is `scratch_buddy_log` in `localStorage`. This app does not read `draw_buddy_scratch_archive`.

## Run

From this folder:

```bash
python3 -m http.server 4180
```

Open `http://127.0.0.1:4180`. The page is `index.html`, `css/app.css`, and `js/`. It does not use Draw Buddy's stylesheet, Supabase client, or subscription screen.

## Test

From the repository root:

```bash
npm test
```

Scratch Buddy cases live in `scratch-buddy/test/scratch.test.mjs`.
