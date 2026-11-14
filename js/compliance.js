import { LEGAL_ENTITY, NOTICE_DATES } from "./config.js";
import {
    AGE_PASS_KEY,
    classifyDob,
    clearAgePass,
    readAgePass,
    writeAgePass
} from "./age.js";
import {
    advertisingAllowed,
    blankChoices,
    buildConsentRecord,
    readActiveConsent,
    readGpc,
    writeConsent
} from "./consent.js";
import {
    installPixelScaffolds,
    pageHasVideo,
    pixelLoadPlan,
    removePixelScaffolds
} from "./pixels.js";

const FAIL_COPY = {
    under13: "Sorry — Draw Buddy is not offered to children under 13.",
    under18: "Sorry — Draw Buddy is for adults 18 and over."
};

const BANNER_TEXT = "We use cookies and similar tools. Some are necessary to run this site and remember your age and privacy choices. We do not use optional analytics or advertising tools right now. If we add any, such as advertising pixels from our marketing partners, they will not load until you choose, and they will be used to show you relevant ads only if you agree. We honor Global Privacy Control (GPC). See our Privacy Policy and Do Not Sell or Share / targeted ads opt-out.";

function memoryStorage() {
    const data = new Map();
    return {
        getItem(key) { return data.has(key) ? data.get(key) : null; },
        setItem(key, value) { data.set(key, String(value)); },
        removeItem(key) { data.delete(key); }
    };
}

function browserStorage() {
    try {
        const probe = "__draw_buddy_storage_probe";
        localStorage.setItem(probe, "1");
        localStorage.removeItem(probe);
        return localStorage;
    } catch {
        return memoryStorage();
    }
}

export function fillLegalEntity(root = document) {
    root.querySelectorAll("[data-legal-name]").forEach((node) => {
        node.textContent = LEGAL_ENTITY.name;
    });
    root.querySelectorAll("[data-legal-address]").forEach((node) => {
        node.textContent = LEGAL_ENTITY.postalAddress;
    });
    root.querySelectorAll("[data-legal-email]").forEach((node) => {
        node.textContent = LEGAL_ENTITY.privacyEmail;
        if (node.tagName === "A") node.href = `mailto:${LEGAL_ENTITY.privacyEmail}`;
    });
    root.querySelectorAll("[data-notice-updated]").forEach((node) => {
        node.textContent = NOTICE_DATES.lastUpdated;
    });
    root.querySelectorAll("[data-notice-effective]").forEach((node) => {
        node.textContent = NOTICE_DATES.effective;
    });
}

function sourceUrl() {
    return `${location.origin}${location.pathname}`;
}

function applyPixels() {
    const agePassed = Boolean(readAgePass(browserStorage()));
    const gpc = readGpc();
    const active = readActiveConsent(browserStorage());
    const choices = active ? active.choices : blankChoices();
    const plan = pixelLoadPlan({
        agePassed,
        choices,
        gpc,
        hasVideo: pageHasVideo(document)
    });
    removePixelScaffolds(document);
    if (plan.reason === "allowed") installPixelScaffolds(document, plan);
    return { plan, gpc, choices, advertising: advertisingAllowed({ agePassed, choices, gpc }) };
}

function saveChoice(choices, surface) {
    const gpc = readGpc();
    const record = buildConsentRecord({
        choices,
        gpc,
        sourceUrl: sourceUrl(),
        surface
    });
    writeConsent(browserStorage(), record);
    applyPixels();
    return record;
}

function statusMessage(record) {
    if (readGpc()) {
        return "Global Privacy Control is on. Optional analytics and advertising tracking stay off in this browser. That choice cannot recall data that was already sent. No advertising pixel is installed in this preview.";
    }
    if (record.choices.advertising || record.choices.analytics) {
        return "Your choice is saved on this device. Advertising pixels are still not installed, because this preview has no pixel ids and tracking is switched off in configuration.";
    }
    return "Optional analytics and advertising tracking are off in this browser. This does not recall data that was already sent. No advertising pixel is installed in this preview.";
}

