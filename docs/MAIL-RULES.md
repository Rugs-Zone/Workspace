# Who sees which mail — Rugs Email

Every case that can happen in a shared merchant mailbox (Team Alpha, Team Pulse), with what
the app **actually does today**. Read out of the live code at build **2026-11-26-15**, not
from memory.

Tell me the row numbers that are wrong (e.g. "R6 should be hidden for a member") and I will
change only those, then we lock it.

- **Member** = an ordinary team member, role Executive (Ashok, Arun, Imran…)
- **Owner** = the team owner — Manager, Lead, CRM or Admin (Shubham, Priya, you)
- 🔸 = this moved during 26 Nov, so it is the most likely to be wrong

---

## The two that decide everything

| | Rule | What it means |
|---|---|---|
| **R3** | Mail somebody has **taken** is private | Once a conversation has an owner, colleagues stop seeing it. This is what stops a shared mailbox being everyone's mailbox. |
| **R1 / R6** | Mail nobody has taken is **shared** | The whole team sees it so anyone can pick it up. **This is why Ashok sees Arun's mail.** |

Everything else below is detail around these two.

---

## 1. The Inbox

A conversation reaches the Inbox only if it is in the Inbox folder **and** holds at least one
*received* message — from a buyer, from a colleague, or addressed to this mailbox.

| # | Situation | Member | Owner |
|---|---|---|---|
| R1 | A buyer wrote, **nobody has taken it** | sees | sees |
| R2 | A buyer wrote, **assigned to me** | sees | sees |
| R3 | **Assigned to a colleague**, I never touched it | hidden | sees |
| R4 | Assigned to a colleague, but **I replied in it earlier** | sees | sees |
| R5 🔸 | **I replied to mail nobody had taken** — replying does *not* make me the owner, so it stays unassigned; I keep it because I worked in it | sees | sees |
| R6 🔸 | **A colleague sent mail into the team mailbox**, nobody has taken it — *the Arun case* | sees | sees |
| R7 🔸 | The conversation is **marked Done** — it stays in the Inbox, because the "Open" chip was removed on 26 Nov | as R1–R4 | sees |
| R8 | **Mail we sent that nobody has answered** — not in the Inbox at all, it lives in Sent | — | — |
| R9 | Mail we sent **to our own mailbox** — shows in the Inbox as well as Sent | sees | sees |
| R10 | A **login code (OTP)** — always counts as received and is shown to the whole team even if owned; never counts as work | sees | sees |
| R11 | A **Workspace notification** — its own folder, never in the Inbox or any work list | own folder | own folder |
| R12 | **Automatic mail** (no-reply, newsletters) — the server closes it as Done and tags it "Auto" on arrival; still in the Inbox, see R7 | Done on arrival | Done on arrival |
| R13 | **Archived, Junk or Deleted** — out of the Inbox | — | — |

## 2. Sent

Google gives a shared mailbox **one** Sent folder, so without a rule everyone would read
everyone's sent mail.

| # | Situation | Member | Owner |
|---|---|---|---|
| R14 | A conversation we wrote in — in Sent whether or not the buyer answered | only if he sent it | sees |
| R15 | Mail **a colleague sent**. "Mine" = sent from Rugs Email by me, or from Outlook under my own name, or from one of my own addresses | hidden | sees |
| R16 | Sent from the mailbox under a name that is **nobody's** (e.g. "Team Pulse") — cannot be traced to a person, so it stays with the whole team | sees | sees |
| R17 | A conversation that is in the Inbox **and** that we replied to — it is in **both** places | both | both |
| R18 🔸 | **The date on a Sent row** — fixed on 26 Nov: each row shows its own mail's date. It used to show the conversation's newest sent mail, so mails from different days shared one date | own date | own date |

## 3. Needs owner / To assign

| # | Situation | Member | Owner |
|---|---|---|---|
| R19 | **What lands in "Needs owner"**: no owner, in the Inbox, not Done, and new enough to count as work (since the team went live) | sees list | sees list |
| R20 | **Unassigned but already Done** — *not* in Needs owner, but still in the Inbox (R7). This is why the count and the Inbox disagree | not listed | not listed |
| R21 | **"To assign"** — the same pile, limited to the teams that person is responsible for | no page | sees |

## 4. My work

| # | Situation | Member | Owner |
|---|---|---|---|
| R22 | **What counts**: I own it **or** I replied in it, it is not Done, and somebody wrote to us in it | listed | listed |
| R23 | A conversation **I only sent**, never answered — not work | not listed | not listed |
| R24 | I mark it **Done** — leaves My work, stays in the Inbox | leaves | leaves |
| R25 | **Two people replied** — it is in both their My work lists; only the owner shows on the row | both | both |
| R26 | **Somebody else's** open conversation — never in my My work, not even for the manager (they see it in the Inbox, not on their plate) | not listed | not listed |

## 5. How a mail gets an owner — the only four ways

| # | Situation | Effect |
|---|---|---|
| R27 🔸 | **Replying does _not_ give you the mail** — changed 26 Nov. Before that, replying quietly made you the owner and could overwrite someone else's assignment | no owner set |
| R28 | **Auto-assign**, in order: alias → buyer's domain → "Hi \<name\>" in the text → who replied last in the trail → buddy. They only ever act on mail nobody owns | owner set |
| R29 | **Take / assign / transfer** — a person's choice. An auto rule can never overwrite it | owner set |
| R30 | Mail **older than the team's go-live** never counts as work and never reaches Needs owner | not work |

