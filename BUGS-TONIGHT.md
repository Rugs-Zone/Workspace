# Bugs — night of 26 / 27 Nov 2026

Rollback point: git tag **`before-night-26nov`** = build `2026-11-26-22` (commit f3e9767).
To go back: `git checkout before-night-26nov -- index.html mail-app.html mail-version.txt`.

Both terminals append to this file. It is set to `merge=union` in `.gitattributes`, so two
people adding lines on the same night can never stop the auto-push.

| # | Bug | Who | Rule | Status | Build |
|---|-----|-----|------|--------|-------|
| 5 | The Owner picker listed every one of the 83 people in the company, and picking one moved the conversation to their team | everyone | **R29a** | **fixed, not yet click-tested** | 2026-11-27-4 |
| 4 | Clicking a mail (or a trail, or "Show all N mails") jumped the screen down to the Activity trail instead of opening it in place | everyone | - | **fixed, not yet click-tested** | 2026-11-27-3 |
| 3 | Mails arriving minute by minute were not each shown: two mails sent in the SAME SECOND could swap places on every redraw, "Expand all" did not read as "the other mails are here", a poll bringing 2+ mails only opened the newest, and the row cache (600) was too small for per-mail rows | everyone | R17 | **fixed, not yet click-tested** | 2026-11-27-2 |
| 2 | Search hides mail: it ranked by date, a number matched inside a longer number (4815 found 24815), the filters never reached the server and a 400-row subquery had no ORDER BY | everyone | - | **fixed, not yet click-tested** | 2026-11-27-1 |
| 1 | A mail in a conversation has no row of its own — the row shows whoever wrote last (e.g. Aman Singh Verma 25 Nov 17:34 showed as "Manfred Mui, 8:21 pm") | everyone | R17 | **fixed, not yet click-tested** | 2026-11-26-24 |

## P1 — what the builder did

* **R17 (one row per mail) is on by default.** Every mail in a conversation has its own row,
  its own sender and its own time; clicking a row opens that mail. It is now rule **R17** on
  Admin → 📜 Mail rules, so it can be turned off again in one click without a build.
* The list window still counts **conversations, not rows**, so the Inbox reaches exactly as
  far down as it did with conversation rows.
* The memory caps (26 Nov) are in the same build: loaded mail 35 MB, opened-mail cache 15 MB,
  attachments 10 MB, thumbnails 4 MB, compose attachments 15 MB, row HTML 600 rows. Type
  `rzMem()` in the browser console to see what a page is holding.

## P1 — what the tester should check

As **Switch ID → one member, one manager, and admin** in Team Alpha:

- [ ] 3 mails in one conversation show as 3 rows, each with its own time
- [ ] clicking each row opens **that** mail, not the newest one
- [ ] Sent keeps our own mail at its own time, addressed "To: …"
- [ ] the bottom bar says "conversations", not rows
- [ ] the Inbox still reaches as far back as it did yesterday (scroll to the end)
- [ ] `rzMem()` stays under the caps after opening ten heavy conversations

## Bug 1 (search) - what the tester should check

As **Switch ID -> admin, Jagjit (manager) and one member** in Team Alpha:

- [ ] type `4815` - the **IO 4815** conversation is **row 1**, not the newest mail
- [ ] no result contains 24815 or 148150
- [ ] every result row carries a folder tag (Inbox / Sent / Done / Archive / Junk / Deleted)
- [ ] the number is highlighted on the row AND inside the mail when you open it
- [ ] the five chips (From, To, Has attachment, Date range, Folder) write their codes into the box
- [ ] `from:` + a name finds mail the browser had never loaded (it is filtered on the server)
- [ ] a search with many hits offers **Show the next 500** at the bottom
- [ ] a member still does NOT find a conversation a colleague owns (ownership is unchanged)

## Bug 3 (minute-by-minute mails) - what the tester should check

As **Switch ID -> admin, Jagjit (manager) and one member** in Team Alpha:

- [ ] a conversation with several mails shows **one row per mail**, each with its own sender and time
- [ ] rows an exact minute apart show different times and are in the right order
- [ ] open it: **every** mail is listed with sender and time, newest open
- [ ] the bar at the top says **"Show all N mails"** and pressing it opens all of them
- [ ] leave it open for a few minutes - when new mail lands, EVERY new mail appears as its own row
- [ ] `rzMem()` in the console: the stores are inside their caps and it now also prints the row-cache size

## Bug 4 (the screen jumps to Activity trail) - what the tester should check

As **Switch ID -> admin, Jagjit (manager) and one member**, on a laptop AND on a phone:

- [ ] open a conversation with several mails, scroll half way, click a folded mail -> it opens
      **exactly where it is**; the screen does not move
- [ ] the same for "Mail trail - N earlier mails" and for "Show all N mails"
- [ ] the **Activity trail starts closed**; open it and it stays open while you click other
      mails in the SAME conversation; another conversation opens with it closed again
- [ ] inside the Activity trail, **"View mail up"** is the only thing that moves the screen,
      and it moves to that mail
- [ ] leave a conversation open while new mail lands: the screen does **not** move and a small
      blue **"1 new mail down"** pill appears in the bottom corner; clicking it shows the mail

## Bug 5 (R29a - the Owner picker) - what the tester should check

As **Switch ID -> admin, Jagjit (manager) and one member** in Team Alpha, and as admin in Marketing:

- [ ] the Owner box on a Team Alpha mail lists **only Team Alpha people** - no other team, no
      deactivated colleague, no admin
- [ ] it is the same list for the admin as for a member
- [ ] a Marketing mail shows **the name, with no picker** (one person in that mailbox)
- [ ] Transfer still lists only the receiving team's people (unchanged)
- [ ] right-click a conversation: an **admin** sees **"Move to team..."**; a manager and a
      member do not
- [ ] "Move to team..." moves it to the chosen team with **no owner**, and the Activity trail
      says who moved it and where it went