function ensureBanner() {
    let banner = document.getElementById("consent-banner");
    if (banner) return banner;
    banner = document.createElement("section");
    banner.id = "consent-banner";
    banner.hidden = true;
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-labelledby", "consent-title");
    banner.innerHTML = `
        <h2 id="consent-title">Privacy choices</h2>
        <div id="consent-summary">
            <p id="consent-copy"></p>
            <p id="consent-gpc-note" hidden></p>
            <div class="consent-actions">
                <button type="button" id="consent-accept">Accept optional tracking</button>
                <button type="button" id="consent-reject">Reject optional tracking</button>
                <button type="button" id="consent-manage">Manage choices</button>
            </div>
        </div>
        <div id="consent-manage-panel" hidden>
            <p>Strictly necessary storage remembers the age-gate pass and these choices. It is always on. Analytics and advertising are optional and start off. Neither tag is installed in this preview.</p>
            <label class="consent-toggle"><input type="checkbox" id="consent-necessary" checked disabled> Strictly necessary (always on)</label>
            <label class="consent-toggle"><input type="checkbox" id="consent-analytics"> Analytics</label>
            <label class="consent-toggle"><input type="checkbox" id="consent-advertising"> Advertising and retargeting pixels</label>
            <div class="consent-actions">
                <button type="button" id="consent-reject-all">Reject all optional</button>
                <button type="button" id="consent-save">Save choices</button>
            </div>
        </div>
        <p id="consent-status" role="status"></p>
    `;
    document.body.appendChild(banner);
    banner.querySelector("#consent-copy").append(bannerCopy());
    banner.querySelector("#consent-accept").addEventListener("click", () => {
        if (readGpc()) {
            const record = saveChoice(blankChoices(), "gpc-blocked-accept");
            showBanner({ manage: false, record, reopen: true });
            return;
        }
        const record = saveChoice({ necessary: true, analytics: true, advertising: true }, "accept");
        hideBanner(record);
    });
    banner.querySelector("#consent-reject").addEventListener("click", () => {
        const record = saveChoice(blankChoices(), "reject");
        hideBanner(record);
    });
    banner.querySelector("#consent-manage").addEventListener("click", () => {
        showBanner({ manage: true });
    });
    banner.querySelector("#consent-reject-all").addEventListener("click", () => {
        const record = saveChoice(blankChoices(), "reject-all");
        hideBanner(record);
    });
    banner.querySelector("#consent-save").addEventListener("click", () => {
        const record = saveChoice({
            necessary: true,
            analytics: banner.querySelector("#consent-analytics").checked,
            advertising: banner.querySelector("#consent-advertising").checked
        }, "manage");
        hideBanner(record);
    });
    return banner;
}

function bannerCopy() {
    const fragment = document.createDocumentFragment();
    const text = BANNER_TEXT;
    const privacyAt = text.indexOf("Privacy Policy");
    const optAt = text.indexOf("Do Not Sell or Share");
    fragment.append(text.slice(0, privacyAt));
    const privacy = document.createElement("a");
    privacy.href = "./privacy.html";
    privacy.textContent = "Privacy Policy";
    fragment.append(privacy);
    fragment.append(text.slice(privacyAt + "Privacy Policy".length, optAt));
    const opt = document.createElement("button");
    opt.type = "button";
    opt.className = "consent-text-button";
    opt.textContent = "Do Not Sell or Share / targeted ads opt-out";
    opt.addEventListener("click", () => optOutNow());
    fragment.append(opt);
    fragment.append(text.slice(optAt + "Do Not Sell or Share / targeted ads opt-out".length));
    return fragment;
}

