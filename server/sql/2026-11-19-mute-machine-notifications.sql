-- 19 Nov 2026 — "close the notification / reminder for the PPC dashboard, Follow-up report,
-- Merchant dashboard, Order Master, Circular knitted, Jacquard and VDW dashboards; from now on no
-- notification or delegation goes out from these things."
--
-- What was found first (every kind of notice that exists, from rz_msg_settings.rules):
--   om_late         Order Master / PPC "Late orders today: N overdue, N purple (your SKUs)" (daily 09:45 IST)
--   agent_brief     the follow-up / CEO agent's daily brief
--   agent_task      a delegation the agent makes by itself
--   quality_alert   "Quality: N lot(s) waiting over 2 hr"
--   checklist_flag  "Checklist issue · <person> · <block>"
--   sampling_digest "Sampling: N things waiting for you"
--   task_overdue    "N tasks are past the deadline" (daily digest)
--   -- and the ones a PERSON writes, which are untouched:
--   task_new, leave, courier, query, help_slip, todo, buyer_visit, general, sampling
-- The Merchant dashboard, Circular Knitted, Jacquard and VDW dashboards have no notice of their own
-- (they are views) — nothing is sent from them.
--
-- The user chose: switch off EVERY machine-made notice, and stop the jobs that make them.
--
-- 1. ONE list, in deleg_meta. To let one back in, take its word out of this list — nothing else.
insert into public.deleg_meta(key, value, updated_at)
values ('notif_muted',
        '["om_late","agent_brief","agent_task","quality_alert","checklist_flag","sampling_digest","task_overdue"]'::jsonb,
        now())
on conflict (key) do update set value = excluded.value, updated_at = now();

-- 2. ONE gate, in front of the notification table, so it does not matter which module or edge
--    function writes the notice: a muted kind is never created, so there is no bell, and the
--    WhatsApp/SMS trigger (trg_rz_msg_from_notification, AFTER INSERT) never runs either.
create or replace function public.rz_notif_gate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare muted jsonb;
begin
  select value into muted from public.deleg_meta where key = 'notif_muted';
  if muted is not null and jsonb_typeof(muted) = 'array' and muted ? coalesce(new.type,'') then
    return null;
  end if;
  return new;
end $$;

drop trigger if exists trg_rz_notif_gate on public.deleg_notifications;
create trigger trg_rz_notif_gate
before insert on public.deleg_notifications
for each row execute function public.rz_notif_gate();

-- 3. Belt and braces: the WhatsApp / SMS rules for those kinds are off as well.
update public.rz_msg_settings
set value = value
  || jsonb_build_object('om_late',        jsonb_build_object('wa',false,'sms',false))
  || jsonb_build_object('agent_brief',    jsonb_build_object('wa',false,'sms',false))
  || jsonb_build_object('agent_task',     jsonb_build_object('wa',false,'sms',false))
  || jsonb_build_object('quality_alert',  jsonb_build_object('wa',false,'sms',false))
  || jsonb_build_object('checklist_flag', jsonb_build_object('wa',false,'sms',false))
  || jsonb_build_object('sampling_digest',jsonb_build_object('wa',false,'sms',false))
  || jsonb_build_object('task_overdue',   jsonb_build_object('wa',false,'sms',false))
where key = 'rules';

-- 4. Stop the work being done at all (the user asked for this, not only for the messages to stop).
--    Reversible: cron.alter_job(<id>, active := true).
select cron.alter_job(4,  active := false);   -- order-master-late-alert  (Order Master / PPC late alert)
select cron.alter_job(6,  active := false);   -- agents-hourly            (follow-up agent: brief + automatic delegations)
select cron.alter_job(11, active := false);   -- rz-task-overdue-digest   (deadline reminder digest)
-- NOT touched on purpose: sampling-step-overdue (it creates Sampling FMS's own work items, and
-- Sampling was not on the list) — only its notice is muted by the list above.
