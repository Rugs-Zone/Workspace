# Rugs Email — database schema (Supabase project asbgfjngxsabnnzgxugu)

Updated 14 Nov 2026. All tables have RLS on with no client policies; only the edge functions (service role) read and write them.

## Tables

| Table | Columns | Notes |
|---|---|---|
| `rm_departments` | id, name, mailbox, color, created_at, track_from | One shared Gmail mailbox per team. `track_from` = work tracking / auto-assign start (null = not active). |
| `rm_users` | id, name, login, pass_hash, dept_id, role, active, perm (jsonb), access (jsonb), profile, signature, on_leave, created_at, must_change, prefs | role: Admin, Manager, CRM, Merchandiser, Executive. See `perm` keys below. |
| `rm_threads` | mailbox, gmail_thread_id, subject, snippet, counterpart_email, counterpart_name, msg_count, last_msg_at, has_in, has_out, unread, owner_id, status, promise, due_at, topic, topic_ai, topic_conf, topic_checked, flagged, folder, prev_folder, updated_at, dept_id, done_at, first_reply_at, pinned, snooze_until, remind_at, cats, ooo_sent, rules_checked, **to_addrs text[]**, **for_owner text** | One row per conversation. `to_addrs` = every To / Cc / Delivered-To address of the conversation (newest mail first, max 40). `for_owner` = the person the thread was meant for when it was handed over because they were on leave. |
| `rm_messages` | mailbox, gmail_id, gmail_thread_id, direction, from_email, from_name, to_text, cc_text, subject, snippet, body_text, body_html, sent_at, sent_by, has_attachments, attachments, labels, rfc_message_id, drive_status, drive_files, list_unsub, drive_tries, **delivered_to text** | One row per mail. direction "out" = the mailbox or anyone @rugscreation.com. `delivered_to` = Delivered-To / X-Original-To headers. |
| `rm_activity` | id, mailbox, gmail_thread_id, user_id, kind, text, at | History lines (assign, send, rule, note …). |
| `rm_mailboxes` | mailbox, cursor_s, back_s, status, last_sync, note, history_id | Gmail sync progress per mailbox; `history_id` for the Gmail History API. |
| `rm_settings` | key, value, updated_at | Shared lists and switches: rules, blocked, cats, folders, templates, circulars, history_days, gmail_write_boxes, live_at, cron_key … |
| `rm_sessions` | user_id, token_hash, created_at, expires_at, switched_by | Sign-in sessions (sha256 of the token only). |
| `rm_login_attempts` | login, fails, last_fail_at, locked_until | 5 wrong passwords = 15-minute lock. |
| `rm_scheduled` | id, user_id, mailbox, payload, send_at, status, error, created_at, sent_at | Send later. |
| `rm_presence` | mailbox, gmail_thread_id, user_id, at | "Someone is replying" warning. |
| `rm_drive_folders` | mailbox, key, folder_id, created_at | Drive folders for attachment copies. |

## `rm_users.perm` keys

| Key | Meaning |
|---|---|
| assign, transfer, delete, dashboards, buddy | 0/1 switches (Admin → Users). |
| domains | "ikea.com, kmart.com.au" — buyer domains auto-assigned to this person. |
| aliases | "merchandiser4@rugscreation.com" — extra addresses that reach this person (Admin → Users → Aliases). Their own login always counts. |
| crm_depts | ["alpha", …] — this person is the CRM ("To assign") for these teams (Priya: every team except Shipping). |

## Auto-assign (cron `rm-alias-assign`, every 5 minutes, in this order)

Only unassigned, open Inbox mail of the last 2 days, in teams whose work tracking is active.

1. `rm_alias_assign()` — `to_addrs` contains a team member's login or alias (not the team mailbox itself).
2. `rm_domain_assign()` — sender's domain is in a team member's `perm.domains`.
3. `rm_name_assign()` — the latest incoming mail starts "Hi / Dear / Hello <first name>".
4. `rm_trail_assign()` — whoever last replied in the conversation from our side.
5. `rm_buddy_assign()` — CRM and Manager both on leave: the team's buddy / a merchandiser.

Rules 1–4 assign through `rm_auto_give()`, which applies the **leave rule** (`rm_leave_target()`):

1. If the owner is on leave, the Manager of the same team gets it, if the Manager is in.
2. If the Manager is also on leave, the least busy teammate who is in gets it.
3. If the whole team is on leave, it stays unassigned for the CRM.

A handed-over thread keeps `for_owner` and shows the tag "for <name> (on leave)".

Helper functions: `rm_addrs(text)`, `rm_open_count(user)`, `rm_greet_name(text)`, `rm_kw_topic(text)`.

**Personal mail rules (R35, 27 Nov 2026)** — `rm_users.prefs.mr35`: an array of `{id, by, name, on, stop, c:{from,dom,sub,to,att}, a:{move,topic,flag,read}}` on the person’s own row, written only through the `savePrefs` action, which updates the signed-in user’s row and no other (so a person can read and write only their own rules). A rule is never written to `rm_threads` or `rm_messages`: it is applied as a filter in that person’s own browser, so no rule can move mail for the team.

