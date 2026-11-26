# Your answers on the mail rules — examples, and what I understood

Written against `MAIL-RULES.md` (build 2026-11-26-15). **Nothing in the app has been changed
yet.** This is only the reply to your notes, so you can say yes / no and then we lock it.

Names used in the examples are the real ones: **Team Pulse** = Shubham (Manager), Ashok, Arun,
Ashish, Jatin. **Team Alpha** = Jagjit (Manager), Imran, Gulab, Viney, Abhishek.
Buyers: Induskrafts, Linear Ideas, de Eekhoorn.

---

# Part 1 — The changes you asked for

Each one says what I will build, and the places marked with a question need one word from you
before I touch anything.

## C1 — from R1: unassigned mail is shared for 30 minutes only

**You wrote:** if nobody gets it auto-assigned, it shows in the members' Inbox for thirty
minutes, then it goes to Needs owner; the manager sees it in the Inbox **and** in Needs owner.

**What I will build**

| Time | Ashok, Arun, Ashish (members) | Shubham (Manager), Admin |
|---|---|---|
| Mail arrives 11:00, no owner | in the Inbox | in the Inbox + in Needs owner |
| 11:00 - 11:30 | anyone can open it and take it | same |
| After 11:30, still nobody took it | **out of the Inbox**, now only under **Needs owner** | unchanged - still in the Inbox |
| A member replied before 11:30 | it is his (see C2), stays in his Inbox for good | sees it with his name on it |

**Three things to confirm**

1. The 30 minutes count from the time the **mail arrived**, not from when the person signed in - so a mail that lands at 7 pm is already out of the members' Inbox by morning. Right?
2. After 30 minutes a member can still see it under **Needs owner** and take it from there. Right? (If not, only the manager could ever hand it out.)
3. "Needs owner" is where it lands. Should I rename that page to something plainer, e.g. **"Nobody has taken it"**?

## C2 — from R5 + R6 + R27: replying makes you the owner again

**You wrote:** if someone replies to that email they become the owner. And: if the owner is
already doing the conversation and the Manager replies, the owner must **not** change.

**What I will build** - replying sets the owner **only when nobody owns it**:

| Who replies | Mail has no owner | Mail is already Arun's |
|---|---|---|
| Ashok (member) | **Ashok becomes the owner** | owner stays **Arun** |
| Shubham (Manager) | **Shubham becomes the owner** (+ the question in C3) | owner stays **Arun** |

This is the safe half of what you asked. The reason replying was switched off on 26 Nov is that
it used to overwrite a manager's choice: Priya gave a conversation to Gulab, Jagjit replied from
a browser whose copy was out of date, and Gulab silently lost it. With "only when nobody owns
it", that cannot happen again.

**This also answers R6** - in your screenshot Arun had only *replied*, so the mail was still
unassigned and the whole team could see it. With C2, Arun's reply makes it his, it disappears
from Ashok's Inbox, and Shubham still sees it.

## C3 — from R5: when a Manager replies, ask whether the team should see it

**You wrote:** when the manager replies, before sending it will ask "show your members or not",
and if yes, with whom. Only where the owner is the manager.

**What I will build** - Shubham presses Send on a conversation nobody owns. Before it goes:

> **Should your team see this conversation?**
> ( ) No - keep it to me
> ( ) Yes - these people: Ashok / Arun / Ashish / Jatin
> [ Send ]

He becomes the owner; the people he ticks keep seeing the conversation in their Inbox and in the
trail, exactly as if it had been shared with them.

**Two things to confirm**

1. The question appears **only** when the manager is taking a conversation nobody owns. When he replies inside a conversation a member already owns, there is no question and nothing changes (your own example). Right?
2. Should his choice be remembered for that conversation (asked once), or asked on every reply?

## C4 — from R4: Transfer, and "Leave this conversation"

**You wrote:** if someone replied and later a colleague wants to take over, they can transfer
the whole conversation; it then shows for the colleague in Inbox and Sent with the full trail;
the first owner still sees it whatever happens; and if he "marks quit", from that moment he no
longer sees what his colleague is doing.

**What I will build**

1. **Transfer already moves the whole thing** - it is the same conversation, not a copy, so the new person opens it with every earlier mail, the whole trail and both folders. Nothing to change there.
2. **The first owner keeps seeing it** - already true today (anyone who replied keeps the conversation for good). Nothing to change.
3. **New: a "Leave this conversation" button** (this is your "mark quit"). Once he presses it, later mail in that conversation never comes back to him.

**One thing to confirm** - after he presses Leave, should the conversation

(a) **disappear** from his Inbox and My work completely (Search still finds it), or
(b) **stay** on his screen frozen as he last saw it, with no new mail added?

