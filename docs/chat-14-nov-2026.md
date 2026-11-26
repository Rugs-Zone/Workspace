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

## Rugs Email — 14 Nov, afternoon / evening (part 2)

### Done and live
- **180-day history** (rm_settings `history_days`=180), loading older mail in the background. **Keyword topics** instead of Gemini (cron `rm-keyword-topics`).
- **Mail kept on the device** (IndexedDB): sign-in shows mail at once, then fetches only what changed.
- **Auto-assign**:
  - **Name rule**: "Hi Imran" goes to Imran.
  - **Trail rule**: mail goes to whoever replied last.
  - **Alias rule**: `perm.aliases`. Jagjit is merchandiser2@, Imran merchandiser4@, Gulab amr1@, Viney merchandiser7@. Admin → Users has an "Aliases" field.
  - **Leave rule**: owner on leave → Manager → least busy teammate → stays for the CRM. Shows a tag "for X (on leave)".
  - **Timing**: all rules run the moment a mail is saved (trigger `rm_assign_now`), plus a 1-minute cron `rm-alias-assign` as backup.
- **Roles**:
  - Priya is the **only Admin** and the CRM for all teams except Shipping (`perm.crm_depts`).
  - Priyanshu (marketing@) is **Manager** of Marketing & Ops.
  - Karamjot is Executive.
- **Own page `mail.html`**: Outlook look. The Email Tracker tile opens it in a new tab.
- **Rugs Email 2.0 `mail2.html` + `mail-v2.js`** (for comparison; the tile still opens classic):
  - **Layout**: simpler open mail, Outlook attachment cards, and a full-screen viewer for pictures, PDF, Word, Excel and PowerPoint.
  - **Trail**: To/Cc on each mail, and folded "··· Show earlier messages".
  - **No invented banners.**
- **All versions**:
  - **View menu**: sort, show filter, reading pane Right/Bottom/Off, conversations, preview lines; saved per person.
  - **All inboxes.**
  - **Right-click menu**: Reply, Forward, Assign to me, Move, Flag, Unread, **Ignore conversation** (trigger `rm_ignore`), Delete.
  - **Compose like Outlook**: docks in the reading pane, Send/Discard/Attach/Pop out on top, one Attach button, file cards with View (Excel/Word/PowerPoint drawn in the browser) and Remove.
  - **Pictures shown by default** like Gmail. Junk and spoofed mail still ask. "Ask before showing pictures" setting in My profile.
  - **Outlook header on each mail**: Name <email>, To/Cc, full date, Reply/Reply all/Forward/⋯.
  - **Attachments** sit under each mail's own header, with a 📎 count.
  - **Colleague mail** (e.g. storedept@ → marketing@) shows in the **Inbox**, not Sent.
- **Speed**:
  - Gmail sync every **30 s** (cron `rugs-mail-1min`).
  - The app checks every **15 s** and again when the tab comes back.
  - The Sync button and sign-in no longer force a heavy Gmail sync (that caused error 546).
- **Fix "no new mail after 4 PM"**: `rm_list` was timing out.
  - It is now a dispatcher: refreshes use `rm_list_since` (last 60 days, changed only, 0.17 s), sign-in uses `rm_list_full` (60 s allowed).
- **rugs-mail v35**: pictures 40 MB per conversation, big mails keep their HTML, To/Cc/Delivered-To saved (`to_addrs`), and a `threadPreview` action (timer key, for checks).
- `schema.md` describes the email tables and rules.

### Gmail push (instant mail) — almost done
- Edge function `rugs-mail-push`. Cron `rm-push-watch` renews the Gmail watch daily.
- Google Cloud project **rugs-email-512510**: topic `rugs-mail-push` created, org policy relaxed, `gmail-api-push@system.gserviceaccount.com` is Publisher.
- The watch is **OK for all 6 mailboxes** (expires 21 Nov, renewed daily).
- The user created subscription `rugs-mail-push-sub`. **No push has been received yet.**
  - **Next**: send a test mail to teamalpha@, then check `rm_settings.push_last` (count > 1).
  - **If no push**: check the subscription endpoint is exactly
    `https://asbgfjngxsabnnzgxugu.supabase.co/functions/v1/rugs-mail-push?k=323616addae338375fc3c44624aae8205f15`

### Still open / to do
1. Confirm push works (above).
2. **OTP / login-code mails**: these are hidden from the team (only the owner sees them). The user's request "otp also come… so it will show" is unclear. Ask: show them to the team?
3. Requested, not built yet:
   - "Open in new window" for reading and composing (several drafts at once)
   - **Quick Steps** (one-click buttons for several actions)
   - **Save a search** as a folder under Favorites
   - **Web push notifications** on phone (installed app) with an on/off setting
   - **Private "My mailbox"** per user (each person's own @rugscreation.com, visible to them and Admin)
4. Mail with no matching rule waits in "To assign" for Priya. Ask whether it should go to the Manager or the least busy teammate after 1 minute.
5. ~~Choose classic vs 2.0~~ **Done: 2.0 is final** (mail.html runs 2.0, mail2.html forwards to it, invented-banner code removed).
6. Sometimes a sync run stops with 546 (server out of resources) during the 180-day history loading; the next run continues.
7. Older open items:
   - **Quick reply**: still needs a screenshot.
   - **VACUUM FULL** on `rm_messages`.
   - **Sampling FMS bugs** from the audit are still not fixed.
   - The **"promise in your reply"** box sometimes picks up quoted "From:/Sent:" text.

### How to continue in a new chat
Open the Workspace folder, start Claude, and say: "Read chat-14-nov-2026.md and PROGRESS.md, then continue with the open items."
