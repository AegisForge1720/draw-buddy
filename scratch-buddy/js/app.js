import { AGE_BLOCK_KEY, classifyDob, readAgePass, writeAgePass } from "./age.js";
import { LOG_MARKUP } from "./markup.js";
import { DATA_UNAVAILABLE, EV_LINE, ledgerTotals, parseTicketEntry } from "./scratch.js";

const STORAGE_KEY = "scratch_buddy_log";

const state = {
    tickets: []
};

function $(id) {
    return document.getElementById(id);
}

function storageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function storageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

function storageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        /* private mode */
    }
}

function formatDollars(amount) {
    if (!Number.isFinite(amount)) return DATA_UNAVAILABLE;
    const sign = amount < 0 ? "-" : "";
    const [whole, frac] = Math.abs(amount).toFixed(2).split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${sign}$${grouped}.${frac}`;
}

function loadLog() {
    const saved = storageGet(STORAGE_KEY);
    if (!saved) {
        state.tickets = [];
        return;
    }
    try {
        const parsed = JSON.parse(saved);
        state.tickets = Array.isArray(parsed) ? parsed.filter((row) => row && typeof row.game === "string") : [];
    } catch {
        state.tickets = [];
    }
}

function saveLog() {
    return storageSet(STORAGE_KEY, JSON.stringify(state.tickets));
}

function renderOfficialStats() {
    ["stat-ev", "stat-prizes", "stat-odds"].forEach((id) => {
        const el = $(id);
        if (el) el.textContent = DATA_UNAVAILABLE;
    });
    const line = $("ev-line");
    if (line) line.textContent = EV_LINE;
}

function renderLog() {
    const totals = ledgerTotals(state.tickets);
    $("log-count").textContent = String(totals.count);
    $("log-spent").textContent = formatDollars(totals.spent);
    $("log-won").textContent = formatDollars(totals.won);
    $("log-net").textContent = formatDollars(totals.net);
    const body = $("log-body");
    body.replaceChildren();
    if (state.tickets.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 3;
        cell.textContent = "No tickets logged on this device yet.";
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    state.tickets.forEach((ticket) => {
        const row = document.createElement("tr");
        [ticket.game, formatDollars(ticket.cost), formatDollars(ticket.payout)].forEach((text) => {
            const cell = document.createElement("td");
            cell.textContent = text;
            row.appendChild(cell);
        });
        body.appendChild(row);
    });
}

function setStatus(message) {
    const status = $("log-status");
    status.textContent = message;
}

function logTicket(event) {
    event.preventDefault();
    const parsed = parseTicketEntry({
        game: $("ticket-game").value,
        cost: $("ticket-cost").value,
        payout: $("ticket-payout").value
    });
    if (!parsed.ok) {
        setStatus(parsed.reason);
        return;
    }
    state.tickets.unshift({
        ...parsed.ticket,
        timestamp: new Date().toISOString()
    });
    const saved = saveLog();
    renderLog();
    $("ticket-form").reset();
    setStatus(saved ? "Saved on this device." : "Saved in this tab only. This browser did not keep the log.");
}

function clearLog() {
    if (!confirm("Clear the scratch-off log saved on this device?")) return;
    state.tickets = [];
    storageRemove(STORAGE_KEY);
    renderLog();
    setStatus("Log cleared on this device.");
}

function explainPhoto() {
    setStatus("Photos are not read. Nothing is checked against a state database.");
}

function exportLog() {
    if (state.tickets.length === 0) {
        setStatus("No tickets logged on this device yet.");
        return;
    }
    const rows = [["Timestamp_ISO", "Game", "Cost", "Payout"]];
    state.tickets.forEach((ticket) => {
        rows.push([
            ticket.timestamp || "",
            `"${String(ticket.game).replace(/"/g, '""')}"`,
            Number(ticket.cost).toFixed(2),
            Number(ticket.payout).toFixed(2)
        ]);
    });
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ScratchBuddy_Log.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

const FAIL_COPY = {
    under13: "Sorry — Scratch Buddy is not offered to children under 13.",
    under18: "Sorry — Scratch Buddy is for adults 18 and over."
};

function sessionAgeBlocked() {
    try {
        return sessionStorage.getItem(AGE_BLOCK_KEY) === "1";
    } catch {
        return false;
    }
}

