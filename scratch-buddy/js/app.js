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

function boot() {
    loadLog();
    renderOfficialStats();
    renderLog();
    $("ticket-form").addEventListener("submit", logTicket);
    $("clear-log").addEventListener("click", clearLog);
    $("export-log").addEventListener("click", exportLog);
    $("photo-button").addEventListener("click", explainPhoto);
}

boot();
