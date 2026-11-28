# Ashish Deshwal's Sent folder — 28 Nov 2026

App builds **2026-11-28-3 → -5**, server **2026-11-28-b/c**. All live, all measured against the
real office server and the real published site (read only except the one-time job).

## 1 · The first fault: the rule, not the mail

Measured first (admin token, then a real Switch ID session as him): **4,888** mails of his since
**11 Mar 2026** across **10 mailboxes**, 4,566 already `direction='out'`, and **`sent_by` NULL on
4,803** because he writes in Gmail, not in Rugs Email. The app's rule was:

```js
colleagueIn(m,t) = m.ours && !m.by && m.email && m.email !== t.box
Sent shows a conversation when  t.msgs.some(m => m.by || (m.ours && !colleagueIn(m,t)))
```

His mail is "ours", has no `sent_by`, and its From (his own login `merchandiser9@`) is not the
shared mailbox address — so `colleagueIn` said TRUE, "a colleague wrote in", and **his own mail
counted as mail received**. Anybody writing from their own login into a shared mailbox had it.

**Now:** one helper `sentByUs(m,t)` — a From that is a person's **login or alias** means that
person sent it, in whatever mailbox it lands — used by the Sent folder, the per-mail rows (R17)
and R15, so they cannot drift apart. `recvMsg`/`colleagueIn` untouched, so the mail is **still**
received mail for the mailbox: Inbox, Needs owner and the work lists do not move (proved by
running one fixture on the build before and after and comparing every list for four people).
R15 still decides who sees it: the sender does, a colleague does not, manager/lead/CRM/admin do.

**Data repaired** by one-time job `ashish-sent-2026-11-28` (one transaction, undo in
`rm_settings.undo_ashish-sent-2026-11-28`): **322** messages not marked `out` → fixed (`sent_by`
set on those), **1** stale `has_out` → rebuilt. The 4,803 without `sent_by` were deliberately
**not** mass-written: `sent_by` switches off `colleagueIn`, which is what keeps a colleague's mail
in the team **Inbox** — writing it could have emptied work out of Team Pulse's Inbox.

**Robin** (Robin Vos, Loods 5 — r.vos@loods5.nl): 28 of his mails, 7 conversations, newest 13 Nov.
In a search session **7 of 7 now in his Sent**, against 2 of 7 before.

## 2 · "Still not showing" — it was the To: column

Driven on the real site as him: his Sent held **154 conversations / 684 rows, newest 27 Nov**, all
attributed to him. The mail was there; the rows read:

```
To: As mentioned, kindly let us know immediately if you have any
To: [Une image contenant Police, Graphique, capture d'écran, gra
To: [Loods 5 Home]<https://eu.content.exclaimer.net/?url=http%3A
To: [cid:image001.jpg@01DD4CD7.8B8AEC40]<https://www.groupe-jja.
```

Three causes, all fixed:

1. `parseSig()` took a mail's **first signature line** as the contact's name — so body text,
   Exclaimer banners and `[cid:…]` markers became names (**33 of his 327 contacts**).
2. `sentTo()` took the **first** `<…>` in a To part as the address; in a Loods 5 header that is a
   link.
3. When no clean recipient could be picked it fell back to the **raw header text**.

**Now:** a shared `goodName()` guard (no markup, no address, no link, no quoted header, letters in
it, ≤5 words, not a sentence, ≤48 chars) in `parseSig`, `contacts()` and `sentTo()`; the **last**
address in a part is taken; the fallback is an address, then the conversation's counterpart, else
nothing. A name somebody typed stays as typed.

Measured after, live: **684 rows, 0 junk, 0 blank** — "M Wedman", "Lily-Sue Martin",
"Kloe RAMTAHAL", "Jarratt, Fiona", and 75 rows naming several recipients
("Lisa MARIE, Selver EMSEN, Enora GUEGUEN +1"), which is correct.

## 3 · Known limits, reported not hidden

- A conversation in **Deleted** is never in Sent (2 of his).
- Mail older than the loaded window needs scrolling or a search; a session paged back past
  2,500 conversations drops the oldest by rule **M1** (they come back when scrolled to).
- About **53** of his 4,888 sent mails live **only** in mailboxes he has no access to (vinay@,
  shipping@, designer@ …). Of the 1,317 outside his own mailbox, the rest are the same mail
  delivered to teampulse@ as well, which he can see. Opening those others up would be a new
  rule — say the word.
- Everybody must be on build **2026-11-28-5**; the build bump makes an open tab reload by itself
  within a minute unless somebody is in the middle of writing.

## Files

