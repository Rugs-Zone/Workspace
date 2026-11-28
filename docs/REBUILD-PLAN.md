# Rugs Email v2 — rebuild plan (Outlook look, built to last)

Status: **DRAFT — waiting for Priyanshu's approval.** Nothing is built until this is approved.
Written 28 Nov 2026.

---

## 1. The goal in one line

A new Rugs Email that **looks and works like Outlook**, where **every person has their own Sent, read/unread and deleted**, and where **no change goes live without passing its tests**.

## 2. Data safety (nothing is lost)

| Rule | How |
|---|---|
| Gmail stays the master copy | v2 never deletes anything in Gmail. |
| Old app untouched | v1 (`mail.html`, `mail-app.html`, `rm_*` tables) keeps running exactly as today. |
| New tables only | v2 writes only to new tables named `rm2_*`. It reads the existing `rm_messages` / `rm_threads` but never changes them. |
| Backups first | Check the nightly backup on the office server (`backup-log.txt`, E:\rugsmail-backups) is green before the first `rm2_` table is made. |
| Switch is reversible | Staff move to v2 only when you say so; v1 stays available as a fallback for at least 30 days. |

## 3. What changes underneath (why the bugs stop)

| Today (v1) | v2 |
|---|---|
| One shared copy of each conversation; folder/read/deleted is the same for all 6 people | **Per-person state**: each person has their own read, flag, folder and deleted for every message (`rm2_user_msg`). |
| Sent = "guess who wrote it" from the From name | **Sent = mail you sent**, recorded at send time with your user id; Gmail-written mail matched by login/alias once, stored, never guessed again. |
| Deleting in Gmail deletes for everyone | Gmail Trash/Archive never moves mail in v2; only Rugs Email's own actions do. |
| Reply-all addresses guessed from mail text | Addresses taken only from real To/Cc headers, parsed by one tested function. |
| 90+ patch layers wrapping each other | One clean codebase: small modules, one place per rule. |
| A failed send can hang | Every send has a status (queued → sent → failed) stored on the server, with retry; never "stuck". |
| Two Claude sessions editing the same file | v2 lives in its own folder; one session edits it at a time (written in CLAUDE.md). |

## 4. Outlook look — screens, in build order

Each screen is built, tested, shown to you, and approved before the next.

1. **Shell** — blue top bar, left mail-folder pane, message list, reading pane; resizable; light/dark.
2. **Message list** — Outlook rows (sender, subject, preview, time, flags, attachment), Focused/Other, conversation or single-mail view.
3. **Reading pane** — mail exactly as received (safe sandbox), attachments bar, Reply / Reply all / Forward, per-message "…" menu with Delete this mail.
4. **Compose** — To/Cc/Bcc with address chips, signature (the final Heimtextil design), attachments, size check, Send later, Undo send.
5. **Folders** — Inbox, Sent, Drafts, Archive, Deleted, Junk, own folders, rules.
6. **Team layer** (what Outlook doesn't have) — owner, assign, promise/due date, Needs owner, My work, Late, topics.
7. **Search** — Outlook-style search with filters (from, to, has attachment, date, PO number on top).
8. **Admin** — users, departments, rules, Switch ID, server status.

## 5. Testing — "no bug comes"

- **Test cases from today's real bugs** go in first: Arun's Sent (Gmail-written mail), Gmail trash, 24 MB quoted reply, `[cid:image001…]` and `@shadow.outlook.com` in Cc, stuck "Sending…", two people with the same first name.
- **Every rule** in `docs/MAIL-RULES-LIVE.md` becomes a written test.
- **Gate:** a change goes live only if all tests pass (a check runs before the push; a failed check blocks it).
- **Memory rule M1** (tab under 250 MB) is a test too.
- **Staging:** v2 is first published at `www.rugserp.com/mail2.html` for you and 1–2 testers before anyone else.

## 6. Rollout

1. You + 1 tester use `mail2.html` alongside v1 (same Gmail, same data, separate per-person state).
2. One team (e.g. Team Pulse) moves for one week.
3. Everyone moves; v1 stays as fallback for 30 days.
4. v1 retired only after you approve.

## 7. Rough time

About **3–4 weeks** of steady work, one screen at a time (section 4), with something for you to look at every 2–3 days.

## 8. Decisions needed from you before starting

1. Approve this plan (or say what to change).
2. Who is the 1–2 tester(s) besides you?
3. Which team moves first (suggestion: Team Pulse)?
4. Pause new features on v1 during the rebuild (only urgent bug fixes)? — recommended.
