-- Rugs Email — 15 Nov 2026 — server safety net for the Gmail sync
-- Run this in Supabase → SQL editor (project "Rugs Creation", asbgfjngxsabnnzgxugu).
--
-- WHY
-- The sync is started from three places: the 30-second timer (cron job "rugs-mail-1min"), Gmail push
-- (rugs-mail-push) and the app's own Sync. Each run takes 45-55 seconds in rugs-mail v36, so 3-4 copies
-- were always running on top of each other. Gmail then answers with broken replies
-- ("Gmail sent an incomplete reply", 674 times for one mailbox alone on 14-15 Nov) and the server runs out
-- of resources (HTTP 546, 181 times). Worse: in v36, when Gmail fails to list a time window, that window is
-- marked done and the cursor moves past it - so mail that arrived in those minutes is never fetched.
--
-- WHAT THIS DOES
--   rm_sync_tick(gap)  - starts a sync only if none was started in the last `gap` seconds (default 55).
--   rm_sync_recheck()  - moves the cursor of a mailbox that reported "could not list" back 2 hours,
--                        so the window Gmail failed to list is listed again. Mail already saved is skipped.
--
-- AFTER rugs-mail v37 IS DEPLOYED both are optional (v37 has its own one-at-a-time lock and retries the
-- window itself). They are harmless to keep; with v37 use a smaller gap: select public.rm_sync_tick(30).

create or replace function public.rm_sync_tick(p_gap_seconds integer default 55) returns text
language plpgsql security definer set search_path = public, net as $$
declare taken boolean;
begin
  insert into public.rm_settings(key, value, updated_at)
  values ('sync_tick', '{}'::jsonb, to_timestamp(0))
  on conflict (key) do nothing;

  update public.rm_settings
     set updated_at = now()
   where key = 'sync_tick'
     and updated_at < now() - make_interval(secs => p_gap_seconds)
  returning true into taken;

  if not coalesce(taken, false) then
    return 'skipped - a sync is still running';
  end if;

  perform net.http_post(
    url := 'https://asbgfjngxsabnnzgxugu.supabase.co/functions/v1/rugs-mail',
    body := jsonb_build_object('action', 'cron',
                               'cron_key', (select value #>> '{}' from public.rm_settings where key = 'cron_key')),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 60000);
  return 'started';
end $$;

create or replace function public.rm_sync_recheck() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with fix as (
    update public.rm_mailboxes
       set cursor_s = greatest(cursor_s - 7200, extract(epoch from now())::bigint - 43200)
     where note ilike '%could not list%'
       and cursor_s > extract(epoch from now())::bigint - 43200
    returning mailbox
  )
  select count(*) into n from fix;
  return n;
end $$;

-- the 30-second timer now goes through the lock instead of calling rugs-mail directly
select cron.alter_job((select jobid from cron.job where jobname = 'rugs-mail-1min'),
                      command => 'select public.rm_sync_tick(55)');

-- re-list windows Gmail could not list, every 10 minutes
select cron.schedule('rm-sync-recheck', '*/10 * * * *', 'select public.rm_sync_recheck()');

-- one-off: pick up anything today's skipped windows missed (safe - mail already saved is skipped)
update public.rm_mailboxes
   set cursor_s = extract(epoch from now())::bigint - 43200
 where cursor_s > extract(epoch from now())::bigint - 43200;
