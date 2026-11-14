# Chat summary — Rugs Creation Workspace (up to 14 Nov 2026)

## Done earlier (4–6 Nov)
- Email Tracker: personal folders, newest-first delegation queue, tablet Send button fix.
- Priya's "courier invoice approved" notice: dashboard only (no SMS/WhatsApp).
- Courier invoice form: buyer code autofill, payment terms removed, tracking banner only for Preeti.
- Courier: Local invoices auto-approved (Supabase `cd_inv_submit`, `rz_courier_notify`).
- Sampling FMS: merchant tracking entry no longer notifies the handler.
- Reimbursement: Print button prints details + every bill (A4, no blank pages, retry if a bill fails, shows who approved).

## Sampling FMS audit (report only, nothing fixed yet)
Serious:
1. Saves overwrite the whole request; two people can erase each other's work.
2. Security: text in a buyer name can run as code; server doesn't check who saves.

Wrong numbers:
3. 17 finished requests never count as completed (counter-room / agency pieces).
4. Requests show "Delayed" on their due date (deadline read as 5:30 AM).
5. "On-time completion rate" counts all completed, even very late ones.
6. Name spelling: employee table misses variants; PD-757/758/767 saved as "Vinay Beniwal" (Viney can't see them, notices go to Vinay).

Workflow holes:
7. Handler can mark completed before acknowledging.
8. Meeting form date defaults to today and can overwrite the promised date.
9. Stuck sample if another was force-completed before the meeting.
10. Can't add Prince as Photo (role missing); no Shade Card person.
11. Shipments/tracking numbers can't be corrected.

Speed:
12. Every tab downloads all samples (~11 MB) every 30 seconds.

Small: tracker "Delivered" only for FedEx; "Decide later" has no follow-up button; former staff still listed; wrong wording ("2-working-day", "24h SLA", "delay alert sent").

Suggested first fixes: 1, then 3–5, then 10.

## Buyer weekly email (Monday 2 PM IST)
- Monday 16 Nov only: no order-status update; buyers get the "order tracking upgrade — bear with us 7–10 days" letter + sample tracking button. Letter goes to every buyer on the list.
- 6 PM IST 16 Nov: a one-time cron (`buyer-weekly-orders-back-on`) turns order updates back on. From 23 Nov it's normal again.
- Server: `buyer-orders-api` got a one-time `notice` setting.

## Email Tracker — Admin "Switch ID"
- Admin panel → 🔁 Switch ID tab: admin opens the tracker as any active user; bar "Back to my ID" returns.
- Switch lasts max 8 hours; Sign out while switched returns to admin.
- Server: new function `rugs-mail-switch` (admin only), column `rm_sessions.switched_by` records who switched.
- Tested in Chrome with made-up users; not tried on the live site.
