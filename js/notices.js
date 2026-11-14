// Exact disclaimer text from the growth-plan memo. Billing hooks do not send anything.

export const D3 = "Lottery drawings are random. Past results don't predict future draws, and Draw Buddy does not improve your chances of winning. For entertainment and information only.";

export const D1_LONG = "Gambling can be addictive. If you or someone you know has a gambling problem, help is available. Call the NY HOPEline at 1-877-8-HOPENY (1-877-846-7369) or text HOPENY (467369).";

export const D2 = "18+ only. You must be 21+ to play Quick Draw where alcohol is served.";

export const D5 = "Draw Buddy does not sell lottery tickets or accept wagers.";

export const RESULT_SOURCES = {
    quickdraw: "New York Lottery",
    powerball: "Powerball",
    megamillions: "Mega Millions"
};

export function officialResultsStamp(draw) {
    if (!draw || typeof draw.created_at !== "string" || draw.created_at.length === 0) return null;
    const date = new Date(draw.created_at);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

export function formatAsOfEt(date) {
    const formatted = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }).format(date);
    return `${formatted} ET`;
}

export function d6Line(asOfEt) {
    return `Source: draw results stored by Draw Buddy, last updated ${asOfEt}. Not an official lottery feed. Always confirm results with the official lottery before claiming a prize.`;
}

export const D7 = "Draw Buddy Premium: $1.99 per month or $17 per year. Your subscription renews automatically at the same price each month or year until you cancel. Payment is charged to your Apple ID or Google Play account. Cancel anytime, at least 24 hours before the end of the current period, in Settings > your name > Subscriptions or Google Play > Payments & subscriptions > Subscriptions, or from Draw Buddy's Account screen.";

export const D9 = "Your Draw Buddy free trial ends on [date]. Unless you cancel before then, you'll be charged $[price] per [month/year] to your [Apple ID / Google Play] account, and it will renew automatically. To cancel: [steps / link].";

export const D10 = "Your Draw Buddy annual plan renews on [date] for $17.00 and will keep renewing every year until you cancel. To cancel: [steps / link]. Questions: [support email].";

// TODO: send D9 only when a trial exists, 3–21 days before the first charge.
// TODO: send D10 15–45 days before an annual renewal.
// Both stay disabled until store billing is connected. Nothing is sent from this file.
export const BILLING_NOTICES = {
    trialEndingReminder: {
        enabled: false,
        minDaysBeforeFirstCharge: 3,
        maxDaysBeforeFirstCharge: 21,
        template: D9
    },
    annualRenewalNotice: {
        enabled: false,
        minDaysBeforeRenewal: 15,
        maxDaysBeforeRenewal: 45,
        template: D10
    }
};

export const STORE_SUBSCRIPTION_URLS = {
    apple: "https://apps.apple.com/account/subscriptions",
    google: "https://play.google.com/store/account/subscriptions?package=app.drawbuddy.player"
};

export function trialEndingReminderDue(daysBeforeCharge, notice = BILLING_NOTICES.trialEndingReminder) {
    if (!notice.enabled) return false;
    return daysBeforeCharge >= notice.minDaysBeforeFirstCharge && daysBeforeCharge <= notice.maxDaysBeforeFirstCharge;
}

export function annualRenewalNoticeDue(daysBeforeRenewal, notice = BILLING_NOTICES.annualRenewalNotice) {
    if (!notice.enabled) return false;
    return daysBeforeRenewal >= notice.minDaysBeforeRenewal && daysBeforeRenewal <= notice.maxDaysBeforeRenewal;
}
