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

## Bug 9 (Show in Inbox, from a quoted mail) - what the tester should check

- [ ] open a mail you sent, open **"Mail trail - N earlier mails"**: every quoted mail has a
      **⋯** button on the right of its From / Sent / To block
- [ ] press it on a mail that really came to the mailbox - the menu says **"📍 Show in
      Inbox"** (or Sent / Archive / Junk / Deleted / your own folder - whichever it is in)
- [ ] pressing it jumps to that mail's **own row**: the folder switches, the chips, topic
      filter and search box clear, the row scrolls into the middle, **flashes for 3 seconds**
      and stays selected - and the mail is **not opened**
- [ ] a mail that was **only quoted** says **"Only quoted here - this mail never came to this
      mailbox"**; a mail in a mailbox you cannot see says **"Not in your mailboxes"**; one a
      colleague owns says **"This mail belongs to ‹name›"** (R3 and R15 are unchanged)
- [ ] the same item is in each mail's own **⋯ More** menu in the reading pane, so it works on
      the mails **"Show all N mails"** opens
- [ ] keyboard: Tab to the ⋯, Enter opens the menu, the item is focused, **Esc** closes it
- [ ] on a phone it leaves the reading pane so the list and the flashing row can be seen

## Bug 10 (folder counts, like Outlook) - what the tester should check

- [ ] the left pane: **Inbox, Archive, Junk, Deleted, your own folders, the shared mailboxes
      and "All inboxes"** each show the number of **unread** mails, and nothing at all when
      it is 0; **Drafts still shows its own draft count**
- [ ] the Inbox number is the same as the one in the Inbox header and the Mail badge
- [ ] **Junk and Deleted are grey and not bold**; the others are bold
- [ ] a folder holding mail that arrived since you last opened it has its **name in bold**;
      opening the folder clears it, and new mail in it bolds it again
- [ ] mark one read / unread, or move one to another folder: the numbers change at once and
      the page does not flicker
- [ ] as a **member**, a conversation a colleague owns is not in your count (R3); as the
      **manager / admin** it is
- [ ] **Switch ID** into somebody: the counts are theirs, not yours
- [ ] on a **phone** the folder picker at the top of the list shows the counts in brackets
- [ ] **dark mode**: the counts (and the mail list) are readable - this also fixes text that
      had been near-black on a near-black page since 26 November

## Bug 11 (R35 - My rules) - what the tester should check

- [ ] menu under your own name → **📋 My rules** → **New rule**: from domain
      `turner-bianca.com`, "…or a new folder" **Turner**, Save
- [ ] that buyer's mail is now in **your Turner folder**, out of **your** Inbox, the folder shows
      a **count** and its name is **bold**
- [ ] ask a colleague (or Switch ID into one): **their Inbox still has it** and they have no
      Turner folder - a rule is yours alone, a manager's rule included
- [ ] the mail is still in **Needs owner** (if nobody owns it) and in **My work** (if you own it),
      and its folder in the conversation is still the Inbox
- [ ] the other actions: **set topic** shows that topic on the row and in the Topics filter,
      **flag** puts it in Flagged, **mark as read** takes it out of your unread count only
- [ ] **order**: two rules, first match wins; **stop here** ends the list; **off** does nothing;
      ↑ ↓ change which one wins; delete offers **Undo**
- [ ] **Run now on existing mail** says how many match before you press Apply
- [ ] a Turner mail in **Junk or Deleted** is left exactly where it is
- [ ] sign out and in again: the rules are still there (they are saved on your own user row)

## Bug 12 (security: Empty Deleted, and the maintenance bypass) - what the tester should check

- [ ] as somebody **with** the delete right: Junk and Deleted still show the dustbin and
      **Empty Deleted** still works, with its 10-second Undo
- [ ] as somebody **without** it: no dustbin, and if the action is forced anyway the server
      answers **"You can't delete mail"** (it now checks the right for 'purged' as well as
      'deleted' - this needs the office server on version **2026-11-27-d** or later)
- [ ] during a maintenance window: a **member** and a **manager** are held on the
      maintenance screen even if `rugs-maint-ok` is set in their browser; only a signed-in
      **Admin** keeps working, and a deactivated admin does not
- [ ] nothing about the window changed for an admin: the countdown bar still says
      "(you keep access)"


## Bug 13 (design / UI / UX / theme pass) - what the tester should check

No rule, no ownership and no server change: this only changes how the app looks.
Build **2026-11-27-13**. `server/patch-design-13.js`, `server/test-design-13.mjs` (89 checks).

