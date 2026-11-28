# The rules that are LIVE right now — file your bugs against this

App build **2026-11-27-6**. Checked against the shipped code, not from memory.
Three lists: **A** what is live, **B** what is agreed but deliberately NOT live tonight,
**C** what changed this evening that is not a rule.

---

## A · LIVE — the rules a bug can be about

### The Inbox

| # | Rule |
|---|---|
| R1 | A buyer wrote, **nobody has taken it** — the whole team sees it, anyone can take it |
| R2 | Assigned to me — I see it, with my name on the row |
| R3 | **Assigned to a colleague** and I never touched it — hidden from me, the manager and admin see it |
| R4 | Assigned to a colleague **but I replied in it earlier** — I keep it |
| R5 | I replied to mail nobody had taken — **replying does NOT make me the owner**, but I keep it |
| R6 | A colleague wrote into the team mailbox, nobody has taken it — the whole team sees it |
| R7 | **Marked Done — it stays in the Inbox** (there is no filter hiding it) |
| R8 | Mail we sent that nobody has answered — **Sent only**, not the Inbox |
| R8m | **A team MANAGER also sees his own team members' sent mail as rows in his Inbox**, at each mail's own time, as well as in Sent — tagged "Sent by &lt;name&gt;", arriving read, never work (no Needs owner, no My work, no Done) and never changing the owner. The sender himself and the other members are unchanged (R8), the manager's own sent mail stays in his Sent, and an Admin is not included |
| R9 | Mail we sent to our own mailbox — Inbox **and** Sent |
| R10 | A **login code (OTP)** — shown to the whole team even if owned, tagged, never counts as work |
| R11 | **Workspace notifications** — their own folder, never in the Inbox or any work list |
| R12 | **Automatic mail** (no-reply, newsletters) — closed as Done and tagged "Auto" on arrival |
| R13 | **Archive / Junk / Deleted** — out of the Inbox, still readable in that folder |
| — | **No date cut**: a conversation stays in the Inbox whatever its age |
| — | **A reply does not move it**: it stays in the Inbox, and the reply also shows in Sent |

### Sent

