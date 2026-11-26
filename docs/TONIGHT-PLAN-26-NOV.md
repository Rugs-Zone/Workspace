# Rugs Email: tonight's plan (26 to 27 Nov 2026)

**Goal:** by morning Rugs Email shows every mail correctly, follows the locked rules, looks clean, is secure and has been tested.
**Window:** now until **09:00**. The app reopens **by itself at 09:30** (per MAIL-RULES-LIVE.md). If you want it open at 9:00, tell the terminal to change that time.
**Starting build:** `2026-11-26-22`

---

## 0 · How we work tonight (read this once)

### Roles
| Who | Job |
|---|---|
| **You (Priyanshu)** | Owner and tester. You show me bugs (screenshot, drawing or example), click-test, and say "OK" or "not OK". |
| **Me (this chat)** | Team manager. I keep the plan, turn your bug reports into exact terminal tasks, and check each one against the rules. |
| **Terminal: Account A** | **BUILDER.** It is the only one allowed to change code (`index.html`, `.tmp/email.html`, server). |
| **Terminal: Account B** | **TESTER/REVIEWER.** It reads code, checks the database, looks at the browser and writes bug notes. **It never edits `index.html`.** |

### The one golden rule for two accounts
**Never let A and B change files at the same time.** Your folder auto-commits and pushes after every reply. If two terminals edit `index.html` together, one overwrites the other and work is lost.
- While A builds, B only **reads and tests**.
- When A hits its limit: A writes a 3-line handoff at the bottom of `PROGRESS.md`, **you close A**, then B becomes the builder.

### Opening a terminal (fresher steps)
1. Double-click **`Rugs Claude.bat`** in the Workspace folder. The terminal opens already in the right folder.
2. Sign in with the account you want (A or B).
3. Paste the task prompt I give you. Wait for its one-line "done".
4. **One bug per chat.** After each bug, type `/clear` (or close and reopen), so the chat stays small and saves your limit.
5. If you see **"UPLOAD FAILED"**, stop. Paste this: `Run git status and fix the upload before anything else.`

### How to report a bug to me (copy this format)
```
Bug: <one line>
Who: <whose ID: Switch ID as ...>
Where: Inbox / Sent / Needs owner / My work / Compose / ...
Expected: <what should happen, rule number if you know it>
Actual: <what happened>
Screenshot/drawing: attached
```
I'll check it against **MAIL-RULES-LIVE.md (list A)**. If what you want conflicts with a locked rule, I'll tell you **before** any code changes, so we fix the rule first and then the code.

---

## 1 · Decisions you must give me (before Phase 3)
These are open in `MAIL-RULES-LOCKED.md`. The code for them is written but must not go live on a guess.

| # | Question | My suggested answer |
|---|---|---|
| O1 | 30-minute clock: 10:00 to 18:00 only. **Stopped on Sundays and holidays too?** | Yes, and holidays come from one list the admin edits |
| O2 | Two owners: one member seat plus one manager seat, never two members | Yes, as written |
| O3 | "Leave this conversation" leaves a frozen copy at the date you left | Yes, but build it **later**, not tonight |
| O4 | Every critical mail in a team also sits in the manager's My work | Yes |
| R16q | 372 mails sent under "Team Pulse / team alpha" become manager-only | Yes |

---

## 2 · The night, phase by phase

| Time | Phase | Account | Done when |
|---|---|---|---|
| 20:50 to 21:20 | **P0 Safety and bug intake** | B | Backup tag made; your bug list written in `BUGS-TONIGHT.md` |
| 21:20 to 23:00 | **P1 "Mail not showing" bugs** + memory fix + **R17 row-per-mail back on** | A builds, B tests | Every mail visible at its own time in Inbox and Sent for 3 test users |
| 23:00 to 00:30 | **P2 Known bugs from the audit** | A builds, B tests | Items below are fixed or marked "not tonight" |
| 00:30 to 01:30 | **P3 Locked rules from list B** (C1, C2, C5, R16q, O4) | A builds, B tests | Only after section 1 is answered |
| 01:30 to 03:00 | **P4 Design / UI / UX**: fonts, themes, letters, signature | A builds, B reviews screenshots | Checklist in section 4 passes |
| 03:00 to 04:00 | **P5 Security pass** | B finds, A fixes | Section 5 passes |
| 04:00 to 06:30 | **P6 Full regression test**: all 34 live rules × roles | B (and you) | Test sheet all green or bugs logged |
| 06:30 to 08:00 | **P7 Fix what P6 found** | A | No red items left that are "must" |
| 08:00 to 09:00 | **P8 Freeze**: final build, version bump, PROGRESS.md, smoke test | A | Build number noted; app opens at 09:30 |

Sleep or break: take 15 minutes at **00:30** and **04:00**. A tired tester misses bugs.

---

### P0 · Safety and bug intake (Account B)
Paste into terminal B:
```
Read the last 30 lines of PROGRESS.md and MAIL-RULES-LIVE.md. Do not edit any code.
1) Run git status. If clean, create git tag "before-night-26nov" and push the tag.
2) Create BUGS-TONIGHT.md with columns: #, bug, who, rule, status (open/fixed/tested), build.
Reply in one line.
```
Then send me your bugs one at a time (format above). I add each to the list with its rule number.

### P1 · Mail not showing correctly (top priority)
Known causes from your notes. We check these first for every "mail missing" bug:
1. **View ▾ → Show filter** saved per person (the most common cause)
2. Admin → Old mail → **"Hide mail from before Go live" is ticked** (must stay unticked)
3. Only the first 150 rows are drawn; the rest appear on scroll
4. Per-mail rows (**R17**) are not live yet, so a newer reply "hides" the older mail's time
5. The browser's stored copy is out of date (unread count drift)

