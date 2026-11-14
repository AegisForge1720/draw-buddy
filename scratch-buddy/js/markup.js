export const AFFILIATION = "Scratch Buddy is an independent app from NAV Analytics LLC. It is not affiliated with, endorsed by, or sponsored by the New York Lottery or the New York State Gaming Commission.";

export const EV_COPY = "Expected value is the average return per ticket from a published prize list, minus the ticket price. It is not a prediction or an advantage.";

export const LOG_MARKUP = `
<main>
    <header class="stack">
        <h1>SCRATCH <span>BUDDY</span></h1>
        <p class="lede">A log of scratch-off tickets you enter yourself. This preview does not sell tickets.</p>
    </header>
    <section class="card" aria-labelledby="official-heading">
        <h2 id="official-heading">Published game figures</h2>
        <p id="ev-line" class="ev-line">${EV_COPY}</p>
        <div class="stats">
            <div class="stat"><span>Expected value</span><strong id="stat-ev">Data unavailable</strong></div>
            <div class="stat"><span>Top prizes left</span><strong id="stat-prizes">Data unavailable</strong></div>
            <div class="stat"><span>Odds</span><strong id="stat-odds">Data unavailable</strong></div>
        </div>
        <p class="note">No official remaining-prize list is loaded, so these figures stay unavailable.</p>
    </section>
    <section class="card" aria-labelledby="log-heading">
        <h2 id="log-heading">Your tickets</h2>
        <form id="ticket-form" class="stack">
            <label>Game name
                <input id="ticket-game" name="game" type="text" autocomplete="off" maxlength="80">
            </label>
            <div class="row">
                <label>Price you paid ($)
                    <input id="ticket-cost" name="cost" type="number" inputmode="decimal" min="0" step="0.01">
                </label>
                <label>Amount paid to you ($)
                    <input id="ticket-payout" name="payout" type="number" inputmode="decimal" min="0" step="0.01">
                </label>
            </div>
            <div class="actions">
                <button class="primary" type="submit">Log this ticket</button>
                <button class="secondary" id="photo-button" type="button">Photo</button>
            </div>
        </form>
        <p id="log-status" class="status" role="status"></p>
        <div class="totals">
            <div class="total"><span>Tickets logged</span><strong id="log-count">0</strong></div>
            <div class="total"><span>You paid</span><strong id="log-spent">$0.00</strong></div>
            <div class="total"><span>Paid to you</span><strong id="log-won">$0.00</strong></div>
            <div class="total"><span>Logged net</span><strong id="log-net">$0.00</strong></div>
        </div>
        <div class="log-actions">
            <button class="secondary" id="export-log" type="button">Export CSV</button>
            <button class="secondary" id="clear-log" type="button">Clear log</button>
        </div>
        <table>
            <thead><tr><th>Game</th><th>Price</th><th>Paid to you</th></tr></thead>
            <tbody id="log-body"><tr><td colspan="3">No tickets logged on this device yet.</td></tr></tbody>
        </table>
    </section>
    <footer>
        <p>18+ only. Gambling can be addictive. If you or someone you know has a gambling problem, help is available. Call the NY HOPEline at 1-877-8-HOPENY (1-877-846-7369) or text HOPENY (467369).</p>
        <p><a href="https://www.gamblersanonymous.org" target="_blank" rel="noopener noreferrer">Gamblers Anonymous</a> also offers free, confidential resources.</p>
        <p>Scratch Buddy does not sell lottery tickets. The log stays on this device.</p>
        <p><a href="./privacy.html">Privacy notice (draft)</a> · <a href="./terms.html">Terms (draft)</a></p>
        <p>${AFFILIATION}</p>
    </footer>
</main>
`;

export const PRIVACY_MARKUP = `
<main class="stack">
    <p class="note">Draft privacy notice. Pending review by a licensed New York attorney. Adapted from the Draw Buddy draft. It describes this preview as built.</p>
    <h1>Privacy notice</h1>
    <p class="lede">Effective November 14, 2026. Last updated November 14, 2026.</p>
    <p class="lede">Scratch Buddy is an 18+ scratch-off log. This page says what this preview does today: an age check, then a log you type in on this device. It does not load official prize lists and it does not install advertising pixels. Passing the age check is not consent to tracking.</p>
    <h2>Who we are</h2>
    <p class="lede">NAV Analytics LLC operates Scratch Buddy. Postal address: 58 Owaissa Dr, Rochester, NY 14622. Privacy contact: privacy@insertcoinindustries.com. The inbox is not monitored yet.</p>
    <p class="lede">${AFFILIATION}</p>
    <p class="lede">Scratch Buddy does not sell lottery tickets or accept wagers.</p>
    <h2>What this preview stores</h2>
    <ul>
        <li>Age check. Under 18, nothing is kept. At 18 or older, only an 18plus pass flag on this device for up to 90 days. The date of birth is not kept.</li>
        <li>Tickets you choose to log, in this browser only. There is no account.</li>
    </ul>
    <h2>Responsible play</h2>
    <p class="lede">18+ only. Call the NY HOPEline at 1-877-8-HOPENY (1-877-846-7369) or text HOPENY (467369).</p>
    <p class="lede"><a href="./index.html">Back to Scratch Buddy</a> · <a href="./terms.html">Terms (draft)</a></p>
    <p class="lede">${AFFILIATION}</p>
</main>
`;

export const TERMS_MARKUP = `
<main class="stack">
    <p class="note">DRAFT — pending legal review. This is not a terms of service. Adapted from the Draw Buddy draft. Do not rely on it.</p>
    <h1>Terms (draft)</h1>
    <p class="lede">Scratch Buddy is a preview from NAV Analytics LLC, 58 Owaissa Dr, Rochester, NY 14622.</p>
    <p class="lede">${AFFILIATION}</p>
    <p class="lede">18+ only. Scratch Buddy does not sell lottery tickets or accept wagers. The log stays on this device. Expected value, when a published prize list is available, is not a prediction or an advantage. No official prize list is loaded in this preview.</p>
    <p class="lede">Gambling can be addictive. Call the NY HOPEline at 1-877-8-HOPENY (1-877-846-7369) or text HOPENY (467369).</p>
    <p class="lede"><a href="./index.html">Back to Scratch Buddy</a> · <a href="./privacy.html">Privacy notice (draft)</a></p>
    <p class="lede">${AFFILIATION}</p>
</main>
`;