`server/patch-sent-by-login.js` · `server/patch-onetime-ashish-sent.js` ·
`server/patch-server-job-detail.js` · `server/patch-contact-names.js` ·
`server/patch-sent-to-fallback.js`

Tests: `test-sent-by-login.mjs` (23) · `test-sent-before-after.mjs` (14) ·
`test-ashish-sent-live.mjs` (10) · `test-ashish-robin-live.mjs` (10) ·
`test-contact-names.mjs` (13) · `test-ashish-real-browser.mjs` (10, against the live site) ·
`measure-ashish-sent.mjs` (measurement only).

Never touched: `deleg_private_details`, `deleg_google_tokens`, `dev_secrets`, `pass_hash`.

---

# Part 2 — 28 Nov, afternoon: "he sent a mail to a buyer and it is not in Sent"

## 4 · The mail in the screenshot IS in his Sent — measured

Gmail search `in:sent robin` in **teampulse@**, the open mail "Re: New order", Fri 27 Nov 4:05 pm,
to Maud Wedman, Robin Vos, Priya, Noorul. In the live database that is the teampulse@ conversation
"New order", last mail **2026-11-27 10:35 UTC = 16:05 IST**, 7 mails, owner Ashish. Driven as him
(a real Switch ID session, the shipped build, read only): that conversation **is in his Sent** —
`sentByUs` true, `msgMine` true, R15 `sentSeen` true, R3 `seeMine` true — and the mail was sent
**through Rugs Email** (`sent_by` = his id), from the shared address teampulse@.

## 5 · What really is missing — and it is R15, working as written

All Loods 5 mail his session can reach (two searches, `to:loods5.nl` and `from:loods5.nl`,
428 conversations in memory):

| | |
|---|---|
| conversations with Loods 5 in them | 93 |
| of those, ones we wrote in | 67 |
| **shown in his Sent** | **42** |
| **not shown** | **25** — every one of them `sentSeen` = false |

The 25 hold **no mail of his at all**. Every mail we sent in them was written by
**Shubham Aneja (dmm1@)** — 71 mails — or **Vinay Chugh (vinay@)** — 7 mails — from their own
logins. **R15** keeps a colleague's sent mail out of your Sent, so they are hidden from him by
design, and would be hidden from Shubham's colleagues in the same way.

**So the difference he is seeing is Gmail vs Rugs Email, not lost mail:** Gmail's Sent in
teampulse@ is the **whole team's** sent mail; Rugs Email's Sent is **yours** (plus, for a
manager / lead / CRM / admin, everyone's). Nothing is missing from the database.

**If the team wants Gmail's behaviour** that is a change to R15 — e.g. a "Team" switch on the
Sent folder that shows everything the shared mailbox sent, with who sent it on each row. It was
not built, because R15 is a locked rule and that is the user's decision.

## 6 · What WAS built: rule R36 — your own sent mail, wherever it landed (app 2026-11-28-7, server 2026-11-28-d)

The gap that IS real: of his 4,888 sent mails, **1,317 landed in mailboxes his session is never
given** (vinay@ 605, shipping@ 390, designer@ 253, teamalpha@ 40, dmm3@ 13, merchandiser1@ 8,
neetu@ 6, mis@ 1, marketing@ 1) and he cannot open those mailboxes at all.

R36: your **own** sent mail is shown in your Sent whatever mailbox it landed in — **read only,
your mail and nothing else from that mailbox**. New server action `mysent`
(`server/patch-mysent-server.js`): only messages whose From is **your own login or alias**, only
out of mailboxes you may **not** open, and only the ones with **no copy in a mailbox you can
open**, so Sent is never doubled. The app (`server/patch-mysent-app.js`) keeps the answer in its
own list, **outside `S.threads`** — so no Inbox, no folder count, no Needs owner, no My work and
no rule can see it — and draws it as its own group at the end of Sent
("📤 Also sent by you · in mailboxes you cannot open"), each row naming the mailbox and marked
read only; a click or Enter opens a read-only reader (no Reply, Forward, Done, owner or move).
Escape or ✕ closes it. An admin, who may open every mailbox, gets nothing — by construction.

Tested: `server/test-mysent-36.mjs` — **55 checks, 0 failed, no page errors** (group and counts,
the To: column out of a junk header, the read-only reader, keyboard, chips, search, redraw,
Switch ID, a refusal said in words, an empty answer staying silent, phone width, light and dark,
and the mail list proved unchanged). Regression `test-sent-by-login.mjs` 23/23, all 127 scripts
parse, both patch scripts are proved to leave their file identical when run twice.
