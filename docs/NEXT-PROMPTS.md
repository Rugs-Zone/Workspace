# Next prompts — night of 26/27 Nov (one account)

How to use: when a bug says "done", test it → type `/clear` → paste the NEXT block below.
Order: SPEED → 9 → 10 → 11 → 12. Tick each one here when done.

---

## [ ] SPEED-UP (paste right after bug 8, takes 2–3 minutes, makes every next bug faster)

```
Speed-up task, no app change.
1) CLAUDE.md loads @PROGRESS.md (over 400 KB) into every chat - that makes every task slow.
   Move everything in PROGRESS.md older than 25 Nov 2026 into docs/PROGRESS-ARCHIVE.md
   (same text, nothing deleted). Keep only 25 Nov onwards in PROGRESS.md.
2) In CLAUDE.md add these lines under Project notes:
   - Read only the last 40 lines of PROGRESS.md unless asked.
   - For each bug run ONLY that bug's own test plus server/check-scripts.js. Run the full
     test suites only when the user types "full test".
   - Do not re-read docs you already read in this chat.
   - Reply in one line.
Reply in one line.
```

---

## [ ] Bug 9 — "Show in Inbox" from the Mail trail

```
Bug 9 tonight (new feature): from a mail inside "Mail trail · N earlier mails", users want
to jump to that mail's own row in their mailbox. Read docs/MAIL-RULES-LIVE.md (R3, R17).
Edit only via mailapp-b64 decode → .tmp/email.html → encode. Bump APP_BUILD and mail-version.txt.
1) Each mail in the Mail trail (and in "Show all N mails") gets a ⋯ More menu item
   "📍 Show in Inbox" (label = the folder it lives in, e.g. "Show in Sent").
2) Match the trail mail to a real message: Message-ID first; else same sender + time within
   2 minutes + subject. Search loaded threads, then ask the server (find by ids) if not loaded.
3) Found: switch to its folder, clear search/filters/chips that hide it, scroll its R17 row
   into view, flash-highlight it 3 s and keep it selected. Do not open it automatically.
4) Not found / not allowed → clear toast, never silent:
   "Only quoted here - this mail never came to this mailbox" /
   "This mail belongs to <owner>" (R3 unchanged) / "Not in your mailboxes".
5) Keyboard + phone width work. No ownership change.
Test as Imran: open a conversation, Mail trail → the Tue 24 Nov 10:37 pm mail → Show in
Inbox → its row is highlighted. Also a quoted-only mail → the "only quoted" message.
Add to docs/BUGS-TONIGHT.md as the user's bug 9, update PROGRESS.md, reply in one line.
```
**Your test:** Switch ID → Imran → Mail trail → 24 Nov 10:37 pm mail → ⋯ → Show in Inbox → row flashes yellow.

---

## [ ] Bug 10 — Folder unread counts (like Outlook)

```
Bug 10 tonight (folder counts, like Outlook). Read docs/MAIL-RULES-LIVE.md first.
Edit only via mailapp-b64 decode → .tmp/email.html → encode. Bump APP_BUILD and mail-version.txt.
1) Every folder in the left list (Inbox, Archive, Junk, personal folders, favourites) shows
   the number of UNREAD mails for THIS user, in bold, hidden when 0. Same count logic as the
   Inbox (R-rules unchanged, respects Switch ID).
2) When a new mail lands in a folder, the folder name turns bold until it is opened.
3) Counts update on every poll and on move / read / unread, without redrawing the whole page.
4) Deleted and Junk show the count in grey, not bold.
Test as admin, a manager and a member, plus phone width and dark mode.
Add to docs/BUGS-TONIGHT.md as the user's bug 10, update PROGRESS.md, reply in one line.
```
**Your test:** move 2 unread mails into a personal folder → folder shows **2** in bold → open one → **1**.

---

## [ ] Bug 11 — Personal mail rules (new locked rule R35)

```
Bug 11 tonight (new feature + new locked rule R35: personal mail rules, Outlook style).
Read docs/MAIL-RULES-LIVE.md first. Ownership / Needs owner / My work rules do not change.
R35: every user (member, manager, admin) can make rules that change ONLY HIS OWN view.
A manager's rule has no team-wide power. Nobody else's view changes.
1) New screen: Settings → 📋 My rules. List of rules with on/off switch, edit, delete,
   move up/down (first match wins, plus "stop processing more rules" tick).
2) Conditions (any combination, all must match): from address, from domain, subject
   contains, sent to (alias / address), has attachment.
   Actions: move to one of MY folders, set topic, flag, mark as read.
3) Rules run on new mail as it arrives (server or poll - whichever is reliable for every
   user), and a "Run now on existing mail" button with a count preview before it runs.
4) Safety: a mail a rule moved still shows in Needs owner and My work until it is owned or
   Done, and stays in the team Inbox for everyone else. Never touch Deleted/Junk by rule.
5) Store rules per user in the database (new table with RLS: a user sees and edits only his
   own rules; DDL through apply_migration, update docs/schema.md one line).
6) Bug 10 counts must light up the folder when a rule drops mail into it.
7) Add R35 to docs/MAIL-RULES-LIVE.md in one line.
Edit app only via mailapp-b64 decode → .tmp/email.html → encode. Bump APP_BUILD and mail-version.txt.
Test as Imran: rule "from @turner-bianca.com → folder Turner" → send a test → it lands in
his Turner folder with a count; Gulab's Inbox unchanged; still in Needs owner if unowned.
Add to docs/BUGS-TONIGHT.md as the user's bug 11, update PROGRESS.md, reply in one line.
```
**Your test:** as Imran make a rule for your Gmail address → send a test mail → it goes to his folder with a bold count. Switch ID → Gulab: the mail is still in the normal Inbox.
⚠ This is the biggest one. If the limit is low, do it tomorrow morning instead.

---

## [ ] Bug 12 — Security (S1 + S2)

```
Bug 12 tonight (security, 2 small fixes). Read docs/MAIL-RULES-LIVE.md first.
1) "Empty Deleted" sets folder 'purged' but the server checks the delete right only for
   'deleted'. Make the server check the delete right for 'purged' too, and refuse without it.
2) Maintenance window: localStorage 'rugs-maint-ok' lets anyone in. Allow the bypass only
   for a signed-in admin, checked by the server/session role, not by localStorage alone.
3) Only report (do not fix): does designer@ sync now (scanned/saved counts)?
Edit app only via mailapp-b64 decode → .tmp/email.html → encode. Bump APP_BUILD and
mail-version.txt. Test both as admin and as a member.
Add to docs/BUGS-TONIGHT.md as bug 12, update PROGRESS.md, reply in one line.
```
**Your test:** Switch ID → a member without delete right → Deleted → Empty → it must refuse.

---

## Later (not tonight)
- U1: junk text `[cid:…]` / `<https://linkprot…>` in collapsed previews
- U2: "You are using <name>'s ID" banner covers the bottom of the list
- Manager "Show our replies" is done (R8m) — no action
- Git history is heavy (index.html ~10 MB per push) — clean up later
- Server size / Drive backlog / CPU errors — the server move