## 6. Everyone else

| # | Situation | Effect |
|---|---|---|
| R31 | **Admin, Manager, Lead, CRM** — see everything, every folder, in every mailbox they may open. No ownership rule applies to them |
| R32 | **Team Designing** — exactly the same rules. The "manager hands it out" switch exists but is **off** |
| R33 | **Vinay's mailbox, seen by Priya** — only the conversations flagged critical (claims, shipment delays, cancellations), not his ordinary mail |
| R34 | **Switch ID** — opening someone's ID shows exactly what they would see, so a test as Ashok is a true test of a member's view |

---

# Everything ELSE that can hide a mail

These are not the ownership rules — they run on top of them. Any one of them can make mail
"disappear" on its own.

## A. Filters the app puts over the list (in the order they run)

| # | What | Hiding anything now? |
|---|---|---|
| H1 | **Which mailboxes you may open** (`inScope` / department access). Access comes from the **department**, never from the person — this is why a user with no department sees nothing at all | normal |
| H2 | **The folder rule itself** — Inbox needs a received message, Sent needs a sent one | normal |
| H3 | **Workspace notifications** are kept out of the Inbox, All inboxes and every work list | normal |
| H4 | **"Hide mail from before Go live"** (Admin → Old mail). If ticked, *everything* older than 16 Nov 10:55 vanishes from every list and count — Search still finds it | **should be unticked — worth checking** |
| H5 | **The ownership rules** (R1–R6, `seeMine`) | on |
| H6 | **Critical-only mailboxes** — Priya sees only flagged mail in Vinay's box | on, Priya only |
| H7 | **The Sent rule** (R15, `sentSeen`) | on |
| H8 | **"Manager hands it out"** (`mgr_first_boxes`) — hides unassigned mail from members **and switches off auto-assign** for that mailbox | **off everywhere** |
| H9 | **The chips**: Inbox / Unread / Unassigned. "Unread" and "Unassigned" each hide most of the Inbox | whatever is clicked |
| H10 | **The Topics menu** (`lfilt`) — filters to one topic | only if a topic is picked |
| H11 | **The View menu** → Show: All / Unread / Has attachments / Flagged / @Mentions me / To me. **Saved per person**, so a stale choice silently filters that person's list for ever | **easy to leave on by accident** |
| H12 | **Search** — replaces the list entirely while there is text in the box | only while typing |
| H13 | **The 365-day cut** (`in60`) — removed on 26 Nov, now always lets everything through | off |
| H14 | **Only the first 150 conversations are drawn** ("scroll for more") — not hiding, but the rest is not on screen until you scroll | always |
| H15 | **Duplicate-row removal** (`convDedupe`) — one row per conversation | normal |

## B. Things that hide mail by moving or marking it (data, not display)

| # | What |
|---|---|
| H16 | **Archive / Junk / Deleted / purged** — a person's own choice |
| H17 | **Personal folders** — each person's own; only the maker sees them |
| H18 | **"Ignore conversation"** — a database trigger sends every *later* mail in that conversation straight to Deleted. Easy to set by accident from the right-click menu and very hard to spot afterwards |
| H19 | **Anything in Deleted becomes Done** (trigger) |
| H20 | **Mail first saved with its newest message before Go live** arrives **Done + read + no owner** (trigger). This is why the three mailboxes added on 16 Nov look empty of old work |
| H21 | **Automatic mail** (no-reply / unsubscribe header) is closed as Done and tagged "Auto" on arrival |
| H22 | **The 17 Nov sweep** — 43,296 old unassigned conversations were marked Done in one go |
| H23 | **Snooze** — hidden until the time it is set to |
| H24 | **Blocked senders and rules** (the shared lists) can move mail on arrival |
| H25 | **Changes made in Gmail** — archive or delete it in Gmail and the history sync copies that into Rugs Email within a minute |

## C. Not hidden — just not there yet (looks identical on screen)

| # | What |
|---|---|
| L1 | **The sync cursor** — mail Gmail has that the server has not fetched yet. A mailbox that is behind shows nothing newer until it catches up (this was the Aman case) |
| L2 | **`history_days` = 365** — how far back the server loads at all |
| L3 | **Background loading** — the browser gets the newest 30 days first and the rest quietly afterwards |
| L4 | **The copy kept on the device** — refreshed only for conversations changed in the last 60 days, so an old change made on the server can stay stale in one browser until a full reload |
| L5 | **A page on an old build** — the app reloads itself within a minute of a new build, but a tab that was mid-reload can lag |

---

## The one decision still open

**R1 and R6 are the same question, and the two answers cannot both be true.**

| | Option | What you get | What it costs |
|---|---|---|---|
| **A** | **How it is now** — the whole team sees mail nobody has taken | Anyone can pick up unanswered mail; nothing waits on one person | Ashok sees Arun's mail |
| **B** | **Built, switched off** — a member's Inbox holds only their own mail and what they are replying in; unassigned mail sits under "Needs owner" | A member's Inbox is only their work | If nobody looks at "Needs owner", mail waits there |

Option B is already written and tested (including the fix for the bug you caught, where
replying made a mail vanish). Switching between A and B is **one line**.