- [ ] open a mail that came with a pasted screenshot or a rewritten link: the **row preview**
      and the **folded-mail one-liner** no longer read `[cid:image001.png@01DC...]` or
      `<https://linkprotect.cudasvc.com/...>` - they read the buyer's words
- [ ] open that same mail: the **mail itself is untouched** - the picture still shows and the
      link still works. Nothing was taken out of a real mail, only out of the preview text
- [ ] **Admin -> Switch ID** into somebody: the orange "You are using X's ID · Back to my ID"
      bar is now a **slim bar with its own space** above the Items/Unread bar - the bottom of
      the mail list and the Items/Unread bar are both fully visible. Same on a phone, where
      its **Back to my ID** button is 40px tall
- [ ] the list, the folder pane, the reading pane and the buttons are all **one typeface**;
      the list reads at 13-14px, a mail body at 14.5px, and nothing with words in it is
      under 12px (the folder group labels "Favourites / Topics / Organise" and the
      "View mail ↑" link in the Activity trail were 11px and are now 12px)
- [ ] a **buyer's mail keeps its own look** (its own font, colours and layout) but a huge
      pasted picture is now held inside the pane and the reading pane never scrolls sideways
- [ ] **dark mode and light mode**: every sender, subject, preview, time, day heading, chip
      and tag is readable (measured at 4.5:1 or better in both); an **unread row** is
      noticeably bolder with its 4px orange bar
- [ ] on a **phone (390px)**: every button on the list and in the reading pane is at least
      40px tall, and nothing scrolls sideways (the two invisible pane-drag handles that
      stuck 3px off the right edge are gone on a phone)
- [ ] an **empty list now says something useful**: "No mail needs an owner", "Inbox is clear",
      "Nothing sent from here yet", "Deleted is empty", "Nothing on your plate",
      "Nothing is late", "“Claims” is empty - drag a mail onto this folder…",
      "Nothing unread", and a search with no hits names the words you searched for

---

## M1 (the user, 27 Nov): "make mandatory rule in setting that rugs email keep tab under 250 mb"

Live in build **2026-11-27-14**. It is a **rule**, not an option: **Admin → 📜 Mail rules → Speed and
memory → M1**, badge **Mandatory**, and where every other rule has an On/Off button this one says
**"cannot be switched off"** — for an admin too. Everybody can read it from the menu under their own name.

### What to click

- [ ] **Admin → 📜 Mail rules**: a new **Speed and memory** section, one row, **M1**, red **Mandatory** badge,
      **no On/Off button**, and the row shows the live figure — e.g. "This tab is holding 62.4 MB (25% of 250 MB)"
- [ ] **"What breaks if this changes?"** on that row explains why there is no switch, and that what it drops
      are copies and never mail
- [ ] **Checks right now** (top of the same page) has a line for M1: "Rule M1 is holding: N MB of 250 MB"
- [ ] the menu under your own name → **📜 Mail rules**: the same row, same badge, still no switch
- [ ] **↺ Put every rule back to how it shipped** does not touch M1 (it is not a switch)
- [ ] in the browser console: **`rzMemCap()`** → capMB 250, nowMB the live figure, `switchable: false`,
      and `timesItHadToAct` counting any time it had to clear copies
- [ ] work heavily for a while (open several big claim trails, download a few attachments, write a mail with
      files) and watch `rzMemCap().nowMB` — it must never settle above 250; `rzMem()` still shows the
      per-store detail
- [ ] after it has had to act: the conversation **on screen is still open and readable**, the list is unchanged,
      and an older conversation reopens normally (it is fetched again)
- [ ] nothing is lost: no folder, owner, read/unread or Done state changes, and a mail being **written** keeps
      its attachments

Tested: **54 checks** (`server/test-mem-cap-m1.mjs`) — the guard cut verbatim out of the shipped app and run
against a tab deliberately stuffed to 300 MB, plus the page itself in real headless Edge at laptop and phone
width; and **90 + 36** on the rules registry and the rules screen. `server/patch-mem-cap-m1.js`,
`server/patch-mail-rule-m1-row.js`.

---

## URGENT (the user, 27 Nov): "tab reaches 410 MB and freezes for staff"

Fixed in build **2026-11-27-15**. Measured first, as a member in Team Alpha:
the five budgeted stores were **1.2 MB** (9 MB with ten heavy mails open) and the list drew 452 rows
into 20,000 DOM nodes — **neither was the cause, so no virtualisation and no lazy images were needed**.
What nothing counted was **`S.threads` itself**: 15,000 conversations is **123 MB** of conversation and
message objects, every search merged up to **400** more in and every scroll **500**, and nothing ever
dropped any. And M1 could not see its own work — it read `performance.memory`, which Edge quantises,
so it re-ran the emergency every four seconds: **trim → refetch → trim**, the freeze.

