# Rugs Creation Workspace — work summary (4–14 Nov 2026)

Live site: rugs-zone.github.io/Workspace (`index.html`, modules stored as base64).
Server: Supabase project `asbgfjngxsabnnzgxugu`. Every change is also logged in `PROGRESS.md`.

## 4–6 Nov
- Email Tracker: personal folders, newest-first delegation queue, tablet Send button fix.
- Priya's "courier invoice approved" notice: dashboard only (no SMS/WhatsApp).
- Courier invoice form: buyer name/code autofill from Buyer master, payment terms removed, tracking banner only for Preeti.
- Courier: Local invoices approved automatically (`cd_inv_submit`, `rz_courier_notify`).
- Sampling FMS: merchant entering tracking no longer notifies the handler.
- Reimbursement: Print button prints details + every bill (A4, no blank pages, retry, shows who approved).

## Sampling FMS audit (14 Nov, report only — nothing fixed yet)
Serious: (1) saves overwrite the whole request, two people can erase each other's work; (2) text in a buyer name can run as code, server doesn't check who saves.
Wrong numbers: (3) 17 finished requests never count as completed (counter-room/agency pieces); (4) "Delayed" shown on the due date (deadline read as 5:30 AM); (5) "On-time rate" counts all completed; (6) name spelling breaks counts; PD-757/758/767 saved as "Vinay Beniwal".
Workflow holes: (7) handler can complete before acknowledging; (8) meeting date defaults to today and can overwrite the promised date; (9) stuck sample after force-complete; (10) no Photo role (Prince), no Shade Card person; (11) shipments can't be corrected.
Speed: (12) every tab downloads all samples (~11 MB) every 30 s.
Suggested first: 1, then 3–5, then 10.

## Buyer weekly email (Mon 2 PM IST)
- Mon 16 Nov only: no order-status update; every buyer gets the "order tracking upgrade — bear with us 7–10 days" letter + sample tracking button.
- 6 PM IST 16 Nov: one-time cron `buyer-weekly-orders-back-on` turns order updates back on. Normal from 23 Nov.

## Rugs Email (Email Tracker) — 14 Nov
- **Switch ID** (Admin panel tab): admin opens the tracker as any active user; "Back to my ID" bar; 8-hour limit (`rugs-mail-switch`, `rm_sessions.switched_by`).
- **Shared lists admin-only**: rules, blocked senders, categories, folders, templates, circulars. Non-admins don't see those menus/buttons. Saving fetches the latest list and merges item by item.
- **Colleague mail = our side**: anyone @rugscreation.com counts as "out"; counterpart = first outside sender. 18,604 threads rebuilt; replied counts per mailbox changed (e.g. teampulse 0 → 687).
- **Automatic mail auto-closed**: no-reply / notification / newsletter / mailer-daemon senders or a List-Unsubscribe header → Done + grey "Auto" category. 2,418 old threads closed.
- **Storage**: long Gmail attachment ids removed after the Drive copy (attachment data 283 MB → 15 MB); Drive errors retried 3×; teamnexus@ / teamshipping@ rows removed. Table file still 540 MB until a VACUUM FULL (not run — needs a quiet time).
- **Security**: 5 wrong passwords lock an ID for 15 min; line breaks stripped from To/Cc/Bcc/Subject; remote pictures blocked until "Show pictures" / "Always show from sender" (saved per user); sessions stored only as sha256 hashes (nobody was signed out).
- **Service account** has gmail.modify (tested OK on marketing@).
- **Two-way Gmail sync, ON for all mailboxes**: open = read, Mark unread, Archive, Delete = Gmail Trash, Restore — all reach Gmail; changes made in Gmail come back every minute via the Gmail History API. 30-day read/unread refresh done for all 6 mailboxes ("read wins").
- **🚀 Go live button** (Admin → Overview): marks every mail read in the app and in Gmail, starts work tracking for all teams, saves "Live since". Not pressed yet.
- Fixed: Departments "Activate" switch (`rz-activate`) was refusing admins after the session change.

## Open items
- Quick reply "not working": needs a screenshot of what happens after pressing Send (no send has reached the server since 2 Nov).
- Delete wording in the app still says "original stays in the company mailbox" — now wrong (it goes to Gmail Trash).
- Mail list sometimes times out loading (database statement timeout on `rm_list`).
- `rugs-sa-modify-test` stub can be deleted in the Supabase dashboard.
- VACUUM FULL on `rm_messages` to shrink the file (locks the table for a few seconds).
- Sampling FMS bugs above — none fixed yet.
