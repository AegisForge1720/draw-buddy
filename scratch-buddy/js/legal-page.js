import { AGE_BLOCK_KEY, classifyDob, readAgePass, writeAgePass } from "./age.js";
import { PRIVACY_MARKUP, TERMS_MARKUP } from "./markup.js";

const FAIL_COPY = {
    under13: "Sorry — Scratch Buddy is not offered to children under 13.",
    under18: "Sorry — Scratch Buddy is for adults 18 and over."
};

function $(id) {
    return document.getElementById(id);
}

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
        /* Private mode can block session storage. */
    }
    const card = $("age-gate").querySelector(".age-card");
    card.replaceChildren();
    const title = document.createElement("h2");
    title.id = "age-gate-title";
    title.tabIndex = -1;
    title.textContent = FAIL_COPY[outcome] || FAIL_COPY.under18;
    card.appendChild(title);
    document.documentElement.classList.remove("age-cleared");
    $("app-shell").inert = true;
    title.focus();
}

function grant(markup) {
    document.documentElement.classList.add("age-cleared");
    $("age-gate").hidden = true;
    const shell = $("app-shell");
    shell.innerHTML = markup;
    shell.inert = false;
}

function renderAgeForm(markup) {
    const card = $("age-gate").querySelector(".age-card");
    card.innerHTML = `
        <p class="age-kicker">Age check</p>
        <h2 id="age-gate-title">Scratch Buddy is for adults 18 and over</h2>
        <p>Enter your date of birth to continue. We use your date of birth only to check your age and do not keep the date after that check.</p>
        <div class="age-dob">
            <label>Month <select id="age-month" autocomplete="off"><option value="">Month</option></select></label>
            <label>Day <select id="age-day" autocomplete="off"><option value="">Day</option></select></label>
            <label>Year <select id="age-year" autocomplete="off"><option value="">Year</option></select></label>
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
        if (!decision.persist) {
            if (decision.outcome !== "invalid") showAgeFail(decision.outcome);
            return;
        }
        writeAgePass(localStorage);
        grant(markup);
    });
}

const page = document.body.dataset.legalPage;
const markup = page === "terms" ? TERMS_MARKUP : PRIVACY_MARKUP;
if (sessionAgeBlocked()) showAgeFail("under18");
else if (readAgePass(localStorage)) grant(markup);
else renderAgeForm(markup);
