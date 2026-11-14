import {
    DATA_VERIFIED,
    DEMO_FLAGS,
    DRAW_BUDDY_CONFIG,
    annualSavings,
    formatPlanMoney,
    isBrowserSafeSupabaseKey,
    publicDrawTable
} from "./config.js";
import { readAgePass } from "./age.js";
import { startSiteGate } from "./compliance.js";
import {
    BILLING_NOTICES,
    D3,
    D7,
    STORE_SUBSCRIPTION_URLS,
    annualRenewalNoticeDue,
    d6Line,
    formatAsOfEt,
    trialEndingReminderDue
} from "./notices.js";
import { isSubscribed as entitlementIsSubscribed } from "./entitlement.js";
import { gradeTickets } from "./grading.js";
import { expectedOneStepRepeatRate, oneStepRepeatRate } from "./odds.js";
import {
    DATA_UNAVAILABLE,
    formatCountdown,
    formatDrawListing,
    formatScheduledDraw,
    historyStatus,
    officialDrawInstant,
    projectNextDraw,
    quickDrawNumberLabel,
    upcomingWeeklyDraws
} from "./schedule.js";

const { PLAN_MONTHLY_PRICE, PLAN_ANNUAL_PRICE, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = DRAW_BUDDY_CONFIG;

const GAME_BUTTON_ON = "bg-cyan-600 text-white p-2 rounded-lg font-black text-xs shadow transition text-center";
const GAME_BUTTON_OFF = "bg-[#111c38] text-slate-300 hover:text-white border border-slate-800 p-2 rounded-lg font-bold text-xs transition text-center";

const GAME_CONFIGS = {
    quickdraw: {
        name: "NY Quick Draw",
        shortName: "Quick Draw",
        totalNumbers: 80,
        drawnCount: 20,
        maxSpot: 4,
        hasBonus: false,
        wagerOptions: [1, 2, 3, 4, 5, 10],
        defaultWager: 1,
        defaultTime: 240
    },
    powerball: {
        name: "Powerball",
        shortName: "Powerball",
        totalNumbers: 69,
        drawnCount: 5,
        bonusTotal: 26,
        maxSpot: 5,
        hasBonus: true,
        bonusName: "Powerball",
        wagerOptions: [2, 3, 5, 10, 25],
        defaultWager: 2,
        defaultTime: 43200
    },
    megamillions: {
        name: "Mega Millions",
        shortName: "Mega Millions",
        totalNumbers: 70,
        drawnCount: 5,
        bonusTotal: 25,
        maxSpot: 5,
        hasBonus: true,
        bonusName: "Mega Ball",
        wagerOptions: [5],
        defaultWager: 5,
        defaultTime: 43200
    }
};

const state = {
    activeGameKey: "quickdraw",
    cachedDraws: [],
    sessionTickets: [],
    lastGeneratedNumbers: [],
    latestFetchedDraw: null,
    resultsLabeled: false,
    historyAvailable: false,
    fetchFailed: false,
    countdownSeconds: null,
    picksBlockSize: null,
    lastPicksGame: null,
    dataMode: "loading",
    fetchToken: 0,
    supabaseClient: null,
    currentState: storageGet("draw_buddy_state") || "NY"
};

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

function isDebugMode() {
    return new URLSearchParams(location.search).get("debug") === "1";
}

// Plug-in point for App Store / Google Play / RevenueCat.
// Return true or false once a store SDK is connected. null means "not connected".
function readStoreEntitlement() {
    return null;
}

function isSubscribed() {
    return entitlementIsSubscribed({
        debug: isDebugMode(),
        debugTier: storageGet("draw_buddy_active_tier") || "free",
        storeEntitlement: readStoreEntitlement()
    });
}

function $(id) {
    return document.getElementById(id);
}

function showDialog(title, body, options = {}) {
    const dialog = $("info-dialog");
    $("info-dialog-title").textContent = title;
    $("info-dialog-body").textContent = body;
    $("info-dialog-plans").hidden = !options.plans;
    if (typeof dialog.showModal === "function") {
        if (!dialog.open) dialog.showModal();
        $("info-dialog-close").focus();
        return;
    }
    const notice = $("app-notice");
    notice.hidden = false;
    notice.textContent = `${title}. ${body}`;
}

function showLocked(featureName) {
    const saved = annualSavings();
    showDialog(
        "Subscription",
        `${featureName} is included with Monthly (${formatPlanMoney(PLAN_MONTHLY_PRICE)}/mo) or Annual (${formatPlanMoney(PLAN_ANNUAL_PRICE)}/yr, save ${formatPlanMoney(saved)} vs paying monthly).\n\nBilling is not connected in this preview, so this screen cannot unlock it.`,
        { plans: true }
    );
}

function scrollToPlans() {
    const card = $("subscription-card");
    if (!card) return;
    card.hidden = false;
    card.style.display = "block";
    card.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderPlanCopy() {
    $("plan-monthly-price").textContent = `${formatPlanMoney(PLAN_MONTHLY_PRICE)} / month`;
    $("plan-annual-price").textContent = `${formatPlanMoney(PLAN_ANNUAL_PRICE)} / year`;
    const savingsEl = $("plan-annual-savings");
    if (savingsEl) savingsEl.textContent = "Billed once a year.";
    const disclosure = $("paywall-disclosure");
    if (disclosure && !disclosure.dataset.filled) {
        disclosure.dataset.filled = "1";
    }
    if ($("paywall-disclosure-text")) $("paywall-disclosure-text").textContent = D7;
}

function explainTicketImport() {
    showDialog("Coming soon", "Photos are not read. Nothing is checked against a state database.");
}

function explainCheckout() {
    const agreed = $("renewal-agree") && $("renewal-agree").checked;
    const note = $("checkout-note");
    if (!agreed) {
        if (note) note.textContent = "Check the agreement box before subscribe. Nothing was charged.";
        return;
    }
    if (note) {
        note.textContent = "Nothing was charged. App Store and Google Play billing is not connected, so this preview cannot sell a subscription or unlock features.";
        note.focus();
    }
}

function syncSubscribeButtons() {
    const agreed = Boolean($("renewal-agree") && $("renewal-agree").checked);
    ["checkout-monthly", "checkout-annual"].forEach((id) => {
        const button = $(id);
        if (button) button.disabled = !agreed;
    });
}

function manageSubscription() {
    // TODO: The cancel link must be chosen by platform once billing is connected.
    if (isSubscribed() && STORE_SUBSCRIPTION_URLS.apple) {
        window.open(STORE_SUBSCRIPTION_URLS.apple, "_blank", "noopener");
        return;
    }
    showDialog(
        "Manage or cancel",
        "Billing is not connected, so this Account screen cannot open a store subscription page. When a subscription exists, cancel it in Settings > your name > Subscriptions, or in Google Play > Payments & subscriptions > Subscriptions."
    );
}

function setSyncStatus(label, mode) {
    const statusEl = $("sync-status");
    if (!statusEl) return;
    statusEl.textContent = label;
    const tone = mode === "loaded"
        ? "text-emerald-300 border-emerald-500/50"
        : mode === "loading"
            ? "text-yellow-300 border-yellow-500/40"
            : "text-amber-200 border-amber-500/50";
    statusEl.className = `text-[10px] px-1.5 py-0.5 rounded bg-[#070b19] border whitespace-nowrap ${tone}`;
}

function setDataBanner(message, tone) {
    const banner = $("data-banner");
    if (!banner) return;
    banner.textContent = message;
    const loadingLogo = $("loading-logo");
    if (loadingLogo) loadingLogo.hidden = message !== "Loading draws…";
    banner.className = tone === "calm"
        ? "rounded-lg border border-slate-600 bg-[#0b132b] p-3 text-xs text-slate-200"
        : "rounded-lg border border-amber-400/70 bg-amber-950 p-3 text-xs text-amber-50";
}

function updateHistoryNote() {
    const note = $("history-data-note");
    if (!note) return;
    note.textContent = "This is your own saved list. It is not a leaderboard.";
}

const HISTORY_STAT_IDS = [
    "stat-hits",
    "stat-percentage",
    "stat-last-seen",
    "stat-markov",
    "stat-interval",
    "stat-density",
    "stat-expected"
];

function refreshHistoryAvailability(now = new Date()) {
    if (state.dataMode === "loading") {
        state.historyAvailable = false;
        state.resultsLabeled = false;
        return;
    }
    const status = historyStatus({
        game: state.activeGameKey,
        newest: state.fetchFailed ? null : (state.cachedDraws[0] || null),
        now,
        verified: DATA_VERIFIED[state.activeGameKey] === true,
        fetchFailed: state.fetchFailed || !state.cachedDraws[0]
    });
    state.historyAvailable = status.available;
    state.resultsLabeled = status.available;
}

function setHistoryStatsUnavailable() {
    HISTORY_STAT_IDS.forEach((id) => {
        const el = $(id);
        if (el) el.textContent = DATA_UNAVAILABLE;
    });
    const title = $("inspector-title");
    if (title) title.textContent = DATA_UNAVAILABLE;
}

function updateResultsDisclosure() {
    refreshHistoryAvailability();
    const newest = state.cachedDraws[0];
    const stamp = state.historyAvailable ? officialDrawInstant(state.activeGameKey, newest) : null;
    const line = stamp ? d6Line(formatAsOfEt(stamp)) : "";
    ["results-source", "history-source"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.hidden = !stamp;
        el.textContent = line;
    });
    const results = $("heatmap-results");
    const hiddenNote = $("results-hidden-note");
    const unavailable = $("history-unavailable");
    const showStats = state.historyAvailable;
    if (results) results.hidden = !showStats;
    if (unavailable) unavailable.hidden = state.dataMode === "loading" || showStats;
    if (hiddenNote) {
        hiddenNote.hidden = true;
        hiddenNote.textContent = "";
    }
    if (!showStats && state.dataMode !== "loading") setHistoryStatsUnavailable();
    const daily = $("quickdraw-daily-note");
    if (daily) daily.hidden = state.activeGameKey !== "quickdraw";
    renderDrawSchedule();
    updateLedgerUI();
}

function formatRate(rate) {
    if (typeof rate !== "number" || !Number.isFinite(rate)) return "n/a";
    return `${(rate * 100).toFixed(1)}%`;
}

function lastUpdatedLine(draw) {
    const instant = officialDrawInstant(state.activeGameKey, draw);
    if (!instant) return "Last updated —";
    return `Last updated ${formatAsOfEt(instant)}`;
}

function projectActiveDraw(now = new Date()) {
    return projectNextDraw({
        game: state.activeGameKey,
        newest: state.cachedDraws[0] || null,
        previous: state.cachedDraws[1] || null,
        now
    });
}

function weeklyDrawLabel(draws) {
    if (!draws || draws.length === 0) return "";
    const first = formatScheduledDraw(draws[0]);
    if (draws.length === 1) return first;
    const last = formatScheduledDraw(draws[draws.length - 1]);
    return `${first} – ${last} (${draws.length} games)`;
}

function renderDrawSchedule(now = new Date()) {
    const weekly = state.activeGameKey !== "quickdraw";
    const projection = projectActiveDraw(now);
    const countdownKnown = typeof projection.countdownSeconds === "number";
    state.countdownSeconds = countdownKnown ? projection.countdownSeconds : null;
    const drawLabel = $("header-draw-label");
    if (drawLabel) {
        drawLabel.textContent = weekly ? "Next draw" : quickDrawNumberLabel(projection.reason);
    }
    const numberEl = $("header-next-draw");
    if (numberEl) {
        if (weekly && projection.nextDrawTime) {
            numberEl.textContent = formatScheduledDraw(projection.nextDrawTime);
            numberEl.title = "Next scheduled draw.";
        } else if (!weekly && projection.showNumber) {
            numberEl.textContent = `#${projection.nextDrawNumber}`;
            numberEl.title = "Next Quick Draw number from the schedule and the newest loaded draw.";
        } else {
            numberEl.textContent = "—";
            numberEl.title = weekly
                ? "Next draw time is unavailable."
                : "Draw number is hidden. The countdown is the next scheduled draw.";
        }
        numberEl.className = weekly
            ? "font-bold text-yellow-300 text-[10px] leading-tight"
            : "font-bold text-yellow-300 text-sm";
    }
    const countdownEl = $("header-countdown");
    if (countdownEl) {
        countdownEl.textContent = countdownKnown ? formatCountdown(projection.countdownSeconds) : "—";
    }
    const expectedEl = $("stat-expected");
    const cfg = GAME_CONFIGS[state.activeGameKey];
    if (expectedEl && cfg && state.historyAvailable) {
        expectedEl.textContent = formatRate(expectedOneStepRepeatRate(cfg.drawnCount, cfg.totalNumbers));
    }
    const newestDraw = state.cachedDraws[0];
    const drawDayEl = $("newest-draw-day");
    if (drawDayEl) drawDayEl.textContent = formatDrawListing(newestDraw, state.activeGameKey);
    const updated = lastUpdatedLine(newestDraw);
    const picksUpdated = $("picks-last-updated");
    if (picksUpdated) picksUpdated.textContent = updated;
    const resultsUpdated = $("results-updated");
    if (resultsUpdated) resultsUpdated.textContent = updated;
    const cardLabel = $("card-draw-label");
    if (cardLabel && state.picksBlockSize && state.lastPicksGame === state.activeGameKey) {
        if (weekly && projection.nextDrawTime) {
            const draws = upcomingWeeklyDraws(state.activeGameKey, now, state.picksBlockSize);
            cardLabel.hidden = false;
            cardLabel.textContent = weeklyDrawLabel(draws);
        } else if (!weekly && projection.showNumber) {
            const start = projection.nextDrawNumber;
            const games = state.picksBlockSize;
            const end = start + games - 1;
            cardLabel.hidden = false;
            const range = games > 1
                ? `#${start} – #${end} (${games} games)`
                : `#${start}`;
            cardLabel.textContent = projection.reason === "projected"
                ? `Next draw # (est.) ${range}`
                : (games > 1 ? `Draws ${range}` : `Draw ${range}`);
        } else {
            cardLabel.hidden = true;
            cardLabel.textContent = "";
        }
    }
    return projection;
}

function getGameCost() {
    const baseWager = parseFloat($("base-wager")?.value) || 1;
    const extraVal = parseInt($("extra-multiplier")?.value, 10) || 1;
    return baseWager * (extraVal === 2 ? 2 : 1);
}

function updateCostDisplay() {
    const games = parseInt($("game-block")?.value, 10) || 1;
    const el = $("calc-cost-display");
    if (el) el.textContent = `$${(getGameCost() * games).toFixed(2)}`;
}

function applyDemoFlags() {
    const photo = document.getElementById("ticket-import-box");
    if (photo) photo.hidden = !DEMO_FLAGS.showTicketPhotoImport;
}

function applyEntitlements() {
    const subscribed = isSubscribed();
    const debug = isDebugMode();
    const switcher = $("dev-tier-switcher");
    const switcherLabel = $("dev-tier-label");
    if (switcherLabel) switcherLabel.hidden = !debug;
    if (switcher && debug) switcher.value = storageGet("draw_buddy_active_tier") || "free";

    const subCard = $("subscription-card");
    const heatmapLockedBanner = $("heatmap-locked-banner");
    const heatmapGridContainer = $("heatmap-grid-container");

    if (!subscribed) {
        if (subCard) {
            subCard.hidden = false;
            subCard.style.display = "block";
        }
        if (heatmapLockedBanner) heatmapLockedBanner.style.display = "block";
        if (heatmapGridContainer) {
            heatmapGridContainer.style.filter = "blur(6px)";
            heatmapGridContainer.inert = true;
        }
    } else {
        if (subCard) {
            subCard.hidden = true;
            subCard.style.display = "none";
        }
        if (heatmapLockedBanner) heatmapLockedBanner.style.display = "none";
        if (heatmapGridContainer) {
            heatmapGridContainer.style.filter = "none";
            heatmapGridContainer.inert = false;
        }
    }
    renderHeatmap();
    applyDemoFlags();
}

function switchTestTier(tier) {
    if (!isDebugMode()) return;
    storageSet("draw_buddy_active_tier", tier);
    applyEntitlements();
}

function setAppState(stateCode) {
    state.currentState = stateCode;
    storageSet("draw_buddy_state", stateCode);
    const badge = $("header-state-badge");
    if (badge) badge.textContent = stateCode;
}

function showHistoryUnavailable(mode) {
    state.cachedDraws = [];
    state.dataMode = mode;
    state.fetchFailed = true;
    state.historyAvailable = false;
    state.resultsLabeled = false;
    state.latestFetchedDraw = null;
    setSyncStatus("Unavailable", "offline");
    setDataBanner(DATA_UNAVAILABLE, "warn");
    renderHeatmap();
    updateResultsDisclosure();
    updateHistoryNote();
}

async function getSupabaseClient() {
    if (state.supabaseClient) return state.supabaseClient;
    const module = await import("../vendor/supabase.js");
    state.supabaseClient = module.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: {
            fetch: (input, init = {}) => fetch(input, { ...init, cache: "no-store" })
        }
    });
    return state.supabaseClient;
}

