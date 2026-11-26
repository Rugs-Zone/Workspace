# Bugs — night of 26 / 27 Nov 2026

Rollback point: git tag **`before-night-26nov`** = build `2026-11-26-22` (commit f3e9767).
To go back: `git checkout before-night-26nov -- index.html mail-app.html mail-version.txt`.

Both terminals append to this file. It is set to `merge=union` in `.gitattributes`, so two
people adding lines on the same night can never stop the auto-push.

| # | Bug | Who | Rule | Status | Build |
|---|-----|-----|------|--------|-------|
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
