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