Builder task (Account A), once your bug examples are in:
```
Read MAIL-RULES-LIVE.md list B and the last 30 lines of PROGRESS.md.
Put R17 (patch-lock-row-per-mail.js) back live together with the memory fix, in one build.
Use the mailapp-b64 decode → patch → encode flow. Bump APP_BUILD and mail-version.txt.
List window must count conversations, not rows. Update PROGRESS.md. One line reply.
```
Tester task (Account B):
```
Do not edit code. Using Switch ID as one member, one manager and admin in Team Alpha,
check: 3 mails in one thread show as 3 rows with their own times; clicking each opens
that mail; Sent keeps our mail at its own time; counter says "conversations".
Write results into BUGS-TONIGHT.md. One line reply.
```

### P2 · Known bugs from the 18 Nov audit (pick in this order)
| # | Bug | Tonight? |
|---|---|---|
| 6 | **"Empty Deleted" skips the delete-permission check** (security) | **Yes, must** |
| 5 | **designer@ mailbox does not load** ("scanned 0, saved 0") | **Yes**, it is "mail not showing" |
| 4 | Unread count drift from old browser copies | Check it is still fixed |
| 7 | "High importance" not stored for received mail | Yes if time allows |
| – | Delete button text says "original stays" but it goes to Gmail Trash | Yes (text only, 5 min) |
| – | Forward as attachment loses attachments | Later |
| 1, 2 | Drive copy backlog / server CPU limits | **Not tonight**: this is the server-size decision (Supabase self-hosting plan) |

### P3 · Locked rules going live (list B)
Only after section 1 is answered. One rule per chat: **C5** (transfer for all) → **C2** (two seats) → **R16q** → **O4** → **C1** (30-minute clock, the riskiest, last).
Not tonight: **C3, C4, S1–S16 switch page, C6 (Neha)**.

---

## 4 · Design / UI / UX checklist (P4)
Show me a screenshot or a drawing of anything you don't like; I'll turn it into a task.

**Fonts and letters**
- [ ] One font family across list, reading pane and compose (no mixed fonts in one screen)
- [ ] Sizes: list 13 to 14px, reading body 14 to 15px, headings clear; nothing below 12px
- [ ] Buyer mail keeps its own formatting but never breaks the page width
- [ ] Hindi and special characters (₹, é, ü for German buyers) display correctly

**Themes**
- [ ] Light and dark both readable: text contrast at least 4.5:1
- [ ] Unread rows are clearly bold in both themes
- [ ] RugsCreation orange used only for actions and highlights, not body text

**Signature**
- [ ] Each person's signature appears **once**, in new mail, reply and forward
- [ ] Logo/image in the signature shows in the buyer's Outlook and Gmail (send a test to your own Gmail)
- [ ] No double signature when replying to a reply

**Functionality / UX**
- [ ] Row shows: name, subject, own time, owner name, attachment icon, critical tag
- [ ] Clicking a row opens that exact mail (R17)
- [ ] Compose: To/Cc autocomplete, attachment upload and remove, send-later works
- [ ] Empty states say something useful ("No mail needs an owner")
- [ ] Mobile phone width: list and reading pane usable, buttons at least 40px tall
- [ ] Loading screen does not hang for more than 5 seconds

---

## 5 · Security checklist (P5)
| Check | Why |
|---|---|
| **Empty Deleted** permission check on the server | Audit bug 6 |
| **Maintenance bypass** `localStorage 'rugs-maint-ok'`: must be checked on the **server/role**, not only in the browser | Right now anybody who knows the key could open the app during maintenance |
| **Switch ID**: admin only, and logged | One person must not read another's mail by mistake |
| Buyer mail HTML shown in a **sandbox** (no scripts run, remote images handled safely) | Stops a bad mail from running code in the app |
| No keys or secrets in `index.html` / `mail-app.html` (only the public anon key) | Code is on GitHub |
| Supabase **advisors** (security) run, RLS on the mail tables | Database safety |
| Never touch `deleg_private_details`, `deleg_google_tokens`, `dev_secrets`, `pass_hash` | Project rule |
| Delete the leftover test functions `rugs-mail-v37-test`, `rugs-sa-modify-test` | **Ask you first**, since deleting is permanent |

---

## 6 · Regression test sheet (P6)
Test each with **Switch ID** as: Admin · Manager (Jagjit) · Member (Gulab) · Member (Imran) · Team Designing member.

| Area | Rules to tick |
|---|---|
| Inbox | R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12 R13 |
| Sent | R14 R15 R16 R17 R18 |
| Needs owner / To assign | R19 R20 R21 |
| My work | R22 R23 R24 R25 R26 |
| Ownership | R27 R28 R29 R30 |
| Roles | R31 R32 R33 R34 |
| Plus | Search "4815" puts that mail on top · send and receive a real mail · attachment open/download · PDF preview · reload keeps your place |

Mark each one ✅ / ❌ in `BUGS-TONIGHT.md`. Every ❌ goes to P7.

---

## 7 · Freeze (P8), last hour
1. No new features after **08:00**, only fixes for ❌.
2. Final build: APP_BUILD and `mail-version.txt` the same number.
3. `PROGRESS.md`: one line per thing changed tonight.
4. Smoke test as one member: open Inbox, open a mail, reply, check Sent.
5. Confirm "UPLOAD FAILED" never showed. App opens itself at 09:30.
