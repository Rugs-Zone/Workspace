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

### Everyone else

| # | Rule |
|---|---|
| R31 | **Admin, Manager, Lead** — see everything in every mailbox they may open |
| R32 | **Team Designing** — exactly the same rules as every other team |
| R33 | **Critical-only** — Priya's narrow view of Vinay's mailbox. Priya has left, so nobody holds it |
| R34 | **Switch ID** — shows exactly what that person sees |

### Things that hide mail which are not ownership rules

`Hide mail from before Go live` (Admin → Old mail — **must stay unticked**), the **View ▾ → Show**
filter (saved per person, the most common cause of "my mail is missing"), the three chips
(Inbox / Unread / Unassigned), the Topics menu, Search, Archive / Junk / Deleted / personal
folders, "Ignore conversation", snooze, blocked senders, changes made in Gmail, and the first
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

* **Memory is capped.** Loaded mail on the conversations 35 MB, cache of opened mail 15 MB, attachments 10 MB, thumbnails 4 MB, compose attachments 15 MB, and the row-HTML cache follows the rows really drawn (600 to 2,000 — one row per mail draws about 700). Oldest first, never the conversation on screen. Type `rzMem()` in the browser console to see what the page is holding.
* **Maintenance window.** Rugs Email closes for everyone at **18:52** today and opens again **by itself at 09:30 tomorrow**. You keep access — by your own id, through **Switch ID as anybody**, or with `localStorage.setItem('rugs-maint-ok','1')` in the console if anything ever locks you out.
* The notice board carries it as a pinned bulletin for every Workspace user; it removes itself tomorrow at 09:35.
