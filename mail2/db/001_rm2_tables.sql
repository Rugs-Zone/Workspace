-- Rugs Email v2 - first tables (Day 1, 28 Nov 2026)
-- DATABASE: the OFFICE Postgres behind mail-api.rugserp.com (Rugs Email left Supabase on 23 Nov).
-- NOT RUN YET. Run only after the nightly backup (E:\rugsmail-backups\backup-log.txt) is confirmed green.
-- Safe by design: creates NEW rm2_* tables only. Never ALTERs, UPDATEs or DELETEs any rm_* table.
-- Safe to run twice (IF NOT EXISTS everywhere).

begin;

-- 1. Per-person state: each person has their OWN read / flag / folder / deleted for every mail.
create table if not exists rm2_user_msg (
  user_id     text        not null,              -- rm_users.id
  mailbox     text        not null,              -- rm_messages.mailbox
  gmail_id    text        not null,              -- rm_messages.gmail_id
  folder      text        not null default 'inbox'
              check (folder in ('inbox','sent','drafts','archive','deleted','junk') or folder like 'own:%'),
  is_read     boolean     not null default false,
  flagged     boolean     not null default false,
  pinned      boolean     not null default false,
  deleted_at  timestamptz,                         -- set by Rugs Email's own Delete only, never by Gmail
  updated_at  timestamptz not null default now(),
  primary key (user_id, mailbox, gmail_id)
);
create index if not exists rm2_user_msg_folder on rm2_user_msg (user_id, folder, updated_at desc);

-- 2. Sent = mail YOU sent. Written once (at send time, or once when a Gmail-written mail is matched), never guessed again.
create table if not exists rm2_sent (
  mailbox     text        not null,
  gmail_id    text        not null,
  user_id     text        not null,
  how         text        not null check (how in ('app','gmail-login','gmail-alias')),
  sent_at     timestamptz not null,
  primary key (mailbox, gmail_id)
);
create index if not exists rm2_sent_user on rm2_sent (user_id, sent_at desc);

-- 3. The addresses / names that are "me" for each person (login, aliases). Used to match Gmail-written mail ONCE.
create table if not exists rm2_sender_alias (
  user_id     text        not null,
  kind        text        not null check (kind in ('email','name')),
  value       text        not null,                -- stored lower-case, trimmed
  primary key (kind, value)                        -- one address/name belongs to exactly one person
);

-- 4. Outbox: every send has a status stored on the server, so nothing is ever "stuck on Sending".
create table if not exists rm2_outbox (
  id          bigserial   primary key,
  user_id     text        not null,
  mailbox     text        not null,
  status      text        not null default 'queued'
              check (status in ('queued','sending','sent','failed')),
  to_addrs    text[]      not null default '{}',
  cc_addrs    text[]      not null default '{}',
  bcc_addrs   text[]      not null default '{}',
  subject     text        not null default '',
  body_html   text        not null default '',
  reply_to_gmail_id text,
  attempts    int         not null default 0,
  last_error  text,
  send_after  timestamptz not null default now(),  -- Send later / Undo send window
  started_at  timestamptz,                         -- when 'sending' began (watchdog uses this)
  gmail_id    text,                                -- filled when Gmail accepts it
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists rm2_outbox_work on rm2_outbox (status, send_after) where status in ('queued','sending');

commit;