async function fetchGameHistoryFromSupabase() {
    if (!readAgePass(localStorage)) return;
    const token = ++state.fetchToken;
    const gameKey = state.activeGameKey;

    if (!navigator.onLine) {
        if (state.dataMode === "loaded" && state.cachedDraws.length > 0 && state.historyAvailable) {
            handleOffline();
            return;
        }
        showHistoryUnavailable("offline");
        return;
    }

    state.cachedDraws = [];
    state.dataMode = "loading";
    state.fetchFailed = false;
    state.resultsLabeled = false;
    state.historyAvailable = false;
    setSyncStatus("Loading", "loading");
    setDataBanner("Loading draws…", "calm");
    renderHeatmap();
    updateResultsDisclosure();
    if (!isBrowserSafeSupabaseKey(SUPABASE_PUBLISHABLE_KEY)) {
        showHistoryUnavailable("error");
        return;
    }

    try {
        const client = await getSupabaseClient();
        const table = publicDrawTable(gameKey);
        const { data, error } = await client
            .schema("public")
            .from(table)
            .select("*")
            .order("draw_number", { ascending: false })
            .limit(100);
        if (token !== state.fetchToken || gameKey !== state.activeGameKey) return;
        if (error || !data || data.length === 0) {
            showHistoryUnavailable("error");
            return;
        }
        state.cachedDraws = data;
        state.fetchFailed = false;
        state.dataMode = "loaded";
        state.latestFetchedDraw = parseInt(data[0].draw_number, 10);
        updateResultsDisclosure();
        if (state.historyAvailable) {
            setSyncStatus("Loaded", "loaded");
            setDataBanner("Draw results are labeled as stored by Draw Buddy, with a last-updated time.", "calm");
        } else {
            setSyncStatus("Unavailable", "offline");
            setDataBanner(DATA_UNAVAILABLE, "warn");
        }
        gradePendingTickets();
        renderHeatmap();
        updateHistoryNote();
    } catch {
        if (token !== state.fetchToken) return;
        state.supabaseClient = null;
        showHistoryUnavailable("error");
    }
}

