# Scratch Buddy compliance notes

Draft only. This preview is not deployed. Nothing in Supabase has been created.

Ralph reviewed commit `2a5c442` on 15 November 2026 (ET). Memo: `/workspace/legal/scratch_buddy_compliance_review.md`.

Applied in this preview (Ralph's required product changes 2–8 as assigned; numbering below matches that assignment, not every row in the memo's §4 list):

2. GPS check-ins store only pass/fail, the date, and a coarse distance band (`<50 m` or `50-150 m`). Coordinates, accuracy, and exact meters are not kept. The SQL draft no longer has `checkin_lat` / `checkin_lng` or the coords constraint.
3. Ticket photos are re-encoded to strip EXIF. A manual cover or crop step, plus a confirmation that the barcode, validation number, and PIN are covered, is required before a photo is stored. Photos stay on this device. No Storage bucket. A photo is optional on the venue path.
4. Badges read "Self-reported", "GPS check-in near store", and "Photo on this device". Logs and map views include the disclosure that prize logs are not checked against New York Lottery records.
5. The three required house lines are on the app shell, log and map views, and the legal pages, in the exact wording Ralph specified.
6. The Find heading is "Find a licensed retailer". The NY badge is removed. There are no Lottery logos. `js/scratch.js` and its expected-value / ledger helpers were removed.
7. The age gate stays 18+ and uses one failure message: "Sorry — Scratch Buddy is for adults 18 and over."
8. The privacy notice discloses OpenStreetMap tile requests (IP and the area viewed). Leaflet and Tailwind are self-hosted. "Delete all my data" clears the on-device store. Retention: kept until the user deletes them; a future server, if approved, would also drop logs after 24 months of inactivity and would never keep raw location.

Not applied, pending Andrew: Ralph's request to drop or rename the payout heat map, the weights, and the per-store totals (memo §4 item 2). The heat map is unchanged in concept; only the badge labels and disclosure were updated to match item 4.
