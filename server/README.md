# Rugs Email — server fixes (15 Nov 2026) — ✅ APPLIED AND TESTED

All three faults below are **fixed on the live server**. `rugs-mail` is now **v38** and the SQL is in place.

Tested after deploying:

* a Switch ID session really sent a mail (Gmail id `1a1e0873a8de61c4`, teamalpha@ → marketing@) — exactly
  what was refused before;
* every mailbox is **live**, note "scanned N, saved N · history complete", no "could not list";
* "Gmail sent an incomplete reply" went from **8–13 every minute to 0**;
* run time 53–57 s → 25–30 s;
* a 12-hour re-read of all six mailboxes found **nothing missing**, so no mail was actually lost today.

**How `rugs-mail` is deployed now:** the function's own file in Supabase is only a short note plus one
line that pulls in `server/rugs-mail.index.ts` from this repo, pinned to commit `0d17694`. Supabase
copies that file into the function at deploy time, so nothing is fetched from GitHub while it runs.
**To change the server:** edit `server/rugs-mail.index.ts`, push it, and deploy again with the new
commit in that import line — or paste the whole file into the Supabase editor instead.

---

## 1. Why "mail is not going" today (and went yesterday)

Not a bug in Send. At **17:16 IST today** the admin ID (marketing@) used **🔁 Switch ID** to work
as **Imran** (`ik`). One second later the server refused the next action with
**428 "Please set your own password first"**, because Imran has never set his own password
(`rm_users.must_change = true`).

