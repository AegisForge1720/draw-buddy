import assert from "node:assert/strict";
import test from "node:test";
import {
    D3,
    D7,
    annualRenewalNoticeDue,
    d6Line,
    formatAsOfEt,
    officialResultsStamp,
    trialEndingReminderDue
} from "../js/notices.js";

test("D3 matches the memo and a dated Quick Draw row can carry D6", () => {
    assert.equal(D3, "Lottery drawings are random. Past results don't predict future draws, and Draw Buddy does not improve your chances of winning. For entertainment and information only.");
    const stamp = officialResultsStamp({ created_at: "2026-11-14T02:07:57.211Z" });
    assert.ok(stamp);
    assert.equal(formatAsOfEt(stamp), "November 13, 2026 at 9:07 PM ET");
    assert.equal(officialResultsStamp({ draw_date: "2026-11-09" }), null);
    assert.equal(
        d6Line(formatAsOfEt(stamp)),
        "Source: draw results stored by Draw Buddy, last updated November 13, 2026 at 9:07 PM ET. Not an official lottery feed. Always confirm results with the official lottery before claiming a prize."
    );
    assert.equal(d6Line(formatAsOfEt(stamp)).includes("official New York Lottery results"), false);
});

test("billing notice hooks stay off until enabled", () => {
    assert.equal(trialEndingReminderDue(7), false);
    assert.equal(annualRenewalNoticeDue(30), false);
    assert.equal(trialEndingReminderDue(7, { enabled: true, minDaysBeforeFirstCharge: 3, maxDaysBeforeFirstCharge: 21 }), true);
    assert.equal(trialEndingReminderDue(2, { enabled: true, minDaysBeforeFirstCharge: 3, maxDaysBeforeFirstCharge: 21 }), false);
    assert.equal(annualRenewalNoticeDue(14, { enabled: true, minDaysBeforeRenewal: 15, maxDaysBeforeRenewal: 45 }), false);
    assert.equal(annualRenewalNoticeDue(20, { enabled: true, minDaysBeforeRenewal: 15, maxDaysBeforeRenewal: 45 }), true);
    assert.match(D7, /\$1\.99 per month or \$17 per year/);
    assert.match(D7, /Apple ID or Google Play account/);
});