function showBanner({ manage = false, record = null, reopen = false } = {}) {
    const banner = ensureBanner();
    banner.hidden = false;
    const gpc = readGpc();
    const note = banner.querySelector("#consent-gpc-note");
    const accept = banner.querySelector("#consent-accept");
    note.hidden = !gpc;
    note.textContent = "Global Privacy Control is on. Accept cannot turn optional tracking on.";
    accept.disabled = gpc;
    banner.querySelector("#consent-summary").hidden = manage;
    banner.querySelector("#consent-manage-panel").hidden = !manage;
    const active = record || readActiveConsent(browserStorage());
    if (active && active.choices) {
        banner.querySelector("#consent-analytics").checked = Boolean(active.choices.analytics) && !gpc;
        banner.querySelector("#consent-advertising").checked = Boolean(active.choices.advertising) && !gpc;
    } else {
        banner.querySelector("#consent-analytics").checked = false;
        banner.querySelector("#consent-advertising").checked = false;
    }
    const status = banner.querySelector("#consent-status");
    status.textContent = record ? statusMessage(record) : "";
    if (manage) banner.querySelector("#consent-save").focus();
    else if (reopen) accept.focus();
}

function hideBanner(record) {
    const banner = document.getElementById("consent-banner");
    const footerStatus = document.getElementById("privacy-choice-status");
    const message = statusMessage(record);
    if (footerStatus) footerStatus.textContent = message;
    if (banner) {
        banner.hidden = true;
        banner.querySelector("#consent-status").textContent = message;
    }
}

function optOutNow() {
    const record = saveChoice(blankChoices(), "do-not-sell");
    showBanner({ manage: true, record, reopen: true });
    const footerStatus = document.getElementById("privacy-choice-status");
    if (footerStatus) {
        footerStatus.textContent = statusMessage(record);
        footerStatus.focus();
    }
}

function openChoices() {
    showBanner({ manage: true, reopen: true });
}

const PRE_AGE_TRACKING_NOTE = "Optional tracking is off. Nothing optional loads before the age check.";

function sessionAgeBlocked() {
    try {
        return sessionStorage.getItem("draw_buddy_age_block") === "1";
    } catch {
        return false;
    }
}

function optionalTrackingAllowed() {
    return Boolean(readAgePass(browserStorage())) && !sessionAgeBlocked();
}

function showPreAgeTrackingNote() {
    const footerStatus = document.getElementById("privacy-choice-status");
    if (footerStatus) footerStatus.textContent = PRE_AGE_TRACKING_NOTE;
    document.querySelectorAll("[data-privacy-action='opt-out'], [data-privacy-action='choices']").forEach((node) => {
        node.textContent = PRE_AGE_TRACKING_NOTE;
    });
    const banner = document.getElementById("consent-banner");
    if (banner) banner.hidden = true;
}

function wireFooter() {
    document.querySelectorAll("[data-privacy-action='opt-out']").forEach((node) => {
        node.addEventListener("click", (event) => {
            event.preventDefault();
            if (!optionalTrackingAllowed()) {
                showPreAgeTrackingNote();
                return;
            }
            optOutNow();
        });
    });
    document.querySelectorAll("[data-privacy-action='choices']").forEach((node) => {
        node.addEventListener("click", (event) => {
            event.preventDefault();
            if (!optionalTrackingAllowed()) {
                showPreAgeTrackingNote();
                return;
            }
            openChoices();
        });
    });
    document.querySelectorAll("[data-privacy-action='reset-age']").forEach((node) => {
        node.addEventListener("click", (event) => {
            event.preventDefault();
            clearAgePass(browserStorage());
            location.reload();
        });
    });
}

function showFail(gate, outcome) {
    try {
        sessionStorage.setItem("draw_buddy_age_block", "1");
    } catch {
        /* Private mode can block session storage. The fail screen still shows. */
    }
    const card = gate.querySelector(".age-card") || gate;
    card.replaceChildren();
    const logo = document.createElement("img");
    logo.className = "age-logo";
    logo.src = "./brand/draw-buddy-logo.svg";
    logo.alt = "Draw Buddy. Insert Coin Industries.";
    card.appendChild(logo);
    const title = document.createElement("h2");
    title.id = "age-gate-title";
    title.tabIndex = -1;
    title.textContent = FAIL_COPY[outcome] || FAIL_COPY.under18;
    card.appendChild(title);
    gate.hidden = false;
    document.documentElement.classList.remove("age-cleared");
    const shell = document.getElementById("app-shell");
    const legal = document.getElementById("legal-main");
    if (shell) shell.inert = true;
    if (legal) legal.hidden = true;
    title.focus();
}

