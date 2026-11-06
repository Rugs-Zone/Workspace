# PROGRESS — Rugs Zone Workspace (updated 2 Nov 2026)

## Final file
- `index.html` (2 Nov 2026) = the LIVE site + everything below. Upload this to GitHub as index.html.
- WARNING: `modules/email.html` and `modules/ppc.html` in this folder are DIFFERENT versions from the live site.
  Do NOT run build.bat until the folder is synced from the final index.html (next chat: "sync modules from index.html").

## Email Tracker (Rugs Email) — done
- Inbox loads its whole last 60 days (first 300 per mailbox, the rest in the background); opens on Home; sound picker; Help-Bot + Report a problem hidden in the tracker; 📲 Install app button
- Newest-first conversations; compact header (⋯ More); drag & drop to folders; undo delete (10 s); select many + bulk bar
- Inbox = last 60 days; opens on Inbox with cached mail; full screen on open; new-mail sound (🔔/🔕 switch)
- To assign (CRM: Priya, Karamjot) — full width; work counts from first login AND from team activation
- Admin → Departments → "Work tracking — Activate" (per team). All teams start NOT active.
- Buddy auto-assign (CRM + TL both on leave) and auto-assign by buyer domain (Admin → Users) — server cron every 5 min, only for active teams
- Daily report (everyone), weekly summary (Manager/Admin), ⬇ Excel; Files page + Gmail attachment search; Calendar page
- Promise pick-up, no-reply nudge (3+ days), translate, snippets (/ship …), print, keyboard shortcuts (?)
- Compose: full screen, attach in toolbar, signature shown in the body

## Sampling FMS — done
- Buyer / counter-room piece split on merchant side
- Bugs A–E fixed (ship-later not resolved, notification names, reject resets clocks, reject reason required, qty warning)
- Shade card FIRST → then photo + costing; one shared limit of 36 working hours from sample completion
- Admin & Links → "Activate now" switch (shade card / costing / photo). Currently NOT active.
- Logins: Kashish = Photo (done). User will add: Shade Card person, Prince (Photo). Costing = Gaurav.

## Server pieces (Supabase)
- Edge function `rz-activate` (activation switches), `agent-hub` (follow-up agent skips Inspection)
- Cron: sampling-step-overdue (hourly), rm-buddy-assign, rm-domain-assign (every 5 min)

## To check after upload
- Press Activate in Sampling FMS and in Email → Departments; status must turn Active.

## Change log
- 4 Nov 2026: `CLAUDE.md` now loads this file every session and requires a short update here after every finished task.
- 4 Nov 2026: Added `Rugs Claude.bat` to the Desktop (outside this repo); it opens this folder and continues the last Claude session.
- 4 Nov 2026: Email Tracker folders are now personal (saved in each person's prefs, only the maker sees them), with a delete button that sends the mail back to Inbox. Old shared folders show only while they hold mail in that person's own mailbox.
- 4 Nov 2026: Email Tracker delegation queue on Home now shows newest to oldest.
- 4 Nov 2026: Email Tracker now fits the visible tablet screen (browser bars, keyboard), so Send stays reachable in New mail.
- 4 Nov 2026: Supabase `rz_msg_from_notification`: Priya's "courier invoice approved" notice now stays on her dashboard only, with no SMS or WhatsApp. Other invoice makers still get messages.
- 4 Nov 2026: Courier invoice form: Buyer code moved to 5th place; Ship to, Country and Buyer ID removed; Payment terms is a mandatory Self/Buyer dropdown; International adds a mandatory "Expense borne by" (Company/Self), saved as `expense_by`. New invoices still send the Buyer master's Ship To (flag `no_shipto` stops it printing), because `cd_inv_save` would otherwise blank it in the master.
- 5 Nov 2026: Courier "Tracking no. is mandatory" banner now shows only to Preeti (role `rec`), no longer to admins.
- 5 Nov 2026: Courier invoice form: Payment terms removed. Entering a buyer name or a buyer code fills the address and details from Buyer master, and they stay editable. A code shared by two buyers fills nothing and asks for the name.
- 5 Nov 2026: Sampling FMS: a merchant entering a sample's courier and tracking no longer sends the handler a "Sample dispatched" notice. The "Remaining pieces" notice is unchanged.
- 6 Nov 2026: Reimbursement Details popup has a Print button: details on page 1, then every bill and slip on its own page (photos, and PDFs page by page using pdf.js from cdnjs). A bill that fails to load is named on the printout.