### What to click

- [ ] work a full morning in a big mailbox (Team Pulse / Team Alpha), then in the console: **`rzMemCap()`**
      → `nowMB` must stay **under 250**, and `conversationsInMemory` shows "N (cap 2500)"
- [ ] open 20 mails one after another, scroll the Inbox a long way down, run 3 searches — the tab must
      **not** climb past 250 MB and must **not** go sluggish
- [ ] scroll back up and down again: older conversations that were dropped **come back** (they are fetched
      again), the list is in the right order and nothing is missing
- [ ] the conversation **you are reading stays open and readable** the whole time
- [ ] start writing a mail with attachments, leave it a few minutes while you work elsewhere — **the
      attachments and the draft are still there**
- [ ] `rzMemCap().lastCaps` shows what it dropped; `rzMem()` still shows the per-store detail
- [ ] nothing changes about who sees which mail — folders, owners, unread and Done are untouched

Tested: **25 checks** (`server/test-mem-410.mjs`) in real headless Edge on a 15,000-conversation mailbox,
driving the brief's own run (20 mails + 4,000 conversations paged in by scrolling + 3 searches merging
1,200 more): **202 MB at every step, 2,500 conversations held, the guard acts once and then stops**, the
open conversation keeps its mail, an unsent mail is never dropped, and every drawn row still has its
conversation. Plus M1 54, page memory 27 + 30, mail rules 90, folder counts 42, My rules 51, design-13 89,
search bar 47, inbox-stays 20/20. `server/patch-mem-410.js`, `server/measure-mem-live.mjs`.

## Bug 16 — rule R30a: old mail open to the team, in Search only (build 2026-11-27-16)

The half-written R30a another terminal left in `server/mail-rules.view.js` (marker `__r30arule`,
a registry row whose helper and chooser button did not exist in the app) was **removed first** —
nothing of it is reused. Built clean: `server/patch-r30a.js` (engine),
`server/patch-mail-rule-r30a-row.js` (the page), `server/test-r30a.mjs` (82 checks).

Click through as a **member of Team Alpha** (Admin → Switch ID):

1. Search for a word in a conversation from **before 15 Nov** that a **colleague owns** — it is found.
2. Search for the same word in one from **after go-live** that a colleague owns — still not found.
3. Open the Inbox with the search box empty — neither is in the list, and the Inbox count has not moved.
4. The found row carries **📜 Old mail · open to the team** and **no Done tick**.
5. Open it — the pane says why it is readable and has **no Done, Reopen, Take over, Transfer or Assign**.
6. In the Mail trail of any mail, press **⋯ → Show in ‹folder›** on an old colleague-owned mail —
   it jumps to the row and flashes it, instead of saying "This mail belongs to somebody else".
7. Change folder — the row is gone again (the Inbox does not keep it).
8. As an **admin**: Admin → 📜 Mail rules → **R30a → Choose teams** — Alpha and Pulse On, the rest Off;
   pressing one asks first and counts the real conversations.
9. `rzMemCap()` in the console — still under 250 MB (rule M1).

## Bug 14 — classic-blue header / footer / left pane / reading pane (build 2026-11-27-17)

UI only — no rule, no ownership, no count, no server change, and the centre mail list is untouched.
`server/patch-ui-14.js`, `server/test-ui-14.mjs` (77 checks).

1. Sign in and look at the top: the header is **blue**, the logo and every icon are white and readable.
2. Every control you had before is still there, in the same order — folder toggle, logo, search, mailbox pill,
   **Send / Receive**, A− 100% A+, full screen, bell, your name (and Switch ID if you are the admin).
3. Hover each one — every single one shows a tooltip.
4. Press **Send / Receive** — only the circular icon spins while it is checking, and stops when it is done.
5. In the search box press **“All mailboxes ▾”** → pick **This folder** → search a word that exists in two
   mailboxes: only this folder's mail is found. Put it back to **All mailboxes** → both are found again.
   (All mailboxes is the default, which is what Rugs Email always did.)
6. Left pane: light grey, the folder you are in is **light blue with a blue bar down its left edge**, and the
   other rows do not shift sideways when you click between them.
7. Open a mail: the **subject is first**, then **one toolbar** (Quick steps / Read aloud / Immersive now sit
   under it, not above the subject), then each mail **in its own white card**. **Reply is blue.**
8. Bottom bar: **Items · Unread** on the left, **● Connected · All folders are up to date · HH:MM** on the right.
   Pull the network out for a moment — it says **Not connected** with a red dot, and goes back by itself.
