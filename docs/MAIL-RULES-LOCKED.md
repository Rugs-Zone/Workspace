# Mail rules — what is locked, what is left

Your answers of 26 Nov 2026, written down. **Still no code changed** — the four open points at
the bottom change how the code is written, so they come first.

---

## Locked (your answer was clear)

| # | Rule | Locked as |
|---|---|---|
| C1b | After the 30 minutes | **Anyone can still take it from "Needs owner"** — the mail is never stuck waiting for the manager |
| C1c | The name of that page | **"Needs owner"** stays |
| C3a | A Manager replying is asked "should your team see this?" | **Every time he replies**, in any conversation |
| C5 | Transfer rights | **Both** — transfer on for everybody, and a member may assign to a colleague |
| R7 | Mail marked Done | **Stays in the Inbox** |
| R10 | Login codes | **Whole team sees them**, unchanged |
| R13 | Archive / Junk / Deleted | Behaviour is right — my table was unclear |
| **R17** | The mail list | **One row per mail, each with its own time** |
| S0 | The switches page | **Build it together with the rules** |
| C6 | Priya out, Neha in | **Later** — parked until you give the four details |

### What R17 means in practice

This is the big one, and it is already written and tested from 24-26 Nov, so it goes back on:

* Aman writes at 17:34, Ashok replies at 18:42, Manfred writes at 20:21 → **three rows**, each at its own time with its own name, instead of one row called "Manfred Mui, 8:21 pm".
* Clicking the 17:34 row opens **that mail**, not the newest one.
* Your R8 note — "the sent one will stay in Sent and the new mail comes in the Inbox" — is exactly what per-mail rows give you: our mail keeps its row in Sent at its own time, their mail has its own row in the Inbox.
* The two things that broke last time are fixed and tested: the list window counts **conversations**, not rows (so the Inbox reaches as far down as it always did), and the counters say "150 of 15,000 **conversations**".

### Your two notes that remove work

* **R15 / R16 — "they only use Rugs Email now."** Then the sender is always known, and the guesswork of matching an Outlook From name to a person stops mattering for new mail. It still matters for the mail already in the database (Team Alpha alone has 2,576 sent messages from six people, 372 of them under the name "Team Pulse" or "team alpha").
* **R21 / R27 — "there is no CRM."** With Priya gone, nobody holds the CRM role, so "To assign" belongs to the **team's Manager** for his own team and to the **Admin** for all nine mailboxes. I will take CRM out of the wording rather than leave a role nobody holds.

---

## R20, explained again — the one you said is still not clear

There are **two different questions**, and the same mail can answer them differently.

1. **"Is this in my Inbox?"** — the Inbox holds **every conversation somebody sent us**, finished or not.
2. **"Is anybody supposed to act on it?"** — "Needs owner" holds only mail that is **(a) not taken by anyone and (b) not finished**.

So a mail can be **in the Inbox and not in Needs owner**, because it is already finished.

**With the real Team Alpha numbers:**

| | Count |
|---|---|
| Conversations in the Inbox (somebody wrote to us) | 1,062 |
| Of those, marked **Done** | 686 |
| Nobody has taken it **and** it is not Done → **"Needs owner"** | **11** |

The other ~675 have no owner's name on the row either — but they are **Done**, so they are not
work. That is why "Needs owner 11" and an Inbox full of rows with no name are both correct at
the same time. The only difference between them is **finished or not finished**.

**Why so many are Done:** on 17 Nov, at your instruction, 43,296 old unassigned conversations
were marked Done in one go — a year of history that nobody was ever going to answer. They all
carry the same stamp (`done_at` = 17 Nov 00:00), so if you want any of them back on people's
plates, that set can be found and reopened exactly, from any date you choose.

---

## Open — four things I will not guess

### O1 — C1a: working hours

You wrote: *"if mail come after 7 am than rule should not react, this rule will run from 10 am to 6 pm only."*

How I read it: **the 30-minute clock only runs between 10:00 and 18:00**. A mail arriving at
19:00 therefore stays in everyone's Inbox all evening and its thirty minutes start at **10:00
the next working day**, so nobody loses it overnight.

Still to settle: **Sundays and holidays** — does the clock stop then too?

### O2 — C2: two owners, one member and one manager

You wrote: *"if jagjit replies and earlier it was with gulab than owner will become two, so one member and one manager can become owner but never member or member."*

How I read it — a conversation has **two seats**:

| Seat | Who fills it |
|---|---|
| **Member seat** | the first member who replies or is given it |
| **Manager seat** | the manager (or admin) who replies or takes it |

* Gulab (member) owns it, **Jagjit (manager) replies** → owners are **Gulab + Jagjit**. Gulab does not lose it.
* Gulab owns it, **Imran (member) replies** → owner stays **Gulab**. Never two members.
* Nobody owns it and **Imran replies** → **Imran** takes the member seat.
* The row would show both names, e.g. "Gulab · Jagjit".

### O3 — C4: the frozen copy

You chose: after "Leave this conversation" it **stays, frozen as he last saw it**.

How I would build it: the conversation **stays in his Inbox at the date he left**, with the
mails up to that moment and nothing after it — no unread mark, it never jumps to the top again,
and it is not in his My work.

### O4 — R26: critical mail is the manager's work

You wrote: *"Critical Mails are a part of work of Managers."*

Today a manager **sees** everything in his team but his **My work** holds only what he must do
himself. Your note changes that for critical mail (claims, shipment delays, cancellations).

How I read it: **every critical conversation in his team is in the manager's My work**, even
when a member owns it — so it is on two plates at once, the member's and his.

### Also parked

* **R16q** — mail sent from the mailbox under nobody's name. Your note ("the person who sent it sees it in his Sent; the manager sees all of it") means those 372 untraceable ones should be **manager only**, since they cannot be proved to be any member's. Confirm and it is locked.
* **R33 / C6** — with Priya gone, nobody is watching **Vinay's mailbox for critical mail**. Part of the Neha decision you parked.
