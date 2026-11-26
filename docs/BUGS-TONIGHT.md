# Bugs — night of 26 / 27 Nov 2026

Rollback point: git tag **`before-night-26nov`** = build `2026-11-26-22` (commit f3e9767).
To go back: `git checkout before-night-26nov -- index.html mail-app.html mail-version.txt`.

Both terminals append to this file. It is set to `merge=union` in `.gitattributes`, so two
people adding lines on the same night can never stop the auto-push.

| # | Bug | Who | Rule | Status | Build |
|---|-----|-----|------|--------|-------|
| 7 | A team manager could not see his members' replies in his Inbox, only in Sent | manager | **R8m** | **fixed, not yet click-tested** | 2026-11-27-6 |
| 6 | REGRESSION from bug 1: the "Narrow it:" bar was added again on every list redraw, so it showed 2, 3, 4, 5 times above the Inbox | everyone | - | **fixed, not yet click-tested** | 2026-11-27-5 |
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

## Bug 6 (the stacking "Narrow it:" bar) - what the tester should check

- [ ] search for something: **one** "Narrow it:" bar, never two
- [ ] leave it on screen for a minute (several polls): still one, and it does not jump about
- [ ] clear with the **X in the search box**, with **Esc**, and with the **Clear** chip -
      each time the bar disappears and the whole folder is listed again
- [ ] do that ten times: still never more than one bar
- [ ] the **X shows only when there is text** in the search box
- [ ] change folder while a search is on: the search ends and the bar goes
- [ ] check it on a phone and in dark mode

## Bug 7 (R8m - the manager sees his team's replies) - what the tester should check

- [ ] as **Shubham (Team Pulse manager)**: open AW27 Spec - **Mia 5:20 pm AND Ashok 5:08 pm**
      are both rows in his Inbox, each at its own time; Ashok's carries **"Sent by Ashok"**
- [ ] Ashok's reply is **also** still in Sent
- [ ] as **Ashok**: his 5:08 reply is in **Sent only**, not in his Inbox
- [ ] as **another member**: nothing changed
- [ ] as the **admin**: no "Sent by" rows at all
- [ ] a "Sent by" row has **no Done button**, is **read** (no unread count change), and is
      **not** in Needs owner or My work
- [ ] the manager's **own** sent mail is still in his Sent only
- [ ] `rzMem()`: the caps still hold with the extra rows

## Bug 7 (R17a - a row opens ITS OWN mail) - what the tester should check

- [ ] as **Shubham**: click the **Ashok 5:08 pm** row - **Ashok 5:08 is the top mail and is
      the open one**; Mia 5:20 is behind a thin bar "1 newer mail in this conversation · Mia
      Chen 5:20 pm ↑"; the older 4:50 mail is still folded below
- [ ] click that bar - Mia 5:20 comes back **above**, the bar goes, 5:08 stays open and the
      screen does not jump
- [ ] click the **Mia 5:20 pm** row - she is on top, Ashok 5:08 below, **no bar**
- [ ] **Reply** from the 5:08 view: the quote stops at 5:08 (nothing of 5:20 in the editor),
      and on an incoming mail Reply goes to **that** sender
- [ ] **Forward** from that view: the file box offers the clicked mail's files, not a newer
      mail's; **Forward as attachment** sends the clicked mail as the .eml
- [ ] **"Show all N mails"** and a **search hit** still show the whole conversation, no bar
- [ ] as **Ashok in Sent**: clicking his 5:08 row puts his mail on top with Mia behind the bar

## Bug 8 (R13i - Ignore conversation) - what the tester should check

- [ ] right-click a conversation → **"🔕 Ignore conversation (to Archive)"**; it leaves the Inbox
      and is in **Archive**, **not** Deleted, with the tag and the trail line **"Ignored by ‹you› -
      moved to Archive"**; the toast offers **Undo** for 10 seconds
- [ ] press Undo - it is back in the Inbox with the tag gone and its old status
- [ ] ignore it again, then **send a reply into it from Gmail**: within a minute it is back in the
      **Inbox**, unread, the **"ignored" tag is gone**, and the Activity trail says **"New mail -
      back in Inbox"** (it used to go straight to Deleted for ever)
- [ ] a mail **you** send in an ignored conversation leaves it ignored and archived
- [ ] **"Stop ignoring"** from the same menu takes the tag off at once
- [ ] Admin → 📜 Mail rules: the IGNORE entry now reads R13i
- [ ] Admin → 🖥 Server → One-time jobs: **ignore-to-archive-2026-11-27** says how many old
      ignored conversations were moved out of Deleted, and that the trigger was replaced

