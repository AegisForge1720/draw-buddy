import {
    DRAW_BUDDY_CONFIG,
    annualSavings,
    formatPlanMoney,
    isBrowserSafeSupabaseKey
} from "./config.js";
import { readAgePass } from "./age.js";
import { startSiteGate } from "./compliance.js";
import { isSubscribed as entitlementIsSubscribed } from "./entitlement.js";
import { gradeTickets } from "./grading.js";
import {
    kellyFractionForPrizes,
    oneStepRepeatRate,
    quickDrawBaseEv,
    quickDrawOutcomes,
    quickDrawPrizeRate,
    simulateQuickDraw
} from "./odds.js";

const { PLAN_MONTHLY_PRICE, PLAN_ANNUAL_PRICE, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = DRAW_BUDDY_CONFIG;

const GAME_BUTTON_ON = "bg-cyan-600 text-white p-2 rounded-lg font-black text-xs shadow transition text-center";
const GAME_BUTTON_OFF = "bg-[#111c38] text-slate-300 hover:text-white border border-slate-800 p-2 rounded-lg font-bold text-xs transition text-center";

const GAME_CONFIGS = {
    quickdraw: {
        name: "NY Quick Draw",
        shortName: "Quick Draw",
        totalNumbers: 80,
        drawnCount: 20,
        tableName: "quickdraw_history",
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
        tableName: "powerball_history",
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
        tableName: "megamillions_history",
        bonusTotal: 25,
        maxSpot: 5,
        hasBonus: true,
        bonusName: "Mega Ball",
        wagerOptions: [2, 3, 5, 10, 25],
        defaultWager: 2,
        defaultTime: 43200
    }
};

// Sample scratch-off figures. Not a live prize inventory.
const SCRATCH_GAMES_DATABASE = {
    "$50,000 Cashword": { cost: 5, topTotal: 5, topRemaining: 3, odds: "1 in 3.42", roi: "+14.2%", ev: "+$2.15" },
    "$1,000,000 Black Titanium": { cost: 10, topTotal: 3, topRemaining: 2, odds: "1 in 3.12", roi: "+16.8%", ev: "+$4.50" },
    "$5,000,000 Fortune": { cost: 20, topTotal: 4, topRemaining: 1, odds: "1 in 2.85", roi: "+18.5%", ev: "+$9.20" },
    "$10,000,000 Loaded": { cost: 30, topTotal: 2, topRemaining: 2, odds: "1 in 2.64", roi: "+21.4%", ev: "+$14.80" },
    "Set For Life": { cost: 10, topTotal: 6, topRemaining: 4, odds: "1 in 3.50", roi: "+12.1%", ev: "+$1.85" }
};

const scratchGameKeys = Object.keys(SCRATCH_GAMES_DATABASE);

const state = {
    activeGameKey: "quickdraw",
    cachedDraws: [],
    sessionTickets: [],
    scratchTickets: [],
    scratchGameRotationIndex: 0,
    lastGeneratedNumbers: [],
    latestFetchedDraw: null,
    countdownSeconds: 240,
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
    const saved = annualSavings();
    const monthlyYear = PLAN_MONTHLY_PRICE * 12;
    const pct = monthlyYear > 0 ? Math.round((saved / monthlyYear) * 100) : 0;
    $("plan-monthly-price").textContent = `${formatPlanMoney(PLAN_MONTHLY_PRICE)} / mo`;
    $("plan-annual-price").textContent = `${formatPlanMoney(PLAN_ANNUAL_PRICE)} / yr`;
    $("plan-annual-savings").textContent = `Save ${formatPlanMoney(saved)} a year vs monthly (${pct}% off)`;
}

function explainCheckout() {
    const note = $("checkout-note");
    note.textContent = "Nothing was charged. App Store and Google Play billing is not connected, so this preview cannot sell a subscription or unlock features.";
    note.focus();
}

function setSyncStatus(label, mode) {
    const statusEl = $("sync-status");
    if (!statusEl) return;
    statusEl.textContent = label;
    const tone = mode === "live"
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
    banner.className = tone === "calm"
        ? "rounded-lg border border-slate-600 bg-[#0b132b] p-3 text-xs text-slate-200"
        : "rounded-lg border border-amber-400/70 bg-amber-950 p-3 text-xs text-amber-50";
}

function updateHistoryNote() {
    const note = $("history-data-note");
    if (!note) return;
    if (state.dataMode === "live") {
        note.textContent = "Grades compare saved numbers with draws loaded from the configured database. Quick Draw payouts use the in-app prize table, which is not an official quote. Other games are not priced with that table.";
        return;
    }
    note.textContent = "Grades compare saved numbers with sample draws generated on this device. Those results are not official. Quick Draw payouts use the in-app prize table.";
}

function updateNextDrawLabel() {
    const el = $("header-next-draw");
    if (!el || !state.latestFetchedDraw) return;
    const next = state.latestFetchedDraw + 1;
    if (state.dataMode === "live") {
        el.textContent = `#${next}`;
        el.title = "One higher than the newest loaded row. Not an official draw schedule.";
    } else {
        el.textContent = `#${next} sample`;
        el.title = "Sample counter. Not an official draw number.";
    }
}

function formatSignedMoney(amount) {
    const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
    return `${sign}$${Math.abs(amount).toFixed(2)}`;
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

function updateOptimizedRoiBadge() {
    const badge = $("roi-badge");
    const slip = $("slip-roi-box");
    if (state.activeGameKey !== "quickdraw") {
        if (badge) {
            badge.textContent = "Model EV: not estimated";
            badge.title = "This game has no prize table in the app, so expected value is not estimated.";
        }
        if (slip) slip.textContent = "n/a";
        return;
    }
    const spot = parseInt($("spot-tier")?.value, 10) || 4;
    const wager = parseFloat($("base-wager")?.value) || 1;
    const ev = quickDrawBaseEv(spot, wager);
    const roi = ((ev - wager) / wager) * 100;
    const label = `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`;
    if (badge) {
        badge.textContent = `Base model EV: ${label}`;
        badge.title = "Expected return of a base-game Quick Draw ticket from the in-app prize table. Extra is not included. Not an official quote and not a guarantee.";
    }
    if (slip) slip.textContent = label;
}

function applyEntitlements() {
    const subscribed = isSubscribed();
    const debug = isDebugMode();
    const switcher = $("dev-tier-switcher");
    const switcherLabel = $("dev-tier-label");
    if (switcherLabel) switcherLabel.hidden = !debug;
    if (switcher && debug) switcher.value = storageGet("draw_buddy_active_tier") || "free";

    const subCard = $("subscription-card");
    const scratchLocked = $("scratch-locked-overlay");
    const scratchForm = $("scratch-active-form");
    const scratchBadge = $("scratch-pro-badge");
    const clusterProBadge = $("cluster-pro-badge");
    const heatmapLockedBanner = $("heatmap-locked-banner");
    const heatmapGridContainer = $("heatmap-grid-container");

    if (!subscribed) {
        if (subCard) {
            subCard.hidden = false;
            subCard.style.display = "block";
        }
        if (scratchLocked) scratchLocked.style.display = "block";
        if (scratchForm) scratchForm.style.display = "none";
        if (scratchBadge) scratchBadge.textContent = "Subscription";
        if (clusterProBadge) clusterProBadge.textContent = "Subscription";
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
        if (scratchLocked) scratchLocked.style.display = "none";
        if (scratchForm) scratchForm.style.display = "block";
        if (scratchBadge) scratchBadge.textContent = debug ? "Debug: subscribed" : "Subscribed";
        if (clusterProBadge) clusterProBadge.textContent = debug ? "Debug: subscribed" : "Subscribed";
        if (heatmapLockedBanner) heatmapLockedBanner.style.display = "none";
        if (heatmapGridContainer) {
            heatmapGridContainer.style.filter = "none";
            heatmapGridContainer.inert = false;
        }
    }
    renderHeatmap();
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

function generateMockData(count, startDraw) {
    const cfg = GAME_CONFIGS[state.activeGameKey];
    const mock = [];
    for (let i = 0; i < count; i++) {
        const nums = [];
        const pickCount = cfg.drawnCount;
        while (nums.length < pickCount) {
            const value = Math.floor(Math.random() * cfg.totalNumbers) + 1;
            if (!nums.includes(value)) nums.push(value);
        }
        const entry = {
            draw_number: startDraw - i,
            winning_numbers: nums.sort((a, b) => a - b)
        };
        if (cfg.hasBonus) entry.bonus_number = Math.floor(Math.random() * cfg.bonusTotal) + 1;
        mock.push(entry);
    }
    return mock;
}

function useSampleDraws(mode, message) {
    const anchor = state.latestFetchedDraw || 3028800;
    state.cachedDraws = generateMockData(100, anchor);
    state.latestFetchedDraw = anchor;
    state.dataMode = mode;
    setSyncStatus(mode === "offline" ? "Offline" : "Sample", mode);
    setDataBanner(message, "warn");
    updateNextDrawLabel();
    gradePendingTickets();
    renderHeatmap();
    updateHistoryNote();
    updateOptimizedRoiBadge();
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
    const cfg = GAME_CONFIGS[gameKey];

    if (!navigator.onLine) {
        if (state.dataMode === "live" && state.cachedDraws.length > 0) {
            handleOffline();
            return;
        }
        useSampleDraws("offline", "You are offline. Showing sample draws generated on this device, not results from the database.");
        return;
    }

    state.cachedDraws = [];
    state.dataMode = "loading";
    setSyncStatus("Loading", "loading");
    setDataBanner("Loading draws…", "calm");
    renderHeatmap();
    if (!isBrowserSafeSupabaseKey(SUPABASE_PUBLISHABLE_KEY)) {
        useSampleDraws("error", "The database key in the config is missing or is not a publishable key. Showing sample draws.");
        return;
    }

    try {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from(cfg.tableName)
            .select("*")
            .order("draw_number", { ascending: false })
            .limit(100);
        if (token !== state.fetchToken || gameKey !== state.activeGameKey) return;
        if (error || !data || data.length === 0) {
            const reason = error
                ? "Draw history did not load. Showing sample draws generated on this device."
                : "No rows came back for this game. Showing sample draws generated on this device.";
            useSampleDraws("error", reason);
            return;
        }
        state.cachedDraws = data;
        state.dataMode = "live";
        state.latestFetchedDraw = parseInt(data[0].draw_number, 10);
        setSyncStatus("Loaded", "live");
        setDataBanner("Draws loaded from the configured database. They are not marked as an official feed.", "calm");
        updateNextDrawLabel();
        gradePendingTickets();
        renderHeatmap();
        updateHistoryNote();
        updateOptimizedRoiBadge();
    } catch {
        if (token !== state.fetchToken) return;
        state.supabaseClient = null;
        useSampleDraws("error", "Draw history did not load. Showing sample draws generated on this device.");
    }
}

function handleOffline() {
    if (state.dataMode === "live") {
        setSyncStatus("Offline", "offline");
        setDataBanner("You are offline. Showing the last draws loaded in this session. They will not refresh, and they are not a live feed.", "warn");
        return;
    }
    if (state.cachedDraws.length === 0) {
        useSampleDraws("offline", "You are offline. Showing sample draws generated on this device.");
    } else {
        setSyncStatus("Offline", "offline");
        setDataBanner("You are offline. Showing sample draws generated on this device.", "warn");
    }
}

function gradePendingTickets() {
    const updated = gradeTickets(state.sessionTickets, state.cachedDraws);
    if (updated) {
        saveHistoryArchive();
        updateLedgerUI();
    }
}

function selectScratchGame(gameName) {
    const data = SCRATCH_GAMES_DATABASE[gameName];
    if (!data) return;
    $("scratch-game-title-display").textContent = `Sample: ${gameName}`;
    $("scratch-ev-badge").textContent = `Sample EV: ${data.ev}`;
    $("stat-top-prizes").textContent = `${data.topRemaining} / ${data.topTotal}`;
    $("stat-odds").textContent = data.odds;
    $("stat-roi").textContent = data.roi;
    $("scratch-cost").value = data.cost;
    $("scratch-game-selector").value = gameName;
}

function rotateScratchGame() {
    state.scratchGameRotationIndex = (state.scratchGameRotationIndex + 1) % scratchGameKeys.length;
    selectScratchGame(scratchGameKeys[state.scratchGameRotationIndex]);
}

function explainScratchScan() {
    if (!isSubscribed()) {
        showLocked("Scratch-off scan");
        return;
    }
    showDialog(
        "Coming soon",
        "Scanning does not read a barcode, does not choose a game, and does not check any state database. The figures above are sample data."
    );
}

function explainTicketImport() {
    showDialog(
        "Coming soon",
        "Ticket photos are not read. No numbers are imported, and nothing is checked against a state database."
    );
}

function logScratchTicket() {
    if (!isSubscribed()) {
        showLocked("Scratch-off log");
        return;
    }
    const gameName = $("scratch-game-selector").value || "Scratch-off";
    const cost = parseFloat($("scratch-cost").value) || 0;
    const payout = parseFloat($("scratch-payout").value) || 0;
    state.scratchTickets.unshift({
        game: gameName,
        cost,
        payout,
        timestamp: new Date().toISOString()
    });
    if (!saveScratchArchive()) {
        showDialog("Saved in this tab only", "This browser did not keep the scratch-off log in local storage.");
    }
    updateScratchLedgerUI();
    showDialog("Saved on this device", `${gameName} was added to the scratch-off totals on this device. It was not sent to a server.`);
}

function loadScratchArchive() {
    const saved = storageGet("draw_buddy_scratch_archive");
    if (saved) {
        try {
            state.scratchTickets = JSON.parse(saved);
        } catch {
            state.scratchTickets = [];
        }
    }
    updateScratchLedgerUI();
}

function saveScratchArchive() {
    return storageSet("draw_buddy_scratch_archive", JSON.stringify(state.scratchTickets));
}

function updateScratchLedgerUI() {
    let totalSpent = 0;
    let totalWon = 0;
    state.scratchTickets.forEach((ticket) => {
        totalSpent += Number(ticket.cost) || 0;
        totalWon += Number(ticket.payout) || 0;
    });
    const net = totalWon - totalSpent;
    const spentEl = $("scratch-total-spent");
    const wonEl = $("scratch-total-won");
    const netEl = $("scratch-net-pnl");
    if (spentEl) spentEl.textContent = `$${totalSpent.toFixed(2)}`;
    if (wonEl) wonEl.textContent = `$${totalWon.toFixed(2)}`;
    if (netEl) {
        netEl.textContent = formatSignedMoney(net);
        netEl.className = `font-mono font-bold text-xs ${net >= 0 ? "text-yellow-300" : "text-rose-300"}`;
    }
}

function autoOptimizeByLiveCluster() {
    if (!isSubscribed()) {
        showLocked("Cluster spot heuristic");
        return;
    }
    if (state.activeGameKey !== "quickdraw") return;
    if (state.cachedDraws.length === 0) {
        showDialog("Draws are not loaded", "The cluster heuristic needs the draws loaded in the app.");
        return;
    }

    const sampleSize = Math.min(state.cachedDraws.length, 50);
    const recent20 = state.cachedDraws.slice(0, 20);
    const recent50 = state.cachedDraws.slice(0, sampleSize);
    const freq20 = {};
    const freq50 = {};
    for (let i = 1; i <= 80; i++) {
        freq20[i] = 0;
        freq50[i] = 0;
    }
    recent20.forEach((draw) => {
        (draw.winning_numbers || []).forEach((number) => {
            if (freq20[number] !== undefined) freq20[number] += 1;
        });
    });
    recent50.forEach((draw) => {
        (draw.winning_numbers || []).forEach((number) => {
            if (freq50[number] !== undefined) freq50[number] += 1;
        });
    });

    const sorted20 = Object.values(freq20).sort((a, b) => b - a);
    const sorted50 = Object.values(freq50).sort((a, b) => b - a);
    const top3Avg20 = (sorted20[0] + sorted20[1] + sorted20[2]) / 3;
    const top4Avg50 = (sorted50[0] + sorted50[1] + sorted50[2] + sorted50[3]) / 4;
    const top5Avg50 = (sorted50[0] + sorted50[1] + sorted50[2] + sorted50[3] + sorted50[4]) / 5;
    const top10Spread = sorted50[0] - sorted50[9];
    const sampleNote = state.dataMode === "live" ? "" : " Counts are from sample draws.";

    let bestSpot = "4";
    let bestLookback = "50";
    let bestWager = "1";
    let bestExtra = "2";
    let bestBlock = "5";
    let diagSummary = "";

    if (top3Avg20 >= 9.0) {
        bestSpot = "3";
        bestLookback = "20";
        bestWager = "2";
        bestExtra = "2";
        bestBlock = "5";
        diagSummary = `Heuristic. Tight 3-number surge (${(top3Avg20 / 20 * 100).toFixed(0)}% of the last 20 loaded draws). Suggested 3-spot. Wager steps are fixed rules, not a Kelly stake.${sampleNote}`;
    } else if (top4Avg50 >= 18.0) {
        bestSpot = "4";
        bestLookback = "50";
        bestWager = "1";
        bestExtra = "2";
        bestBlock = "5";
        diagSummary = `Heuristic. High 4-number count (${top4Avg50.toFixed(1)} average in the loaded window). Suggested 4-spot. Wager steps are fixed rules, not a Kelly stake.${sampleNote}`;
    } else if (top5Avg50 >= 17.0 && top10Spread <= 3) {
        bestSpot = "5";
        bestLookback = "50";
        bestWager = "1";
        bestExtra = "2";
        bestBlock = "5";
        diagSummary = `Heuristic. Even 5-number counts (${top5Avg50.toFixed(1)} average in the loaded window). Suggested 5-spot. Wager steps are fixed rules, not a Kelly stake.${sampleNote}`;
    } else {
        bestSpot = "10";
        bestLookback = "100";
        bestWager = "2";
        bestExtra = "2";
        bestBlock = "5";
        diagSummary = `Heuristic. Wide spread (${top10Spread} between the 1st and 10th count). Suggested 10-spot. Wager steps are fixed rules, not a Kelly stake.${sampleNote}`;
    }

    $("spot-tier").value = bestSpot;
    if ([...$("lookback-draws").options].some((option) => option.value === bestLookback)) {
        $("lookback-draws").value = bestLookback;
    }
    $("base-wager").value = bestWager;
    $("extra-multiplier").value = bestExtra;
    $("game-block").value = bestBlock;

    const diagEl = $("cluster-diagnostic-text");
    if (diagEl) {
        diagEl.textContent = diagSummary;
        diagEl.className = "text-[11px] text-emerald-300 font-mono text-center pt-1";
    }
    renderHeatmap();
    updateCostDisplay();
    updateOptimizedRoiBadge();
    generateTicket(diagSummary);
}

function autoOptimizeByMarkovKelly() {
    if (!isSubscribed()) {
        showLocked("Markov and Kelly model");
        return;
    }
    const diagEl = $("cluster-diagnostic-text");
    if (diagEl) {
        diagEl.textContent = "Coming soon. This button does not run a Markov or Kelly model and does not change your settings.";
        diagEl.className = "text-[11px] text-amber-200 font-mono text-center pt-1";
    }
    showDialog(
        "Coming soon",
        "The Markov and Kelly button does not fit a model and does not change spot, wager, or games. Kelly for Quick Draw is available from the Kelly card, and it uses the in-app prize table."
    );
}

function updateModelBars() {
    const kellyText = $("kelly-text-sub");
    const mcText = $("mc-text-sub");
    const kellyFill = $("kelly-fill-bar");
    const mcFill = $("mc-fill-bar");
    if (state.activeGameKey !== "quickdraw") {
        if (kellyFill) kellyFill.style.width = "0%";
        if (mcFill) mcFill.style.width = "0%";
        if (kellyText) kellyText.textContent = "Not estimated for this game";
        if (mcText) mcText.textContent = "Not estimated for this game";
        return;
    }
    const spot = parseInt($("spot-tier")?.value, 10) || 4;
    const ev = quickDrawBaseEv(spot, 1);
    const rate = quickDrawPrizeRate(spot);
    const kelly = kellyFractionForPrizes(1, quickDrawOutcomes(spot, 1));
    if (kellyFill) kellyFill.style.width = `${Math.min(100, kelly * 100)}%`;
    if (mcFill) mcFill.style.width = `${Math.min(100, rate * 100)}%`;
    if (kellyText) {
        kellyText.textContent = kelly <= 0
            ? `${spot}-spot Kelly fraction 0 (model EV $${ev.toFixed(2)})`
            : `${spot}-spot Kelly fraction ${(kelly * 100).toFixed(1)}% of bankroll`;
    }
    if (mcText) mcText.textContent = `${spot}-spot prize rate ${(rate * 100).toFixed(1)}%`;
}

function runKellyOptimizerModal() {
    if (!isSubscribed()) {
        showLocked("Kelly sizing");
        return;
    }
    updateModelBars();
    if (state.activeGameKey !== "quickdraw") {
        showDialog("Kelly sizing", "Coming soon for this game. The app does not have a prize table for it, so it does not suggest a stake.");
        return;
    }
    const spot = parseInt($("spot-tier").value, 10) || 4;
    const ev = quickDrawBaseEv(spot, 1);
    const roi = (ev - 1) * 100;
    const kelly = kellyFractionForPrizes(1, quickDrawOutcomes(spot, 1));
    showDialog(
        "Kelly sizing",
        `Base-game model for a ${spot}-spot $1 Quick Draw ticket. Extra is not included.\n\nExpected prize $${ev.toFixed(2)} (${roi >= 0 ? "+" : ""}${roi.toFixed(1)}% versus the $1 cost).\nKelly fraction of bankroll: ${kelly.toFixed(2)}.\n\nA fraction of 0 means the model’s expected prize is below the cost, so it does not suggest a wager. This is not a betting recommendation and not an official prize quote.`
    );
}

function runMonteCarloModal() {
    if (!isSubscribed()) {
        showLocked("Monte Carlo");
        return;
    }
    updateModelBars();
    if (state.activeGameKey !== "quickdraw") {
        showDialog("Monte Carlo", "Coming soon for this game. The app does not have a prize table or a jackpot for it, so it does not run a simulation.");
        return;
    }
    const spot = parseInt($("spot-tier").value, 10) || 4;
    const result = simulateQuickDraw(spot, 10000);
    const exact = quickDrawPrizeRate(spot);
    const simulated = result.sims > 0 ? (result.prizeDraws / result.sims) * 100 : 0;
    showDialog(
        "Monte Carlo",
        `${result.sims.toLocaleString()} simulated $1 base-game tickets, ${spot}-spot. Extra is not included.\n\nSimulated prize rate ${simulated.toFixed(1)}%.\nExact prize rate from the same model ${(exact * 100).toFixed(1)}%.\nMean net per ticket ${formatSignedMoney(result.meanNet)}.\n\nThis uses the in-app prize table. It is not an official quote, and it does not estimate risk of ruin.`
    );
}

function inspectNumber(num) {
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
    $("stat-markov").textContent = repeat === null ? "n/a" : `${(repeat * 100).toFixed(1)}%`;
    $("stat-interval").textContent = `~${meanCycleInterval} draws`;
    $("stat-density").textContent = density;
    updateModelBars();
    $("inspector-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderHeatmap() {
    const cfg = GAME_CONFIGS[state.activeGameKey];
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
    const maxCount = Math.max(...counts, 1);
    const minCount = Math.min(...counts, 0);
    const thresholdRange = maxCount - minCount;
    const scaleFactor = lookbackSize >= 100 ? 0.65 : 0.70;
    const hotCutoff = minCount + (thresholdRange * scaleFactor);
    const medCutoff = minCount + (thresholdRange * (scaleFactor - 0.35));
    const grid = $("heatmap-grid");
    if (!grid) return;
    grid.replaceChildren();
    for (let i = 1; i <= cfg.totalNumbers; i++) {
        const count = freq[i] || 0;
        const cell = document.createElement("button");
        cell.type = "button";
        let bgStyle = "bg-blue-600 text-white font-semibold";
        if (count >= hotCutoff && thresholdRange > 0) bgStyle = "heatmap-hot bg-red-500 text-white font-black";
        else if (count >= medCutoff && thresholdRange > 0) bgStyle = "bg-yellow-500 text-slate-950 font-bold";
        cell.className = `heatmap-cell ${bgStyle}`;
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
    const proClusterBox = $("pro-cluster-box");
    if (gameKey === "quickdraw") {
        if (drawBox) drawBox.style.display = "block";
        if (drawLabel) drawLabel.textContent = "Draw counter";
        if (proClusterBox) proClusterBox.style.display = "block";
        state.countdownSeconds = 240;
    } else {
        if (drawBox) drawBox.style.display = "none";
        if (proClusterBox) proClusterBox.style.display = "none";
        state.countdownSeconds = cfg.defaultTime;
    }

    const lookbackSelect = $("lookback-draws");
    if (gameKey === "quickdraw") {
        fillSelect(lookbackSelect, [{ value: 20 }, { value: 50 }, { value: 100 }], 50, (item) => String(item.value));
        $("multiplier-label").textContent = "Extra";
    } else {
        fillSelect(lookbackSelect, [{ value: 50 }, { value: 100 }], 100, (item) => String(item.value));
        $("multiplier-label").textContent = "Power Play / Megaplier";
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
    updateOptimizedRoiBadge();
    updateModelBars();
}

function generateTicket(customReason) {
    const cfg = GAME_CONFIGS[state.activeGameKey];
    if (state.cachedDraws.length === 0) {
        showDialog("Draws are not loaded", "Number synthesis waits until draws have loaded, so it does not invent a weighted set from an empty list.");
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
    const scores = {};
    for (let i = 1; i <= cfg.totalNumbers; i++) scores[i] = 0;
    sliceData.forEach((draw, idx) => {
        const recencyWeight = 1 + ((lookback - idx) / lookback) * 0.35;
        (draw.winning_numbers || []).forEach((number) => {
            const value = Number(number);
            if (scores[value] !== undefined) scores[value] += recencyWeight;
        });
    });
    const ticket = Object.keys(scores)
        .sort((a, b) => scores[b] - scores[a])
        .map(Number)
        .slice(0, spotTier)
        .sort((a, b) => a - b);
    state.lastGeneratedNumbers = [...ticket];

    let bonusBall = null;
    if (cfg.hasBonus) bonusBall = Math.floor(Math.random() * cfg.bonusTotal) + 1;

    const startDraw = (state.latestFetchedDraw || 0) + 1;
    const endDraw = startDraw + totalBlockSize - 1;
    const drawLabel = $("card-draw-label");
    if (drawLabel) {
        const prefix = state.dataMode === "live" ? "" : "Sample ";
        drawLabel.textContent = totalBlockSize > 1
            ? `${prefix}draws #${startDraw} – #${endDraw} (${totalBlockSize} games)`
            : `${prefix}target draw #${startDraw}`;
    }
    const reasonEl = $("card-algorithm-reason");
    if (reasonEl) {
        const bonusNote = cfg.hasBonus ? ` ${cfg.bonusName} is random, not modeled.` : "";
        const sourceNote = state.dataMode === "live" ? "" : " Built from sample draws.";
        reasonEl.textContent = customReason
            ? `${customReason}${bonusNote}`
            : `White balls are weighted from the last ${Math.min(lookback, sliceData.length)} loaded draws.${bonusNote}${sourceNote}`;
    }

    $("slip-spot-box").textContent = `${spotTier}-SPOT`;
    $("slip-wager-box").textContent = `$${baseWager}`;
    $("slip-extra-box").textContent = hasExtra ? "YES" : "NO";
    $("slip-games-box").textContent = `${totalBlockSize}`;
    updateOptimizedRoiBadge();
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
        showDialog("No slip yet", "Synthesize numbers before saving a slip.");
        return;
    }
    const startDrawNum = (state.latestFetchedDraw || 0) + 1;
    const spotTier = parseInt($("spot-tier").value, 10) || 4;
    const baseWager = parseFloat($("base-wager").value) || 1;
    const hasExtra = (parseInt($("extra-multiplier").value, 10) || 1) === 2;
    const numGames = parseInt($("game-block").value, 10) || 5;
    const endDrawNum = startDrawNum + numGames - 1;
    const costPerGame = getGameCost();
    state.sessionTickets.unshift({
        draw: startDrawNum,
        endDraw: endDrawNum,
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
        hits: numGames > 1 ? `Pending (0/${numGames} gms)` : "Pending",
        payout: 0,
        timestamp: new Date().toISOString()
    });
    const saved = saveHistoryArchive();
    gradePendingTickets();
    updateLedgerUI();
    state.latestFetchedDraw = endDrawNum;
    updateNextDrawLabel();
    if (!saved) {
        showDialog("Saved in this tab only", "This browser did not keep the slip in local storage.");
    }
    generateTicket();
}

function updateLedgerUI() {
    let totalWager = 0;
    let totalPayout = 0;
    state.sessionTickets.forEach((ticket) => {
        totalWager += parseFloat(ticket.wager) || 0;
        totalPayout += parseFloat(ticket.payout) || 0;
    });
    const net = totalPayout - totalWager;
    $("archive-total-wager").textContent = `$${totalWager.toFixed(2)}`;
    $("archive-total-payout").textContent = `$${totalPayout.toFixed(2)}`;
    const netEl = $("archive-net-pnl");
    netEl.textContent = formatSignedMoney(net);
    netEl.className = `font-mono font-bold text-xs ${net >= 0 ? "text-cyan-300" : "text-rose-300"}`;

    const body = $("ledger-body");
    body.replaceChildren();
    if (state.sessionTickets.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 4;
        cell.className = "text-center text-blue-200 py-3";
        cell.textContent = "No slips saved on this device yet.";
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    state.sessionTickets.forEach((ticket) => {
        const games = ticket.games || 1;
        const endDraw = ticket.endDraw || ticket.draw;
        const drawLabel = games > 1 ? `#${ticket.draw}–#${endDraw}` : `#${ticket.draw}`;
        const ticketNet = (parseFloat(ticket.payout) || 0) - (parseFloat(ticket.wager) || 0);
        const row = document.createElement("tr");
        row.className = "border-b border-slate-800";
        [drawLabel, `${ticket.spot}-Spot`, ticket.hits || "Pending", formatSignedMoney(ticketNet)].forEach((text, idx) => {
            const cell = document.createElement("td");
            cell.className = idx === 3
                ? `py-2 text-right font-mono ${ticketNet >= 0 ? "text-emerald-300" : "text-rose-300"}`
                : idx === 2 ? "py-2 text-cyan-200" : "py-2 text-blue-100";
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
    if (!confirm("Clear the slips saved on this device?")) return;
    state.sessionTickets = [];
    storageRemove("draw_buddy_pl_archive");
    updateLedgerUI();
}

function exportHistoryCsv() {
    if (state.sessionTickets.length === 0 && state.scratchTickets.length === 0) {
        showDialog("Nothing to export", "No slips or scratch-off rows are saved on this device yet.");
        return;
    }
    const nowISO = new Date().toISOString();
    const dateOnly = nowISO.split("T")[0];
    const csvRows = [[
        "Timestamp_ISO", "Date", "Game_Engine", "Draw_Range", "Spot_or_Type", "Games_Count", "Wager_Cost", "Payout", "Net_PnL", "Hit_Status"
    ].join(",")];
    state.sessionTickets.forEach((ticket) => {
        const wager = parseFloat(ticket.wager || 0).toFixed(2);
        const payout = parseFloat(ticket.payout || 0).toFixed(2);
        const net = (payout - wager).toFixed(2);
        const gamesCount = ticket.games || 1;
        const endDraw = ticket.endDraw || (ticket.draw + gamesCount - 1);
        const rangeLabel = gamesCount > 1 ? `#${ticket.draw}-#${endDraw}` : `#${ticket.draw}`;
        const gameName = GAME_CONFIGS[ticket.game] ? GAME_CONFIGS[ticket.game].name : GAME_CONFIGS[state.activeGameKey].name;
        csvRows.push([
            ticket.timestamp || nowISO,
            (ticket.timestamp || nowISO).split("T")[0],
            `"${gameName}"`,
            `"${rangeLabel}"`,
            `"${ticket.spot}-Spot"`,
            gamesCount,
            wager,
            payout,
            net,
            `"${ticket.hits}"`
        ].join(","));
    });
    state.scratchTickets.forEach((ticket) => {
        const cost = parseFloat(ticket.cost || 0).toFixed(2);
        const payout = parseFloat(ticket.payout || 0).toFixed(2);
        const net = (payout - cost).toFixed(2);
        csvRows.push([
            ticket.timestamp || nowISO,
            (ticket.timestamp || nowISO).split("T")[0],
            "\"NY Scratch-Off\"",
            `"${(ticket.game || "Scratch-Off").replace(/"/g, "\"\"")}"`,
            "\"Instant Ticket\"",
            1,
            cost,
            payout,
            net,
            payout > 0 ? "\"Winner\"" : "\"No Hit\""
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
    window.drawBuddyTimer = setInterval(async () => {
        state.countdownSeconds -= 1;
        if (state.countdownSeconds <= 0) {
            state.countdownSeconds = state.activeGameKey === "quickdraw" ? 240 : GAME_CONFIGS[state.activeGameKey].defaultTime;
            if (state.activeGameKey === "quickdraw") await fetchGameHistoryFromSupabase();
            else renderHeatmap();
        }
        const hrs = Math.floor(state.countdownSeconds / 3600);
        const mins = Math.floor((state.countdownSeconds % 3600) / 60);
        const secs = state.countdownSeconds % 60;
        const cdEl = $("header-countdown");
        if (!cdEl) return;
        cdEl.textContent = hrs > 0
            ? `${hrs}h ${mins.toString().padStart(2, "0")}m`
            : `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }, 1000);
}

function bindUi() {
    $("game-btn-quickdraw").addEventListener("click", () => switchGameProfile("quickdraw"));
    $("game-btn-powerball").addEventListener("click", () => switchGameProfile("powerball"));
    $("game-btn-megamillions").addEventListener("click", () => switchGameProfile("megamillions"));
    $("dev-tier-switcher").addEventListener("change", (event) => switchTestTier(event.target.value));
    $("cluster-button").addEventListener("click", autoOptimizeByLiveCluster);
    $("markov-button").addEventListener("click", autoOptimizeByMarkovKelly);
    $("synthesize-button").addEventListener("click", () => generateTicket());
    $("save-slip-button").addEventListener("click", saveTicketLocally);
    $("ticket-import-button").addEventListener("click", explainTicketImport);
    $("scratch-rotate").addEventListener("click", rotateScratchGame);
    $("scratch-game-selector").addEventListener("change", (event) => selectScratchGame(event.target.value));
    $("scratch-log-button").addEventListener("click", logScratchTicket);
    $("scratch-scan-button").addEventListener("click", explainScratchScan);
    $("export-button").addEventListener("click", exportHistoryCsv);
    $("clear-history-button").addEventListener("click", clearHistoryArchive);
    $("kelly-card").addEventListener("click", runKellyOptimizerModal);
    $("monte-carlo-card").addEventListener("click", runMonteCarloModal);
    $("checkout-monthly").addEventListener("click", explainCheckout);
    $("checkout-annual").addEventListener("click", explainCheckout);
    document.querySelectorAll("[data-scroll-plans]").forEach((button) => {
        button.addEventListener("click", scrollToPlans);
    });
    ["base-wager", "extra-multiplier", "game-block", "spot-tier"].forEach((id) => {
        $(id).addEventListener("change", () => {
            updateCostDisplay();
            updateOptimizedRoiBadge();
            updateModelBars();
        });
    });
    $("lookback-draws").addEventListener("change", () => {
        renderHeatmap();
        updateOptimizedRoiBadge();
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
    bindUi();
    applyEntitlements();
    setAppState(state.currentState);
    loadScratchArchive();
    loadHistoryArchive();
    selectScratchGame(scratchGameKeys[0]);
    startTimers();
    updateCostDisplay();
    updateOptimizedRoiBadge();
    updateModelBars();
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