9. On a phone: A−/A+ and full screen are inside one **⋯** button — open it, make the text bigger, put it back,
   and try Full screen. Nothing scrolls sideways.
10. The middle list must look **exactly as it did yesterday** — same row spacing, same lines, same type.
11. Dark mode (your name → theme): header dark blue, panes dark, every word readable.
12. `rzMemCap()` in the console — still under 250 MB (rule M1).

## 28 Nov 2026 — "Couldn't load — Retry" on older mails (Ashok, Team Pulse, "Very SS27 Po's")

**Cause, proved against the live server (admin token, then a real Switch ID session as Ashok):**
`thread` answered **200 to both**, with the same body — nothing was refused, so neither Switch ID nor
bug 12's guards nor the lazy loader's ids were at fault. The office log said, for every older id:
`thread msg miss <id> Gmail 404: Requested entity was not found` (twice, because of the retry).
The app's own Gmail search then showed the thread `1a1cf9058bac590f` still exists in teampulse@ but
holds mail **only from 23 Nov onwards** — every window up to 19 Nov, `in:anywhere` included (Trash and
Spam), comes back without it. So Gmail no longer has those message ids; Rugs Email still has its own
saved copy of their text, which is why the preview read and the body did not.

**Fix:** server (`server/patch-thread-rescue.js`, bundle `2026-11-28-a`) + app (`server/patch-saved-copy-client.js`, build `2026-11-28-1`).
A 404 is never retried; the mail is first looked for in the same mailbox by **sender + time** (an id can
be stale rather than the mail gone) and the real original served if found, under the id the app asked for;
otherwise the **saved copy** is sent (`saved:true`) and the pane reads it with one line saying so, instead
of an error. A transient failure (502/timeout) still comes back as a summary so **Retry** still means something.

**Tester checklist**
- [ ] Ashok, Team Pulse, "Very SS27 Po's": every mail opens — the 12–19 Nov ones read with the line
      "Google Mail no longer has the original…"; none shows "Couldn't load" for ever.
