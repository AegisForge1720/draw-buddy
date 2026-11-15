# Questions for Ralph — Scratch Buddy prize logging

Draft only. This preview is not deployed. Nothing in Supabase has been created.

1. **Location data and privacy.** Near me and the optional GPS check-in use the device position only after an in-app prompt and the browser prompt. In this preview the position is not saved except as part of a prize log the person chooses to keep on this device (coordinates, accuracy, and distance to the retailer's published point). What may be stored, at what precision, for how long, and should check-in coordinates be kept at all once a pass/fail is recorded?

2. **User-submitted prize claims and verification.** A log requires the person to confirm they were at that location. Optional GPS check-in can mark it location-confirmed if the device is within 150 meters of the published coordinates and the accuracy is good enough. A ticket photo can mark it photo-attached. Nothing is checked against a state database. How should unverified, location-confirmed, and photo-attached claims be presented, and what counts as verification?

3. **Naming retailers in payout rankings.** Later heat maps and lists would name establishments and show amounts people logged there. Is it acceptable to name retailers in payout rankings or maps built only from user-submitted claims, and what disclosure is required?

4. **The "luck" framing.** Scratch Buddy is framed as a fun, social companion, not a tool for placing wagers or picking a place to play. Official copy should not imply that a machine or venue is "hot," "lucky," or a way to improve a person's chances. Please review the wording.

5. **Age gate.** This preview uses an 18+ gate because that is the New York Lottery purchase age. The arcade rule is 13+. Which age gate should Scratch Buddy keep, and should it differ from Draw Buddy?

6. **Ticket photo privacy.** Photos can show barcodes or serial numbers. This preview stores the photo only in the browser (IndexedDB) and does not upload it. Should photos be blurred or cropped before they are stored or shown, and what should be allowed if a shared store is later approved?
