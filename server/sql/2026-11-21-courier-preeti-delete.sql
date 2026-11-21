-- 21 Nov 2026: Preeti (role 'rec') may delete an invoice she has approved, if it turns out to be wrong.
-- Before: role 'rec' was always refused. Admin and owner rules unchanged.
CREATE OR REPLACE FUNCTION public.cd_inv_delete(p_uid uuid, p_pin text, p_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
declare u public.cd_users; n text; s text; o uuid;
begin u:=public.cd_auth(p_uid,p_pin); if u.id is null then return jsonb_build_object('ok',false,'error','bad_login'); end if;
  select status,owner into s,o from public.cd_invoices where id=p_id;
  if s is null then return jsonb_build_object('ok',false,'error','Invoice not found'); end if;
  if u.role='rec' then
    if s<>'Approved' then return jsonb_build_object('ok',false,'error','Preeti can delete only an approved invoice. Use Reject for one that is waiting.'); end if;
  elsif u.role<>'adm' and (o<>u.id or s='Approved') then return jsonb_build_object('ok',false,'error','You can delete only your own invoice, and only before it is approved'); end if;
  delete from public.cd_invoices where id=p_id returning inv_no into n;
  insert into public.cd_log(uid,uname,action,inv_no,note) values(u.id,u.name,'delete',n,s);
  return jsonb_build_object('ok',true);
end $function$;