| # | Rule |
|---|---|
| R14 | A conversation we wrote in is in Sent, answered or not |
| R15 | "Mine" = sent from Rugs Email by me, or from Outlook under my own name, or from my own address / alias |
| R16 | Sent under a name that is **nobody's** ("Team Pulse") — stays with the whole team |
| R17 | **One row per mail** — every mail in a conversation has its own row, sender and time (LOCKED ON, 26/27 Nov; it is a switch on Admin → 📜 Mail rules). Two mails sent in the same second are ordered by their Gmail id, so they never swap |
| R17a | **A row opens ITS OWN mail as the main mail** (27 Nov) — the clicked mail sits first and expanded, only OLDER mails are listed below it, and anything NEWER waits behind one thin bar at the top ("N newer mail(s) in this conversation · sender time ↑"; click it and they come back above). Reply / Reply all / Forward / Forward as attachment then answer the CLICKED mail — the quote stops at it, Reply goes to its sender, Reply all takes its Cc, a forward offers its files. Opened any other way (search hit, link, "Show all N mails") there is no focus and the pane is unchanged. Works on an R8m "Sent by …" row and in Sent |
| R18 | A Sent row shows **our** words, our time, and "To: …" |
| R36 | **Your own sent mail is in your Sent whatever mailbox it landed in** (28 Nov) — read only. A mail you sent that landed in a mailbox you may **not** open (another team's) is shown at the end of your Sent as its own group, "📤 Also sent by you · in mailboxes you cannot open", with the mailbox named on the row; it opens a **read-only** reader (no Reply, Forward, Done, owner or move). The server returns **only** messages whose From is your own login or alias, **only** out of mailboxes you may not open, and **only** the ones with no copy in a mailbox you can open, so your Sent is never doubled; nothing else from that mailbox is read. The answer is kept outside `S.threads`, so no Inbox, folder count, Needs owner, My work or search of the mailbox changes |

### Needs owner / To assign

| # | Rule |
|---|---|
| R19 | **Needs owner** = no owner, in the Inbox, not Done, and newer than the team's go-live |
| R20 | Unassigned **but Done** — not in Needs owner, still in the Inbox (this is why the two numbers differ) |
| R21 | **To assign** — the Manager for his own team, the Admin for all nine mailboxes. There is no CRM any more |

### My work

| # | Rule |
|---|---|
| R22 | I own it **or** I replied in it, it is not Done, and somebody wrote to us in it |
| R23 | A conversation I **only sent** — not work, no Done button |
| R24 | Marked Done — leaves My work, stays in the Inbox |
| R25 | Two people replied — it is in both their lists |
| R26 | Somebody else's conversation is never in my My work, **not even the manager's** |

### How a mail gets an owner

| # | Rule |
|---|---|
| R27 | **Replying does not give you the mail** |
| R28 | **Auto-assign**, first hit wins: alias → buyer's domain → "Hi \<name\>" → who replied last → buddy. Only ever on mail nobody owns |
| R29 | **Take / assign / transfer** — a person's choice; an auto rule can never overwrite it |
| R29a | **A conversation can only belong to somebody in the team that owns that mailbox.** The Owner / Assign list is that team only — for everybody, admins included; a one-person mailbox shows the name with no picker; the server refuses a cross-team owner; an Admin moves a conversation with **"Move to team…"**, which leaves it unassigned in the new team |
| R30 | Mail older than the team's go-live never counts as work and never reaches Needs owner |
| R30a | **Old mail is open to the whole team — in Search only** (27 Nov, per team, ON for **Team Alpha** and **Team Pulse**). A conversation whose mails are **ALL older than that team's go-live** can be found by **every member whatever its owner** — but only through **Search** and through **"Show in ‹folder›"** (R17b). It is **NOT in the Inbox list**, so no Inbox and no folder count grows; it is **never work**, it carries **no Done button**, and Take over / Assign / Transfer are taken off it, so its **owner never changes**. One new mail after go-live and it leaves R30a at once and follows R3 again. A deliberate, narrow hole in R3; the switch is **Admin → 📜 Mail rules → R30a → Choose teams**, stored in the shared setting `mail_rules.r30a` |

### Everyone else

| # | Rule |
|---|---|
| R31 | **Admin, Manager, Lead** — see everything in every mailbox they may open |
| R32 | **Team Designing** — exactly the same rules as every other team |
| R33 | **Critical-only** — Priya's narrow view of Vinay's mailbox. Priya has left, so nobody holds it |
| R34 | **Switch ID** — shows exactly what that person sees |

| R13i | **"Ignore conversation" → Archive, and a new mail brings it back** (27 Nov) — ignoring moves the conversation to **Archive** (it used to go to Deleted), tags it "ignored", marks it done and writes "Ignored by ‹name› — moved to Archive"; Undo puts it all back. A **new incoming mail** in it goes to the **Inbox** like any new mail, the tag comes off and the trail says "New mail - back in Inbox" (office-server trigger `rm_ignore_trg`, replaced — it used to send every later mail straight to Deleted for ever). A mail **we** send in it leaves it ignored. "Stop ignoring" takes the tag off at once |

| R17b | **"Show in ‹folder›" from a quoted mail** (27 Nov) — every mail in "Mail trail" and every mail in the reading pane has it in its ⋯ menu. It matches the quoted mail to a real message (Message-ID first, else same sender + within 2 minutes + same subject), asks the server when it is not loaded, then switches folder, clears the chips / topic / search / View ▾ Show filter, draws the row even past the 150-row window, flashes it 3 s and leaves it selected — **without opening it**. It never bends R3 or R15: when they hide the mail it says "This mail belongs to ‹name›", "Not in your mailboxes" or "Only quoted here — this mail never came to this mailbox" |

| R19a | **Every folder shows its unread count** (27 Nov) — Inbox, Archive, Junk, Deleted, "All inboxes", the shared mailboxes and a person's own folders; hidden at 0, **grey for Junk and Deleted**, and the folder **name goes bold** while it holds mail that arrived since it was last opened. The Inbox number is still `inboxUnreadN()`, so the five Inbox counts stay equal; the other folders use the same test with the folder swapped, so R1/R3 and Switch ID are followed. Favourites keep their own list size and only go bold |

| R35 | **Personal mail rules — Settings → 📋 My rules** (27 Nov) — anybody (member, manager, admin) can make rules that change **only their own view**: conditions from address / from domain / subject contains / sent to / has attachment, actions move to one of **my** folders, set topic, flag, mark read; in order, first match wins per action, with a "stop here" tick, on/off, up/down and "Run now on existing mail" with a count first. A rule is a **filter, never a move** — nothing is written to the mail, so the conversation stays in the team Inbox for everyone else and in **Needs owner / My work** until it is owned or done, a manager’s rule has no team-wide power, and **Junk, Deleted and Drafts are never touched**. Stored per person in `rm_users.prefs.mr35` |

### Speed and memory

* **M1 — Rugs Email keeps this tab under 250 MB. MANDATORY: there is no switch, for an admin or anybody else.** Over **200 MB** the page clears its copies early; over **250 MB** it drops every stored mail, attachment, thumbnail and drawn row **except the conversation on screen and the last one you looked at**, and fetches them again when you next need them. It is the ceiling over the five budgets underneath it (loaded mail 35 MB, opened mail 15 MB, attachments 10 MB, thumbnails 4 MB, files being attached 15 MB, drawn rows up to 2,000), and it is measured on the **whole tab** (`performance.memory` in Chrome and Edge), so raising one of those in a later build still cannot take the tab past 250 MB.
  * It touches **no mail**: not a folder, not an owner, not read/unread, nothing on the server. What it drops are copies the browser was holding to be quick — a stripped conversation keeps its row and its preview.
  * Files on a mail somebody is **writing** are never thrown away while that mail is open.
  * **27 Nov, after the live 410 MB freeze:** the thing that grew was not any of those five stores (measured at 1.2 MB, and 9 MB with ten heavy mails open) but **`S.threads` itself** — the conversation and message objects. A real shared mailbox of 15,000 conversations is **123 MB** of those objects alone, and **every search added up to 400 more and every scroll another 500, with nothing ever dropping any of them**. So there is now a cap on them: **2,500 conversations in memory**, oldest by date dropped first, and **never** the one on screen, one drawn in the list, one of the last 60 looked at, or one holding an unsent mail. A dropped conversation comes back from the server the moment you scroll to it.
  * M1 also stopped being able to measure itself: it read `performance.memory`, which Edge **quantises** (a constant 42.6 MB through a whole measured run while the stores really went 1.2 → 9.3 MB), so after every trim it still read "over" and trimmed again every four seconds — **trim → refetch → trim, which is what froze the tab**. It now counts what Rugs Email actually holds, uses a heap figure only to raise that number and never to lower it, waits 30 seconds between emergencies, and stops altogether when a run frees nothing.
  * Read it on any screen: **Admin → 📜 Mail rules → Speed and memory**, which shows the live figure and how often the guard has had to act, or `rzMemCap()` in the browser console. The page's **Checks right now** panel flags a tab at 80% of the ceiling or over it.
  * Why it is mandatory and not a setting: a tab that grew all day is what stopped mail on 26 November ("mail has been stopped on all places, pages are under waiting"), so the ceiling is not something anyone can raise by mistake.

### Things that hide mail which are not ownership rules

`Hide mail from before Go live` (Admin → Old mail — **must stay unticked**), the **View ▾ → Show**
filter (saved per person, the most common cause of "my mail is missing"), the three chips
(Inbox / Unread / Unassigned), the Topics menu, Search, Archive / Junk / Deleted / personal
folders, "Ignore conversation" (now R13i above — it no longer hides mail for ever), snooze, blocked senders, changes made in Gmail, and the first
150 rows being drawn with the rest on scroll. Full list with numbers in `MAIL-RULES.md`, H1–H25.

---

## A+ · THIS LIST IS NOW A PAGE INSIDE RUGS EMAIL

Since build **2026-11-26-23** every rule above is in the app itself, not only in this file:

* **Admin → 📜 Mail rules** — the whole list with the switches, for the admin.
* **Menu under your own name → 📜 Mail rules** — the same list, read-only, for everybody.

**Eight of them are real switches** (R1, R3, R7, R10, R11, R17, R27, C5) plus the
manager-first list (R32) and a shortcut to "Hide mail from before Go live". Every other rule
is shown with a badge saying **Built in**, **Server** or **Not live**, so nobody is offered a
control that does nothing. **Nothing changed when the page shipped** — every switch starts on
the behaviour described above.

Moving a switch **asks first**, and the question carries: what happens the moment you press it
(counted from the mail actually loaded, e.g. *"1,062 of the 1,480 conversations in the Inbox
are marked Done and would leave it at once"*), the **conflicts** with the rest of the app, what
it will **cost**, and who it affects. A change with a conflict needs the "I have read the
conflict — change it anyway" button. Every change is recorded with the name of who made it.

The page also has a **Checks right now** panel which flags the three things that hide mail
without being rules: the Go-live tick, anybody whose View ▾ "Show" filter is set, and any
manager-first team.

## B · AGREED, TESTED, BUT NOT LIVE TONIGHT

These were built this evening and rolled back with the outage. **Do not file bugs against
them — they are not in the app.** They go back on tonight, with the memory fix in the same
build.

| | Rule | Where it is |
|---|---|---|
| **C1** | Unassigned mail leaves a member's Inbox after **30 minutes** (clock 10:00–18:00, stopped Sundays and holidays) and lives under Needs owner | `patch-locked-rules-1.js` |
| **C2** | Replying takes a conversation nobody owns; a manager replying takes it over | same |
| **C5** | Transfer for everybody, and a member may assign to a colleague | now a **switch** on Admin → 📜 Mail rules (off) |
| **R16q** | Mail sent under nobody's name becomes manager-only | same |
| **O4** | Every critical mail in a team is in that manager's My work | same |

Still to build, nothing written yet: **C3** (a manager is asked "should your team see this?"
on every reply), **C4** ("Leave this conversation", leaving a frozen copy), and **C6**
(Priya out, Neha in — parked, you said later). **S1–S16, the Admin → Mail rules switch page,
is DONE** — see section A+ above.

---

## C · Not rules, but new this evening

* **Memory is capped — and since 27 November the 250 MB ceiling over it is rule M1 in list A above, mandatory and with no switch.** Loaded mail on the conversations 35 MB, cache of opened mail 15 MB, attachments 10 MB, thumbnails 4 MB, compose attachments 15 MB, and the row-HTML cache follows the rows really drawn (600 to 2,000 — one row per mail draws about 700). Oldest first, never the conversation on screen. Type `rzMem()` in the browser console to see what the page is holding.
* **Maintenance window.** Rugs Email closes for everyone at **18:52** today and opens again **by itself at 09:30 tomorrow**. You keep access — by your own id, through **Switch ID as anybody**, or with `localStorage.setItem('rugs-maint-ok','1')` in the console if anything ever locks you out.
* The notice board carries it as a pinned bulletin for every Workspace user; it removes itself tomorrow at 09:35.