(a) is clean and is what Outlook's "Ignore" does; (b) needs new code to hold an old copy.

## C5 — from R29: who may transfer

**You wrote:** give now authority to transfer the email also.

Today transfer is a per-person switch in Admin -> Users, and it is **already on** for the
executives (Ashok, Arun, Imran, Viney, Gulab all have it).

**What exactly do you mean?**

(a) turn transfer on for **everybody** in every team, so it can never be missing, or
(b) also let a member **assign to a colleague** (not just transfer to another team) - today only Manager / Lead / CRM / Admin can set an owner, or
(c) both.

## C6 — from R33: Priya has left, Neha takes over

**You wrote:** Priya left so now Neha will see; and Neha has one email in which all mails come
in auto CC.

This one I cannot do on a guess - it decides who can see every mailbox in the company.

**I need four answers**

1. **Neha's e-mail address**, and does she already have a Rugs Email login?
2. Her role - **Admin** (everything, can set passwords, change the shared lists) or **CRM for all teams** (sees every team's mail and hands it out, but no admin page)?
3. Vinay's mailbox: Priya saw **only the critical mail** there (claims, shipment delays, cancellations). Should Neha get the same narrow view, or all of it?
4. "All mails come in auto CC" - is that address meant to become **one more synced mailbox** (its own Inbox, like teampulse@), or just an **alias** on her login? And what should happen to Priya's own login - switch it off, or delete it the way Ritesh's was?

---

# Part 2 — The ones you asked for an example on

## R3 — Assigned to a colleague, I never touched it, so it is hidden from me

Induskrafts writes to teampulse@. The alias rule gives it to **Arun**. Ashok never opened it.

* Ashok's Inbox - **not there.**
* Arun's Inbox - there, tagged "Arun".
* Shubham and the Admin - there.

This is the rule that stops a shared mailbox being everybody's mailbox.

## R7 — A conversation marked Done still sits in the Inbox

Ashok finishes "PO 174871" and presses **Done**.

* It leaves **My work** - his plate is clear.
* The row **stays in his Inbox**. Until 26 Nov the "Open" chip hid finished mail; you asked for the chips to be Inbox / Unread / Unassigned, so now there is nothing hiding it.
* If the buyer writes again, it **reopens by itself**, unread, at the top.

**Question:** do you want Done mail **out** of the Inbox (its own "Done" view), or is it right
as it is?

## R8 — Mail we sent that nobody answered

Tuesday 11:00 Ashok writes a fresh mail to a new buyer. Nobody has replied.

* **Sent** - there.
* **Inbox** - not there, because nobody has written to us in it.
* Thursday the buyer answers, and the conversation appears in the **Inbox** at Thursday's time, and stays in Sent.

## R14 — A conversation we wrote in is in Sent, answered or not

Monday the buyer writes; Monday 15:41 Ashok replies.

* Ashok's **Sent** - there, because he sent it.
* Arun's **Sent** - not there.
* Shubham's and the Admin's **Sent** - there (they see everything the mailbox sent).
* The **Inbox** still holds the same conversation as well - see R17.

## R15 — What counts as "my" sent mail

Three ways a mail in Sent counts as Ashok's:

1. he sent it **from Rugs Email**;
2. he sent it **from Outlook as teampulse@** but the From name is his - "ASHOK KUMAR", "Ashok - Rugs Creation";
3. he sent it **from his own address** or one of the aliases on his row in Admin -> Users.

Spelling is forgiving - "Ashok Kumer" or "ASHOK" still matches him. Anything Arun sent under his
own name is hidden from Ashok's Sent.

## R16 — Sent from the mailbox under nobody's name

Somebody in Outlook has their From name set to **"Team Pulse"** - the mailbox, not a person.
Team Alpha alone has 372 of these. There is no name to trace, so instead of making those mails
vanish for everyone, they stay visible to the **whole team**.

**Question:** hide those from members too? Then nobody but the manager would ever see them.

## R18 — The date on a Sent row

One conversation, Ashok wrote in it on 20 Nov **and** on 24 Nov. When every mail had its own
row, all of its rows showed 24 Nov and sat under the wrong day heading. That is fixed.

Today there is **one row per conversation**, so Sent shows it once, at the time of our newest
sent mail - so this fix only does any work if we go back to a row per mail (see R17).

## R20 — Unassigned but already Done is NOT in Needs owner

A buyer mail from 5 Nov that the 17 Nov sweep closed: nobody owns it, and it is Done.

* **Inbox** - there (R7).
* **Needs owner** - **not** there, because that list is live work only.

This is why "Needs owner 8" and an Inbox full of unassigned old rows are both correct at the
same time. They are not the same question.

## R21 — "To assign" versus "Needs owner"

The same pile of mail, two doors:

* **Shubham** gets a "To assign" page, for **Team Pulse only**.
* The **company CRM** (Priya, and Neha after C6) gets it for **all nine mailboxes**.
* **Ashok** gets **no** "To assign" page - for him the same mail is under **Needs owner**.

## R23 — A mail I only sent is not work

Tuesday Ashok forwards a packing list to packaging@. Nobody replies. It does **not** sit in his
My work with a "Done" button waiting - it is simply something he sent, and it lives in Sent.
(This was Vinay's complaint on 17 Nov: a forward kept coming back asking to be marked done.)

## R26 — Somebody else's conversation is never in my My work

Arun owns a live claim from de Eekhoorn.

* Shubham **sees** it - in the Inbox, in the team's lists, in the reports.
* Shubham's **My work** - not there. My work is only what that person must do himself.

This is what I checked when you asked "why have you put the email in my work" - it was Ashok's,
not Shubham's, and the app was right.

## R27 — Today replying does not make you the owner

Priya gave a Team Alpha conversation to **Gulab**. Jagjit then replied in it from a page whose
copy of the mail was older than Priya's decision - so his browser thought nobody owned it and
quietly made **Jagjit** the owner, over the top of Priya. That is why replying was stopped from
setting an owner.

**Your C2 puts it back**, but only when nobody owns it, so that overwrite cannot happen again.

## R28 — Auto-assign, in order

A mail arrives at teampulse@. The server tries these in order and stops at the first hit:

1. **Alias** - it was sent to merchandiser5@, which is on Ashok's row, so **Ashok**.
2. **Buyer's domain** - Admin -> Users says @induskrafts.com is Arun's, so **Arun**.
3. **"Hi Ashok"** at the top of the mail, so **Ashok** (the first name must be unique in the team; "Ashoke" still matches).
4. **Who replied last** in that same conversation.
5. **Buddy** - if the owner is on leave, his buddy.

It only ever touches mail **nobody owns**, and it runs the moment the mail is saved - about 26
milliseconds, not minutes. If none of the five hits, nobody owns it, which is C1's case.

## R30 — Older than Go live never counts as work

A buyer mail from 3 October, pulled in with the year of history.

* **Inbox** - there. **Search** - finds it.
* **Needs owner** - never. **Anybody's open-work count** - never.

Work counting starts at **Go live, 16 Nov 10:55**. Without this rule, 43,000 old conversations
would be sitting on people's plates this morning.

---

# Part 3 — Three notes I could not read

## R10 — login codes (OTP)

You marked **CHANGE**, but ticked Member - Sees and Owner - Sees, which is exactly what it does
today: a mail with a code in it is shown to the **whole team** even if the conversation has an
owner, is tagged **Login code**, and never counts as work. We did that on 20 Nov because codes
were landing in "Other" or in Sent and nobody could find them.

**Question:** what should be different? (Only the person who asked for it - which the mail does
not tell us - or only the manager, or something else?)

## R13 — Archive / Junk / Deleted

Same thing: you marked **CHANGE** with Sees / Sees. Today those three are simply **out of the
Inbox** - the mail is not gone, it is in that folder, and anyone in the team who can see the
conversation can open the folder and read it.

**Question:** did you mean that the "-" in my table was wrong (they can see the folders - true),
or that archived and deleted mail should come **back into the Inbox**?

## R17 — "no emails will be hidden"

What you wrote is what it does today, with one thing left to settle:

* buyer writes 11:00, so **Inbox**, at 11:00;
* we reply 11:01, it **stays** in the Inbox, and our reply shows in **Sent**;
* buyer answers 11:03, the Inbox row **moves up to 11:03**, unread, and opening it shows the whole trail - 11:03 theirs, 11:01 ours, 11:00 theirs.

**Question:** the last line - "older mail will not hide because it is now a new message". Today
it is **one row per conversation** that moves to the newest time, with every mail inside it. On
24 Nov you asked for **one row per mail**, and on 26 Nov you asked me to put it back to one row
per conversation. Which do you want locked? Both are written and tested; it is one line either
way.

---

# Taken as agreed (no note from you)

R2 (auto-assigned mail shows for that member with the owner's name on it - yes, that is what it
does), R9, R11, R12, R19, R22, R24, R25, R31, R32 ("these rules are fixed" - Team Designing is
treated exactly like every other team), R34, and the whole of **H1-H25** and **L1-L5**.

Two of those are worth checking on the live site before we lock anything, because either one can
empty a person's list on its own:

* **H4** - Admin -> Old mail -> "Hide mail from before Go live" must stay **unticked**.
* **H11** - View -> **Show**, saved per person. A stale "Unread" or "Flagged" there filters that person's list for ever and looks exactly like missing mail.
