-- 21 Nov 2026: on request, wipe the Google Sheets copies used by PPC (and Dispatch / Purchase / BOM /
-- Outsourcing / Gate / One Entry / Vinay Sir MIS) and stop the 10-minute SupabaseSync.gs from refilling them.
-- Google Sheets themselves are untouched.
create or replace function public.ppc_sync_block() returns trigger language plpgsql as $$ begin return null; end $$;
create trigger ppc_sync_block_trg before insert or update on public.ppc_sheets       for each row execute function public.ppc_sync_block();
create trigger ppc_sync_block_trg before insert or update on public.ppc_sheet_chunks for each row execute function public.ppc_sync_block();
delete from public.ppc_sheet_chunks;  -- 110 rows
delete from public.ppc_sheets;        -- 23 rows

-- TO UNDO (let the sync fill them again within 10 minutes):
-- drop trigger ppc_sync_block_trg on public.ppc_sheets;
-- drop trigger ppc_sync_block_trg on public.ppc_sheet_chunks;