function handleOffline() {
    if (state.dataMode === "loaded" && state.historyAvailable) {
        setSyncStatus("Offline", "offline");
        setDataBanner("You are offline. Showing the last draws loaded in this session. They will not refresh.", "warn");
        return;
    }
    showHistoryUnavailable("offline");
}

function gradePendingTickets() {
    if (!(state.dataMode === "loaded" && state.activeGameKey === "quickdraw" && state.resultsLabeled)) return;
    const draws = state.cachedDraws.filter((draw) => draw && draw.created_at);
    const updated = gradeTickets(state.sessionTickets, draws);
    if (updated) {
        saveHistoryArchive();
        updateLedgerUI();
    }
}

function inspectNumber(num) {
    if (!state.historyAvailable) {
        setHistoryStatsUnavailable();
        return;
    }
    if (!isSubscribed()) {
        showLocked("Heatmap detail");
        return;
    }
    const cfg = GAME_CONFIGS[state.activeGameKey];
    const lookbackSize = Math.min(parseInt($("lookback-draws").value, 10) || 50, state.cachedDraws.length || 0);
    const sliceData = state.cachedDraws.slice(0, lookbackSize);
    let hits = 0;
    let lastSeenDistance = null;
    sliceData.forEach((draw, index) => {
        const winning = (draw.winning_numbers || []).map(Number);
        if (winning.includes(num)) {
            hits += 1;
            if (lastSeenDistance === null) lastSeenDistance = index;
        }
    });
    const denominator = lookbackSize || 1;
    const percentage = lookbackSize > 0 ? ((hits / lookbackSize) * 100).toFixed(1) : "0.0";
    const repeat = oneStepRepeatRate(sliceData, num);
    const meanCycleInterval = hits > 0 ? (lookbackSize / hits).toFixed(1) : lookbackSize.toFixed(1);
    const expected = lookbackSize * (cfg.drawnCount / cfg.totalNumbers);
    const ratio = expected > 0 ? hits / expected : 0;
    let density = "No hits in this window";
    if (hits > 0 && ratio >= 1.25) density = "Above average count";
    else if (hits > 0 && ratio <= 0.75) density = "Below average count";
    else if (hits > 0) density = "Near average count";

    $("inspector-ball-badge").textContent = num < 10 ? `0${num}` : String(num);
    $("inspector-title").textContent = lookbackSize > 0
        ? `Number ${num} in the last ${lookbackSize} loaded draws`
        : `Number ${num}`;
    $("stat-hits").textContent = `${hits} / ${lookbackSize} draws`;
    $("stat-percentage").textContent = `${percentage}%`;
    $("stat-last-seen").textContent = lastSeenDistance === null
        ? "Not in this window"
        : lastSeenDistance === 0
            ? "Newest loaded draw"
            : `${lastSeenDistance} draws before the newest`;
    $("stat-markov").textContent = repeat === null ? "n/a" : formatRate(repeat);
    const expectedEl = $("stat-expected");
    if (expectedEl) expectedEl.textContent = formatRate(expectedOneStepRepeatRate(cfg.drawnCount, cfg.totalNumbers));
    $("stat-interval").textContent = `~${meanCycleInterval} draws`;
    $("stat-density").textContent = density;
    $("inspector-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderHeatmap() {
    const cfg = GAME_CONFIGS[state.activeGameKey];
    if (!state.historyAvailable) {
        const grid = $("heatmap-grid");
        if (grid) grid.replaceChildren();
        setHistoryStatsUnavailable();
        return;
    }
    const lookbackSize = parseInt($("lookback-draws")?.value, 10) || 50;
    const sliceData = state.cachedDraws.slice(0, lookbackSize);
    const freq = {};
    for (let i = 1; i <= cfg.totalNumbers; i++) freq[i] = 0;
    sliceData.forEach((draw) => {
        (draw.winning_numbers || []).forEach((number) => {
            const value = Number(number);
            if (freq[value] !== undefined) freq[value] += 1;
        });
    });
    const counts = Object.values(freq);
    const maxCount = Math.max(...counts, 0);
    const minCount = Math.min(...counts, 0);
    const span = maxCount - minCount;
    const grid = $("heatmap-grid");
    if (!grid) return;
    grid.replaceChildren();
    for (let i = 1; i <= cfg.totalNumbers; i++) {
        const count = freq[i] || 0;
        const cell = document.createElement("button");
        cell.type = "button";
        const intensity = span > 0 ? (count - minCount) / span : 0.45;
        const lightness = 84 - intensity * 50;
        cell.className = "heatmap-cell font-semibold";
        cell.style.backgroundColor = `hsl(217 72% ${lightness}%)`;
        cell.style.color = lightness < 58 ? "#f8fafc" : "#0b132b";
        cell.addEventListener("click", () => inspectNumber(i));
        cell.setAttribute("aria-label", `Number ${i}, seen ${count} times in the loaded window`);
        const label = document.createElement("span");
        label.className = "text-sm font-black";
        label.textContent = i < 10 ? `0${i}` : String(i);
        const meta = document.createElement("span");
        meta.className = "text-[10px] opacity-90 font-mono";
        meta.textContent = `x${count}`;
        cell.append(label, meta);
        grid.appendChild(cell);
    }
}

function fillSelect(select, values, selected, labelFor) {
    select.replaceChildren();
    values.forEach((value) => {
        const option = document.createElement("option");
        option.value = String(value.value);
        option.textContent = labelFor(value);
        if (String(value.value) === String(selected)) option.selected = true;
        select.appendChild(option);
    });
}

async function switchGameProfile(gameKey) {
    state.activeGameKey = gameKey;
    const cfg = GAME_CONFIGS[gameKey];
    ["quickdraw", "powerball", "megamillions"].forEach((key) => {
        const button = $(`game-btn-${key}`);
        if (!button) return;
        const on = key === gameKey;
        button.className = on ? GAME_BUTTON_ON : GAME_BUTTON_OFF;
        button.setAttribute("aria-pressed", on ? "true" : "false");
    });

    const engineModeEl = $("header-engine-mode");
    if (engineModeEl) engineModeEl.textContent = cfg.shortName;
    const drawLabel = $("header-draw-label");
    const drawBox = $("header-draw-box");
    const extraBox = $("multiplier-container");
    if (drawBox) drawBox.style.display = "block";
    if (drawLabel) drawLabel.textContent = "Next draw #";
    const expectedEl = $("stat-expected");
    if (expectedEl) expectedEl.textContent = formatRate(expectedOneStepRepeatRate(cfg.drawnCount, cfg.totalNumbers));
    const observedEl = $("stat-markov");
    if (observedEl) observedEl.textContent = "n/a";
    state.cachedDraws = [];
    state.latestFetchedDraw = null;
    state.dataMode = "loading";
    state.fetchFailed = false;
    state.historyAvailable = false;
    state.picksBlockSize = null;
    const playCard = $("play-card");
    if (playCard) playCard.classList.add("hidden");

    const lookbackSelect = $("lookback-draws");
    if (gameKey === "quickdraw") {
        fillSelect(lookbackSelect, [{ value: 20 }, { value: 50 }, { value: 100 }], 50, (item) => String(item.value));
        $("multiplier-label").textContent = "Extra";
        if (extraBox) extraBox.hidden = false;
    } else if (gameKey === "powerball") {
        fillSelect(lookbackSelect, [{ value: 50 }, { value: 100 }], 100, (item) => String(item.value));
        $("multiplier-label").textContent = "Power Play";
        if (extraBox) extraBox.hidden = false;
    } else {
        fillSelect(lookbackSelect, [{ value: 50 }, { value: 100 }], 100, (item) => String(item.value));
        if (extraBox) extraBox.hidden = true;
        const extra = $("extra-multiplier");
        if (extra) extra.value = "1";
    }

    const spotSelect = $("spot-tier");
    if (gameKey === "quickdraw") {
        const spots = [];
        for (let i = 1; i <= 10; i++) spots.push({ value: i });
        fillSelect(spotSelect, spots, 4, (item) => String(item.value));
    } else {
        fillSelect(spotSelect, [{ value: 5 }], 5, () => "5");
    }

    const wagerSelect = $("base-wager");
    fillSelect(
        wagerSelect,
        cfg.wagerOptions.map((amount) => ({ value: amount })),
        cfg.defaultWager,
        (item) => `$${item.value}`
    );

    const ledgerSec = $("quickdraw-ledger-section");
    if (ledgerSec) ledgerSec.style.display = gameKey === "quickdraw" ? "block" : "none";

    startTimers();
    await fetchGameHistoryFromSupabase();
    updateCostDisplay();
    applyDemoFlags();
}

function generateTicket(customReason) {
    const cfg = GAME_CONFIGS[state.activeGameKey];
    if (state.cachedDraws.length === 0) {
        showDialog("Draws are not loaded", "Number picks wait until draws have loaded.");
        return;
    }
    const spotTier = parseInt($("spot-tier").value, 10) || cfg.maxSpot;
    const lookback = parseInt($("lookback-draws").value, 10) || 50;
    const baseWager = parseFloat($("base-wager").value) || 1;
    const extraVal = parseInt($("extra-multiplier").value, 10) || 1;
    const hasExtra = state.activeGameKey === "quickdraw" && extraVal === 2;
    const totalBlockSize = parseInt($("game-block").value, 10) || 5;
    const costPerGame = getGameCost();
    const totalSlipCost = costPerGame * totalBlockSize;
    const sliceData = state.cachedDraws.slice(0, lookback);
    let ticket;
    if (!state.historyAvailable) {
        ticket = [];
        while (ticket.length < spotTier) {
            const value = Math.floor(Math.random() * cfg.totalNumbers) + 1;
            if (!ticket.includes(value)) ticket.push(value);
        }
        ticket.sort((a, b) => a - b);
    } else if (!state.resultsLabeled) {
        ticket = [];
        while (ticket.length < spotTier) {
            const value = Math.floor(Math.random() * cfg.totalNumbers) + 1;
            if (!ticket.includes(value)) ticket.push(value);
        }
        ticket.sort((a, b) => a - b);
    } else {
        const scores = {};
        for (let i = 1; i <= cfg.totalNumbers; i++) scores[i] = 0;
        sliceData.forEach((draw, idx) => {
            const recencyWeight = 1 + ((lookback - idx) / lookback) * 0.35;
            (draw.winning_numbers || []).forEach((number) => {
                const value = Number(number);
                if (scores[value] !== undefined) scores[value] += recencyWeight;
            });
        });
        ticket = Object.keys(scores)
            .sort((a, b) => scores[b] - scores[a])
            .map(Number)
            .slice(0, spotTier)
            .sort((a, b) => a - b);
    }
    state.lastGeneratedNumbers = [...ticket];

    let bonusBall = null;
    if (cfg.hasBonus) bonusBall = Math.floor(Math.random() * cfg.bonusTotal) + 1;

    state.picksBlockSize = totalBlockSize;
    state.lastPicksGame = state.activeGameKey;
    renderDrawSchedule();
    const reasonEl = $("card-algorithm-reason");
    if (reasonEl) {
        const bonusNote = cfg.hasBonus ? ` ${cfg.bonusName} is chosen at random.` : "";
        if (!state.historyAvailable) {
            reasonEl.textContent = DATA_UNAVAILABLE;
        } else {
            reasonEl.textContent = state.resultsLabeled
                ? `Stats-based number picks from the last ${Math.min(lookback, sliceData.length)} loaded draws.${bonusNote}`
                : `Random number picks.${bonusNote}`;
            if (customReason && state.resultsLabeled) reasonEl.textContent = `${customReason}${bonusNote}`;
        }
    }

    $("slip-spot-box").textContent = `${spotTier}-SPOT`;
    $("slip-wager-box").textContent = `$${baseWager}`;
    $("slip-extra-box").textContent = hasExtra ? "YES" : "NO";
    $("slip-games-box").textContent = `${totalBlockSize}`;
    $("card-total-slip-cost").textContent = `$${totalSlipCost.toFixed(2)}`;
    $("card-cost-label").textContent = `$${costPerGame.toFixed(2)}/gm × ${totalBlockSize} ${totalBlockSize === 1 ? "gm" : "gms"} = $${totalSlipCost.toFixed(2)}`;

    const grid = $("number-grid");
    grid.replaceChildren();
    ticket.forEach((number) => {
        const ball = document.createElement("div");
        ball.className = "number-ball ball-active";
        ball.textContent = number < 10 ? `0${number}` : String(number);
        grid.appendChild(ball);
    });
    if (bonusBall !== null) {
        const ball = document.createElement("div");
        ball.className = "number-ball ball-bonus";
        ball.textContent = bonusBall < 10 ? `0${bonusBall}` : String(bonusBall);
        ball.title = `${cfg.bonusName}, chosen at random`;
        grid.appendChild(ball);
    }
    $("play-card").classList.remove("hidden");
    $("play-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function saveTicketLocally() {
    if (state.lastGeneratedNumbers.length === 0) {
        showDialog("No picks yet", "Make number picks before saving them.");
        return;
    }
    const projection = projectActiveDraw();
    const weeklySave = state.activeGameKey !== "quickdraw";
    const upcoming = weeklySave && projection.nextDrawTime
        ? upcomingWeeklyDraws(state.activeGameKey, new Date(), parseInt($("game-block").value, 10) || 5)
        : [];
    const startDrawNum = !weeklySave && projection.showNumber ? projection.nextDrawNumber : null;
    const spotTier = parseInt($("spot-tier").value, 10) || 4;
    const baseWager = parseFloat($("base-wager").value) || 1;
    const hasExtra = (parseInt($("extra-multiplier").value, 10) || 1) === 2;
    const numGames = parseInt($("game-block").value, 10) || 5;
    const endDrawNum = startDrawNum === null ? null : startDrawNum + numGames - 1;
    const costPerGame = getGameCost();
    state.sessionTickets.unshift({
        draw: startDrawNum,
        endDraw: endDrawNum,
        drawTime: upcoming[0] ? upcoming[0].toISOString() : null,
        endDrawTime: upcoming.length ? upcoming[upcoming.length - 1].toISOString() : null,
        spot: spotTier,
        games: numGames,
        game: state.activeGameKey,
        wager: costPerGame * numGames,
        costPerGame,
        baseWager,
        hasExtra,
        numbers: [...state.lastGeneratedNumbers],
        gradedDraws: [],
        bestHits: 0,
        winningGamesCount: 0,
        hits: "Pending",
        payout: 0,
        timestamp: new Date().toISOString()
    });
    const saved = saveHistoryArchive();
    gradePendingTickets();
    updateLedgerUI();
    renderDrawSchedule();
    if (!saved) {
        showDialog("Saved in this tab only", "This browser did not keep these picks in local storage.");
    }
    generateTicket();
}

function updateLedgerUI() {
    let totalWager = 0;
    state.sessionTickets.forEach((ticket) => {
        totalWager += parseFloat(ticket.wager) || 0;
    });
    const wagerEl = $("archive-total-wager");
    if (wagerEl) wagerEl.textContent = `$${totalWager.toFixed(2)}`;

    const body = $("ledger-body");
    body.replaceChildren();
    if (state.sessionTickets.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 3;
        cell.className = "text-center text-blue-200 py-3";
        cell.textContent = "No saved picks on this device yet.";
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    state.sessionTickets.forEach((ticket) => {
        const games = ticket.games || 1;
        const endDraw = ticket.endDraw || ticket.draw;
        const drawKnown = Number.isFinite(Number(ticket.draw));
        let drawLabel = "—";
        if (ticket.game && ticket.game !== "quickdraw") {
            if (ticket.drawTime) {
                const startWhen = formatScheduledDraw(new Date(ticket.drawTime));
                const endWhen = ticket.endDrawTime ? formatScheduledDraw(new Date(ticket.endDrawTime)) : startWhen;
                drawLabel = games > 1 && endWhen !== startWhen ? `${startWhen} – ${endWhen}` : startWhen;
            }
        } else if (drawKnown) {
            drawLabel = games > 1 ? `#${ticket.draw}–#${endDraw}` : `#${ticket.draw}`;
        }
        const row = document.createElement("tr");
        row.className = "border-b border-slate-800";
        const progress = (state.dataMode === "loaded" && state.activeGameKey === "quickdraw" && state.resultsLabeled)
            ? (ticket.hits || "Pending")
            : "Not graded";
        [drawLabel, `${ticket.spot}-Spot`, progress].forEach((text, idx) => {
            const cell = document.createElement("td");
            cell.className = idx === 2 ? "py-2 text-cyan-200" : "py-2 text-blue-100";
            cell.textContent = text;
            row.appendChild(cell);
        });
        body.appendChild(row);
    });
}

function loadHistoryArchive() {
    const saved = storageGet("draw_buddy_pl_archive");
    if (saved) {
        try {
            state.sessionTickets = JSON.parse(saved);
        } catch {
            state.sessionTickets = [];
        }
    }
    updateLedgerUI();
}

function saveHistoryArchive() {
    return storageSet("draw_buddy_pl_archive", JSON.stringify(state.sessionTickets));
}

function clearHistoryArchive() {
    if (!confirm("Clear the picks saved on this device?")) return;
    state.sessionTickets = [];
    storageRemove("draw_buddy_pl_archive");
    updateLedgerUI();
}

function exportHistoryCsv() {
    if (state.sessionTickets.length === 0) {
        showDialog("Nothing to export", "No saved picks on this device yet.");
        return;
    }
    const nowISO = new Date().toISOString();
    const dateOnly = nowISO.split("T")[0];
    const csvRows = [[
        "Timestamp_ISO", "Date", "Game_Engine", "Draw_Range", "Spot_or_Type", "Games_Count", "Logged_Cost", "Hit_Status"
    ].join(",")];
    state.sessionTickets.forEach((ticket) => {
        const cost = parseFloat(ticket.wager || 0).toFixed(2);
        const gamesCount = ticket.games || 1;
        const endDraw = ticket.endDraw || (Number(ticket.draw) + gamesCount - 1);
        const drawKnown = Number.isFinite(Number(ticket.draw));
        let rangeLabel = "";
        if (ticket.game && ticket.game !== "quickdraw" && ticket.drawTime) {
            const startWhen = formatScheduledDraw(new Date(ticket.drawTime));
            const endWhen = ticket.endDrawTime ? formatScheduledDraw(new Date(ticket.endDrawTime)) : startWhen;
            rangeLabel = gamesCount > 1 && endWhen !== startWhen ? `${startWhen} – ${endWhen}` : startWhen;
        } else if (drawKnown) {
            rangeLabel = gamesCount > 1 ? `#${ticket.draw}-#${endDraw}` : `#${ticket.draw}`;
        }
        const gameName = GAME_CONFIGS[ticket.game] ? GAME_CONFIGS[ticket.game].name : GAME_CONFIGS[state.activeGameKey].name;
        csvRows.push([
            ticket.timestamp || nowISO,
            (ticket.timestamp || nowISO).split("T")[0],
            `"${gameName}"`,
            `"${rangeLabel}"`,
            `"${ticket.spot}-Spot"`,
            gamesCount,
            cost,
            `"${ticket.hits || ""}"`
        ].join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DrawBuddy_History_${dateOnly}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function startTimers() {
    if (window.drawBuddyTimer) clearInterval(window.drawBuddyTimer);
    if (window.drawBuddyRefreshTimer) clearInterval(window.drawBuddyRefreshTimer);
    window.drawBuddyTimer = setInterval(() => {
        const before = state.historyAvailable;
        refreshHistoryAvailability();
        if (state.dataMode !== "loading" && before !== state.historyAvailable) {
            updateResultsDisclosure();
            if (!state.historyAvailable) {
                setSyncStatus("Unavailable", "offline");
                setDataBanner(DATA_UNAVAILABLE, "warn");
                renderHeatmap();
            }
            return;
        }
        renderDrawSchedule();
    }, 1000);
    // Background refresh stays on the Quick Draw cadence. The visible countdown
    // is computed from the clock, so this interval does not drive that number.
    window.drawBuddyRefreshTimer = setInterval(() => {
        if (state.activeGameKey === "quickdraw") fetchGameHistoryFromSupabase();
    }, 4 * 60 * 1000);
    renderDrawSchedule();
}

function bindUi() {
    $("game-btn-quickdraw").addEventListener("click", () => switchGameProfile("quickdraw"));
    $("game-btn-powerball").addEventListener("click", () => switchGameProfile("powerball"));
    $("game-btn-megamillions").addEventListener("click", () => switchGameProfile("megamillions"));
    $("dev-tier-switcher").addEventListener("change", (event) => switchTestTier(event.target.value));
    $("picks-button").addEventListener("click", () => generateTicket());
    const agreement = $("renewal-agree");
    if (agreement) agreement.addEventListener("change", syncSubscribeButtons);
    syncSubscribeButtons();
    const manage = $("manage-subscription");
    if (manage) manage.addEventListener("click", manageSubscription);
    const noticeStatus = $("notice-hooks");
    if (noticeStatus) {
        const trialDue = trialEndingReminderDue(7);
        const annualDue = annualRenewalNoticeDue(30);
        noticeStatus.textContent = trialDue || annualDue
            ? "A billing notice is due."
            : "Trial-ending and annual renewal notices are not sent. Billing is not connected.";
    }
    $("save-slip-button").addEventListener("click", saveTicketLocally);
    const ticketImport = $("ticket-import-button");
    if (ticketImport) ticketImport.addEventListener("click", explainTicketImport);
    $("export-button").addEventListener("click", exportHistoryCsv);
    $("clear-history-button").addEventListener("click", clearHistoryArchive);
    $("checkout-monthly").addEventListener("click", explainCheckout);
    $("checkout-annual").addEventListener("click", explainCheckout);
    document.querySelectorAll("[data-scroll-plans]").forEach((button) => {
        button.addEventListener("click", scrollToPlans);
    });
    ["base-wager", "extra-multiplier", "game-block", "spot-tier"].forEach((id) => {
        $(id).addEventListener("change", () => {
            updateCostDisplay();
        });
    });
    $("lookback-draws").addEventListener("change", () => {
        renderHeatmap();
    });
    $("info-dialog-close").addEventListener("click", () => $("info-dialog").close());
    $("info-dialog-plans").addEventListener("click", () => {
        $("info-dialog").close();
        scrollToPlans();
    });
}

function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => {
        /* The page still works if the worker does not install. */
    });
}

function bootApp() {
    applyDemoFlags();
    bindUi();
    applyEntitlements();
    setAppState(state.currentState);
    loadHistoryArchive();
    startTimers();
    updateCostDisplay();
    updateHistoryNote();
    fetchGameHistoryFromSupabase();
    registerServiceWorker();
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", () => {
        fetchGameHistoryFromSupabase();
    });
}

function init() {
    renderPlanCopy();
    startSiteGate({ onAccessGranted: bootApp });
}

init();