- [ ] The same through **Switch ID** (admin → Ashok's ID) — identical.
- [ ] A real member login (not switched) — identical.
- [ ] "Show all 12 mails": nothing spins, nothing fails.
- [ ] Fold them up and open one again: still reads, no spinner.
- [ ] `rzMemCap()` stays under 250 MB.
- [ ] Admin → 🖥 Server → log: look for `thread msg rescued` (the original was found under a new id)
      vs `Gmail does not have this id (404), not retried`.

## 28 Nov 2026 — console error on a Gmail signature logo (build 2026-11-28-2)

`GET work.fife.usercontent.google.com/rd-mail-sig/… net::ERR_BLOCKED_BY_RESPONSE.NotSameSite 302`

That address is a colleague's **Gmail signature picture**, kept inside their own Google account.
Google refuses to let any other site show it, and **our own server is refused too — measured: a
plain fetch of that exact address answers 403** (those are the "REFUSED img → 404 Picture not
reachable" lines in the office log). So it cannot be shown by us or anyone outside Google.
The address is now taken out of the mail **before it is drawn**: no request, no red console line,
nothing reported back to the sender each time the mail is opened, and the pane says once, in plain
words, that a signature picture cannot be shown and why. Only session-private Google addresses are
touched (`*.usercontent.google.com`, `ci*.googleusercontent.com/proxy/`, `mail.google.com/mail/…`,
anything with `/rd-mail-sig/`) — an ordinary internet picture, a Drive picture and an attached
(`cid:`) picture are untouched. `server/patch-private-pics.js`, `server/test-private-pics.mjs` (29 checks).

**Tester checklist**
- [ ] Open a colleague's mail that had the broken logo: no red line in the console (F12), no gap-with-icon.
- [ ] The line under the mail reads "A picture in this mail (a Gmail signature logo) cannot be shown…".
- [ ] A buyer's mail with a real logo on the internet still shows it (Show pictures where asked).
- [ ] An attached picture and a Drive picture still show.
- [ ] `rzPrivPics()` in the console lists which mail had how many hidden.

## 28 Nov 2026 — Ashish Deshwal's Sent folder (app 2026-11-28-3, server 2026-11-28-b/c)

**What was wrong — the RULE, not the mail.** Measured on the live office database first (admin
token, then a real Switch ID session as him, read only): **4,888** mails of his since **11 Mar 2026**
across **10 mailboxes**, 4,566 of them already `direction='out'`, and **`sent_by` NULL on 4,803**
because he writes in Gmail, not in Rugs Email. The app's rule was:

```
colleagueIn(m,t) = m.ours && !m.by && m.email && m.email !== t.box
Sent shows a conversation when  t.msgs.some(m => m.by || (m.ours && !colleagueIn(m,t)))
```

His mail is "ours", has no `sent_by`, and its From (his own login `merchandiser9@`) is not the
shared mailbox address — so `colleagueIn` said TRUE, "a colleague wrote in", and **his own mail
counted as mail received**. Anybody writing from their own login into a shared mailbox had the
same hole.

**The rule now (permanent):** a mail whose From is a person's own **login or alias** was sent by
that person, in whatever mailbox it lands — one helper, `sentByUs(m,t)`, used by the Sent folder,
the per-mail rows (R17) and R15. `recvMsg`/`colleagueIn` are untouched, so the mail is *still*
received mail for the mailbox: the team Inbox, Needs owner and the work lists do not move (proved
by running the same fixture on the build before and after and comparing every list for four people).
R15 still decides who sees it: the sender does, a colleague does not, manager/lead/CRM/admin do.

**Data repaired by the one-time job `ashish-sent-2026-11-28`** (one transaction, undo saved in
`rm_settings.undo_ashish-sent-2026-11-28`): **322** messages of his that were not `direction='out'`
→ fixed (and `sent_by` set on those); **1** conversation with a stale `has_out` → rebuilt. The 4,803
with no `sent_by` were deliberately **not** mass-written: `sent_by` turns off `colleagueIn`, which is
what keeps a colleague's mail in the team INBOX, so a careless repair there could empty work out of
Team Pulse's Inbox. The rule names the sender instead.

**Robin (Robin Vos, Loods 5 — r.vos@loods5.nl):** 28 mails of his to/cc Robin in teampulse@,
in 7 conversations, newest 13 Nov. In a search session: **7 of 7 now in his Sent (2 of 7 before)**.

**Tester checklist**
- [ ] As Ashish (or his ID through Switch ID): Sent now lists what he wrote — 19 of his 19 live
      conversations in the loaded window (2 more are in Deleted, which is never in Sent).
- [ ] Search `r.vos@loods5.nl` → those conversations are in his Sent, row reads "To: Robin Vos | Loods 5".
- [ ] A colleague's Sent did NOT gain his mail; the manager sees everything.
- [ ] The team Inbox, Needs owner and My work are unchanged.
- [ ] `rzSentCheck()` in the console reports his counts.

## 28 Nov 2026 — R36: your own sent mail, wherever it landed (app 2026-11-28-7, server 2026-11-28-d)

**The report:** "he sent a mail to a buyer and it is not showing in Sent."

**Measured first, read only.** The mail in the screenshot (Gmail `in:sent robin`, "Re: New order",
27 Nov 4:05 pm to Maud/Robin) **is** in his Rugs Email Sent — it was sent through Rugs Email from
teampulse@ and every rule says yes. Of all 93 Loods 5 conversations, 67 have mail we sent, 42 are
in his Sent and **25 are not — and all 25 hold no mail of his at all**: 71 mails by Shubham Aneja
and 7 by Vinay Chugh, from their own logins. **R15** hides a colleague's sent mail, so Gmail's
Sent (the whole shared mailbox) and Rugs Email's Sent (yours) will never match. Changing that is
a change to R15 — ask for it if the team wants it.

**The real gap, now fixed — R36.** 1,317 of his 4,888 sent mails landed in mailboxes he may not
open (vinay@ 605, shipping@ 390, designer@ 253, teamalpha@ 40, dmm3@ 13, merchandiser1@ 8,
neetu@ 6, mis@ 1, marketing@ 1). His own mail in them is now shown in his Sent as its own group,
read only. The server returns only his own From, only from mailboxes he may not open, and only
mails with no copy in a mailbox he can open; nothing else from those mailboxes is read, and the
answer never enters `S.threads`.

**Tester checklist**
- [ ] As Ashish (or his ID through Switch ID) → Sent → scroll to the end: a group
      "📤 Also sent by you · in mailboxes you cannot open · N", each row naming the mailbox.
- [ ] Click one: the reader opens with his own mail, says which mailbox it is in, and has
      **no** Reply / Forward / Done / move — only ✕. Escape closes it.
- [ ] Inbox, Needs owner, My work, the folder counts and the Sent rows above the group are all
      exactly as before.
- [ ] As the admin: the group is not there at all (an admin may open every mailbox).
- [ ] `rzMySent()` in the console reports how many were found and for whom.
- [ ] The server must be on 2026-11-28-d (Admin → 🖥 Server); before that the group simply
      stays empty and nothing breaks.
