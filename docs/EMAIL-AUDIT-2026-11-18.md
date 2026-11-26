# Rugs Email: audit (18 Nov 2026)

How this was checked:
- the app code (`index.html` → EMAIL_HTML_B64, `mail-v2.js`, the Outlook pack)
- the server code (`server/rugs-mail.index.ts`, `rugs-mail-list`)
- the live database
- the last 24 hours of server logs
- the scheduled jobs
- the "NOT tested / pending" notes in `PROGRESS.md`

Nothing was changed while auditing.

**Wiring check (passed):** every server action the app calls exists on the server, and every button the app draws has code behind it. No dead buttons were found.

---

## 1. Bugs: things that are broken now

| # | Problem | Evidence | Effect on users |
|---|---|---|---|
| 1 | **Most attachments are never copied to Google Drive** | 196,705 mails with attachments still waiting (2,200 from the last 7 days alone); 35,240 done. The server copies only 5 files per 30-second run. | Tiles show "saving to Drive…" for ever. "Open in Drive" and the Drive preview do not work for those files. Download (from Gmail) still works. |
| 2 | **The mail server runs out of power many times a day** | `rugs-mail` failed **166 times in 24 h** with error 546: 95 × "CPU time exceeded", 25 × "Memory limit exceeded". The database is on the smallest server (1 GB RAM, about 85 % used) with 2.1 GB of data (1.4 GB is stored email text). | When it hits a person's action (open, send, sync), they get "server busy" or a slow screen. Background sync loses that run. |
| 3 | **Scheduled ("send later") mail never worked until today** | The 30-second run synced 9 mailboxes first and was out of time before sending (`"scheduled":0` every run). **Fixed today (v41).** | No user mail was lost: the queue was empty before today. Already fixed; listed for the record. |
| 4 | **Unread counts could be wrong** (Imran saw 698; the server had 26) | The copy kept in each browser re-reads only the last 60 days. **Fixed today** (old copies are dropped once). | The same drift can still happen for **other** changes to mail older than 60 days (folder moves, Done, owner changes). |
| 5 | **The "designer@" mailbox does not load** | Status "backfilling · scanned 0, saved 0" on every run. | Designer team mail may be missing in the app. Needs a look. |
| 6 | **"Empty Deleted" skips the server's delete permission check** | It sets folder `purged`; the server checks the delete right only for folder `deleted`. | Someone without the delete right could empty Deleted with a hand-made request. Low risk. |
| 7 | **"High importance" shows only on mail WE sent** | Importance of received mail is not stored (no column; sync does not read the header). | A buyer's urgent mail looks normal. |
| 8 | **Calendar invites** | `rugs-mail-cal` returned 502 four times in 24 h. Answering an invite (Accept/Decline) has never been tested live. | Accept/Decline may fail. |

## 2. Options that exist but do not work, or only half work

| Option | What happens |
|---|---|
| **AI features** (AI write, AI topics, translate by AI) | Gemini has been **paused since 24 Oct**. Topics now come from keyword rules; AI writing does nothing. |
| **Open in Drive / Drive preview** of attachments | Works only for the minority of files already copied (see bug 1). |
| **Forward as attachment (.eml)** | The forwarded mail goes without its own attachments (only their names are listed). |
| **Delete (inside the app)** | Notes say the wording "original stays in the company mailbox" was never updated, but Delete now moves the mail to **Gmail Trash** (Gmail empties it after 30 days). Text and action do not match. |
| **Sent folder "only mine"** | Mail sent from Outlook under a shared name (e.g. "team alpha", 372 messages) cannot be traced to a person, so every team member still sees it. |
| **Admin → Old mail → "Hide mail from before Go live"** | It works, but ticking it hides **everything older than 16 Nov 10:55** from every list. Easy to press by mistake. |
| **Teams with nobody in them**: Team Shipping, Mis, Team Bhawna | Their mail arrives, but no team member or manager exists to assign it, so it waits for the admins / CRM. |
| **People with no team**: Anand Kumar, Karamjot Singh, "packaging", "Orderupdate" | They sign in to an empty team view. |
| **Topic tags** | 419 conversations from the last 2 days are not tagged yet. |
| **Picture fetcher** (`rugs-mail-list` img) | About 400 "not found" per day. **Normal**: those pictures are private on the sender's side. Not a bug. |

## 3. Built today, not yet tested in a real browser

All of these passed code checks (all 41 scripts in `index.html`) and Node simulations, but nobody has clicked them on screen yet:

1. Downloads keep the original name and type, plus the one-click ⬇ on each attachment tile
2. PDF preview with PDF.js (pages, zoom, page number)
3. "Getting your mail ready" loading screen and preload (25 conversations, 3 at a time)
4. Admin → Users → **Delete user** (server v46 is live)
5. Automatic "new version" refresh of open pages (`mail-version.txt`)
6. A reload keeps your place (page, folder, filters, open mail)
7. Fresh unread counts (old browser copies dropped)
8. Outlook pack items noted as unconfirmed on 17 Nov: the hover-bar Read/Pin buttons and the pre-send warning strip

Also left over on the server: test functions `rugs-mail-v37-test` and `rugs-sa-modify-test` are still deployed. They can be deleted.

## 4. Missing features the tracker needs

Ordered by how much they would help the team, first to last.

1. **Fix the server size / storage first.** Move old email text out of the database (to Storage or Drive) and keep only recent mail in full, or upgrade to the Small server ($5/month more). Bugs 1 and 2 come from this.
2. **Personal read status.** Today one person opening a team mail marks it read for the whole team. Each person should have their own read/unread.
3. **Buyer 360 view.** One page per buyer (buyer code): every conversation across all mailboxes, open promises, samples and orders, using the buyer list already in the Workspace (`deleg_buyer_emails`).
4. **Link a conversation to an order / sample (IO / PO number)**, so it shows in PPC and Sampling and can be searched by order number.
5. **Escalation.** A buyer mail unanswered after X working hours goes to the team manager, then to the admin, with a daily "late replies" mail.
6. **Announcement tool.** Send one notice to many buyers (pick team or buyer list, one mail per company, schedule, see who got it). Today's "new email IDs" notice had to be done by hand in the database.
7. **Phone notifications** (web push) when a mail is assigned to you or a buyer replies, even with the app closed.
8. **Approval before sending** for interns and new staff: their mail waits for the manager's OK.
9. **Admin activity log.** Who deleted or deactivated a user, changed roles, emptied folders, or switched ID, with the date.
10. **Admin health page.** Sync status per mailbox, server errors today, Drive copy backlog, scheduled-mail queue, all on one screen.
11. **Sign in with Google** (company account) instead of separate Rugs Email passwords, or at least two-step login for admins.
12. **Templates with fill-in fields** ({buyer}, {order no}, {ship date}) for the replies merchants send every day.
13. **Store "importance" for received mail** and show buyer-urgent mail first.