function showAgeFail(outcome) {
    try {
        sessionStorage.setItem(AGE_BLOCK_KEY, "1");
    } catch {
        /* Private mode can block session storage. The fail screen still shows. */
    }
    const gate = $("age-gate");
    const card = gate.querySelector(".age-card");
    card.replaceChildren();
    const title = document.createElement("h2");
    title.id = "age-gate-title";
    title.tabIndex = -1;
    title.textContent = FAIL_COPY[outcome] || FAIL_COPY.under18;
    card.appendChild(title);
    gate.hidden = false;
    document.documentElement.classList.remove("age-cleared");
    $("app-shell").inert = true;
    title.focus();
}

function grantAccess() {
    document.documentElement.classList.add("age-cleared");
    $("age-gate").hidden = true;
    const shell = $("app-shell");
    if (!shell.dataset.ready) {
        shell.innerHTML = LOG_MARKUP;
        shell.dataset.ready = "1";
        bootApp();
    }
    shell.inert = false;
    shell.removeAttribute("aria-hidden");
}

function renderAgeForm() {
    const gate = $("age-gate");
    const card = gate.querySelector(".age-card");
    card.innerHTML = `
        <p class="age-kicker">Age check</p>
        <h2 id="age-gate-title">Scratch Buddy is for adults 18 and over</h2>
        <p>Enter your date of birth to continue. We use your date of birth only to check your age and do not keep the date after that check.</p>
        <p>Gambling problem? Call 1-877-8-HOPENY (1-877-846-7369) or text HOPENY (467369).</p>
        <div class="age-dob">
            <label>Month
                <select id="age-month" autocomplete="off"><option value="">Month</option></select>
            </label>
            <label>Day
                <select id="age-day" autocomplete="off"><option value="">Day</option></select>
            </label>
            <label>Year
                <select id="age-year" autocomplete="off"><option value="">Year</option></select>
            </label>
        </div>
        <button type="button" id="age-dob-continue" disabled>Continue</button>
        <p id="age-date-error" role="status"></p>
    `;
    const month = card.querySelector("#age-month");
    const day = card.querySelector("#age-day");
    const year = card.querySelector("#age-year");
    ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].forEach((name, index) => {
        const option = document.createElement("option");
        option.value = String(index + 1);
        option.textContent = name;
        month.appendChild(option);
    });
    for (let value = 1; value <= 31; value += 1) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        day.appendChild(option);
    }
    const thisYear = new Date().getFullYear();
    for (let value = thisYear; value >= thisYear - 120; value -= 1) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        year.appendChild(option);
    }
    const button = card.querySelector("#age-dob-continue");
    const refresh = () => {
        button.disabled = classifyDob({ year: year.value, month: month.value, day: day.value }).outcome === "invalid";
    };
    [month, day, year].forEach((select) => select.addEventListener("change", refresh));
    button.addEventListener("click", () => {
        const decision = classifyDob({ year: year.value, month: month.value, day: day.value });
        month.value = "";
        day.value = "";
        year.value = "";
        button.disabled = true;
        if (decision.outcome === "invalid") {
            card.querySelector("#age-date-error").textContent = "Enter a real date of birth.";
            return;
        }
        if (!decision.persist) {
            showAgeFail(decision.outcome);
            return;
        }
        try {
            sessionStorage.removeItem(AGE_BLOCK_KEY);
        } catch {
            /* Ignore. */
        }
        writeAgePass(localStorage);
        grantAccess();
    });
    month.focus();
}

function startAgeGate() {
    const shell = $("app-shell");
    if (sessionAgeBlocked()) {
        shell.inert = true;
        document.documentElement.classList.remove("age-cleared");
        showAgeFail("under18");
        return;
    }
    if (readAgePass(localStorage)) {
        grantAccess();
        return;
    }
    shell.inert = true;
    document.documentElement.classList.remove("age-cleared");
    $("age-gate").hidden = false;
    renderAgeForm();
}

function bootApp() {
    loadLog();
    renderOfficialStats();
    renderLog();
    $("ticket-form").addEventListener("submit", logTicket);
    $("clear-log").addEventListener("click", clearLog);
    $("export-log").addEventListener("click", exportLog);
    $("photo-button").addEventListener("click", explainPhoto);
}

startAgeGate();
