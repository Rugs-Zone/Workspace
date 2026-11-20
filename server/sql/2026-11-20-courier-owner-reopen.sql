-- 20 Nov 2026: the invoice's own maker may reopen (Edit) an approved invoice, not only admins.
CREATE OR REPLACE FUNCTION public.cd_inv_reopen(p_uid uuid, p_pin text, p_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
declare u public.cd_users; v_row public.cd_invoices; v_owner uuid;
begin u:=public.cd_auth(p_uid,p_pin); if u.id is null then return jsonb_build_object('ok',false,'error','bad_login'); end if;
  select owner into v_owner from public.cd_invoices where id=p_id;
  if not found then return jsonb_build_object('ok',false,'error','Not found'); end if;
  if u.role<>'adm' and v_owner is distinct from u.id then return jsonb_build_object('ok',false,'error','You can edit only your own invoices.'); end if;
  update public.cd_invoices set status='Draft',emp_sig=null,appr_by=null,appr_name=null,appr_at=null,appr_sig=null,appr_admin=null,locked_at=null,locked_by=null,rec_locked_at=null,rec_locked_by=null,updated_at=now() where id=p_id returning * into v_row;
  insert into public.cd_log(uid,uname,action,inv_no) values(u.id,u.name,'reopen',v_row.inv_no);
  return jsonb_build_object('ok',true,'row',to_jsonb(v_row)-'emp_sig'-'appr_sig');
end $function$;