In rugs-mail v36 that rule blocks *everything except reading* — send, reply, assign, transfer.
So on a switched ID you can read mail but nothing goes out. Yesterday you were testing as
yourself (password already set), which is why 3 mails went out yesterday and 0 today.
The app does show a small notice when you switch ("… has not set their own password yet, so you
can read mail but not send or assign"), which is easy to miss.

The same thing will happen to **every person tomorrow until they set their own password** — but for
them the app forces the "set your password" screen at sign-in, so they are fine. It is only the
*switched* admin session that gets stuck.

**Fix:** `rugs-mail.index.ts` (v37) below — a switched session is the admin acting for that person,
so it is no longer blocked. The session is still recorded as `rm_sessions.switched_by = 'adm'`.

## 2. Why the Gmail sync kept failing — the real cause (found after v37 went live)

v37's better error text showed it at once:

```
skip window vinay@rugscreation.com … Gmail sent an incomplete reply
            (status 204, type application/json; charset=UTF-8, 0 chars: )
```

**Gmail answers HTTP 204 "No Content" with an empty body when a time window has no mail in it.**
(Google does that whenever a short reply — our `fields=messages(id),nextPageToken` — would be an empty
object.) The code ran `JSON.parse("")` on it, which throws, so **"nothing found" was handled as a Gmail
failure**. That is where the hundreds of errors came from, and in v36 that window was then marked done
and its mail never fetched. Quiet mailboxes (neetu@, vinay@) failed on almost every run, never reached
"live", and stopped loading older history.

**Fix (v38):** an empty reply, or status 204, means "nothing in this window" — not a failure.

## 3. Why the sync was also overloading itself

The sync is started from three places — the 30-second timer, Gmail push and the app's Sync — and one
run takes 45–55 s in v36, so 3–4 copies run on top of each other all the time. Result on 14–15 Nov:

* "Gmail sent an incomplete reply" — 674 times for shipping@ alone, hundreds per hour across all boxes
* HTTP 546 (server out of resources) — 181 times, until 00:25 today
* **and the real damage:** when Gmail fails to list a time window, v36 marks that window done and moves
  the cursor past it, so mail that arrived in those minutes is **never fetched**

**Fix:** v37 — one sync at a time (lock), 25-second runs, a window Gmail could not list keeps the cursor
where it is and is listed again 30 s later, and Gmail errors now say what Gmail actually answered.

---

## What was applied (15 Nov 2026, ~00:15 IST)

1. `rugs-mail` deployed as **v37** (see the import note above) — fixes both faults.
2. SQL: `rm_sync_tick()` (start-lock, kept only as a fallback — the cron job still calls `rugs-mail`
   directly every 30 s because v37 has its own lock) and `rm_sync_recheck()`, with cron job
   **`rm-sync-recheck` every 10 minutes**.
3. One-off: every mailbox's cursor moved back 12 hours, so anything today's skipped windows missed
   was read again (mail already saved is skipped).
4. The scratch function `rugs-mail-v37-test` was used to test the deploy and then emptied — it answers
   410 "gone" and can be deleted in Supabase → Edge Functions.

## How it was applied (keep for next time)

### A. Deploy `rugs-mail` v37  (fixes both problems)

`server/rugs-mail.index.ts` in this repo is the complete new function (built from the live v36 with
9 small changes). Deploy it as the function **rugs-mail**, either:

* **Ask Claude:** say *"you may deploy rugs-mail"* and allow the Supabase deploy when asked — Claude
  deploys this file and then checks the logs; or
* **Supabase CLI** (needs a login that can see the Rugs Creation project — the CLI on this PC is
  signed in with a different account that cannot):

  ```
  mkdir -p supabase/functions/rugs-mail
  cp server/rugs-mail.index.ts supabase/functions/rugs-mail/index.ts
  supabase login
  supabase functions deploy rugs-mail --project-ref asbgfjngxsabnnzgxugu --no-verify-jwt
  ```
  or
* **Dashboard:** Supabase → Edge Functions → rugs-mail → paste the contents of
  `server/rugs-mail.index.ts` → Deploy.

What changed (all commented in the file, search for "15 Nov 2026"):

| # | Change | Why |
|---|--------|-----|
| 1 | `DEADLINE_MS` 45 s → 25 s | one run finishes before the next 30-second tick |
| 2 | one sync at a time (`sync_lock` row, stale after 65 s) for the timer, Gmail push **and** the app's Sync | stops 3–4 copies piling up |
| 3 | a window Gmail could not list keeps the cursor and is retried (given up only after 6 hours) | **no more silently lost mail** |
| 4 | Gmail retries 4 → 3, shorter waits, body released on 429/5xx | less load, no half-read replies |
| 5 | Gmail errors say status, type, length and the first characters of the answer | so the log shows the real cause |
| 6 | a switched (Switch ID) session is not blocked by "set your own password first" | you can test and send as any user |
| 7 | mailbox note says "Gmail could not list the latest mail (Nx) - retrying" | clear status in Admin → Overview |

### B. Or, without any deploy: `server/sql/2026-11-15-rugs-email-sync.sql`

Run it in Supabase → SQL editor. It cannot fix the Switch ID block (that is in the function), but it
does stop the pile-up and re-lists the windows Gmail failed to list:

* `rm_sync_tick(55)` — the timer starts a sync only if none was started in the last 55 s
* `rm_sync_recheck()` — every 10 minutes, moves a mailbox's cursor back 2 h if it reported
  "could not list", so that window is read again (mail already saved is skipped)
* a one-off cursor rewind of 12 hours for every mailbox, to pick up anything missed today

Keeping both A and B is fine. With v37 deployed, change the timer to `select public.rm_sync_tick(30)`.

### C. Quick alternative for tonight's testing only

If you just want to test sending as other people right now and leave the deploy for later:

```sql
-- lets these people (and a switched admin session) send straight away;
-- they will NOT be asked to set their own password at first sign-in any more
update rm_users set must_change = false where id in ('ik','me','gt','vb');
```

Do this only for the IDs you are testing with — it removes the "set your own password" step for them.

---

## After applying, check

1. Supabase → Edge Functions → rugs-mail → Logs: no more "incomplete reply" / 546 within a few minutes.
2. Admin → Overview → mailbox list: every box "live", note ends with "history complete".
3. Switch ID into one person, send a test mail to marketing@ — it must go out and appear in Sent.

## Not fixed here (separate, not Rugs Email)

The `design-desk` function runs out of memory ("Memory limit exceeded") on **every** run of its
2-minute timer (`design-desk-1min` / `design-desk-files`) — hundreds of failures a day on the same
server. Worth looking at after the launch.