function renderAgeForm(gate, onPass) {
    const card = gate.querySelector(".age-card") || gate;
    card.replaceChildren();
    card.innerHTML = `
        <img class="age-logo" src="./brand/draw-buddy-logo.svg" alt="Draw Buddy. Insert Coin Industries.">
        <p class="age-kicker">Age check</p>
        <h2 id="age-gate-title">Draw Buddy is for adults 18 and over</h2>
        <p id="age-gate-note">Draw Buddy is for adults 18 and over. You must be 21 or older to play Quick Draw where alcohol is served. Enter your date of birth to continue. We use your date of birth only to check your age and do not keep the date after that check.</p>
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
        <p class="age-links"><a href="./privacy.html">Privacy notice (draft)</a> · <a href="./terms.html">Terms (draft)</a></p>
    `;
    const month = card.querySelector("#age-month");
    const day = card.querySelector("#age-day");
    const year = card.querySelector("#age-year");
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    months.forEach((name, index) => {
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
        const decision = classifyDob({ year: year.value, month: month.value, day: day.value });
        button.disabled = decision.outcome === "invalid";
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
            showFail(gate, decision.outcome);
            return;
        }
        try {
            sessionStorage.removeItem("draw_buddy_age_block");
        } catch {
            /* Ignore. */
        }
        writeAgePass(browserStorage());
        onPass();
    });
    month.focus();
}

function maybeRecordGpc() {
    if (!readGpc()) return;
    const active = readActiveConsent(browserStorage());
    if (active && active.gpc && !active.choices.advertising && !active.choices.analytics) return;
    saveChoice(blankChoices(), "gpc");
}

export function startSiteGate({ onAccessGranted, ungated = false } = {}) {
    fillLegalEntity(document);
    wireFooter();
    const gate = document.getElementById("age-gate");
    const shell = document.getElementById("app-shell");
    const legal = document.getElementById("legal-main");
    let granted = false;

    function grant() {
        if (granted) return;
        granted = true;
        document.documentElement.classList.add("age-cleared");
        if (gate) gate.hidden = true;
        if (shell) {
            shell.inert = false;
            shell.removeAttribute("aria-hidden");
        }
        if (legal) legal.hidden = false;
        document.body.style.overflow = "";
        maybeRecordGpc();
        applyPixels();
        const active = readActiveConsent(browserStorage());
        if (!active) showBanner();
        else if (readGpc()) {
            const footerStatus = document.getElementById("privacy-choice-status");
            if (footerStatus) footerStatus.textContent = statusMessage(active);
        }
        if (typeof onAccessGranted === "function") onAccessGranted();
    }

    if (ungated) {
        if (gate) gate.hidden = true;
        if (legal) legal.hidden = false;
        document.documentElement.classList.add("age-cleared");
        if (optionalTrackingAllowed()) {
            maybeRecordGpc();
            applyPixels();
            const active = readActiveConsent(browserStorage());
            if (!active) showBanner();
            else if (readGpc()) {
                const footerStatus = document.getElementById("privacy-choice-status");
                if (footerStatus) footerStatus.textContent = statusMessage(active);
            }
        } else {
            showPreAgeTrackingNote();
        }
        return;
    }

    if (sessionAgeBlocked()) {
        if (shell) shell.inert = true;
        if (legal) legal.hidden = true;
        document.documentElement.classList.remove("age-cleared");
        if (gate) showFail(gate, "under18");
        return;
    }

    if (readAgePass(browserStorage())) {
        grant();
        return;
    }
    if (shell) shell.inert = true;
    if (legal) legal.hidden = true;
    document.documentElement.classList.remove("age-cleared");
    if (gate) {
        gate.hidden = false;
        renderAgeForm(gate, grant);
    }
}

export { AGE_PASS_KEY };
