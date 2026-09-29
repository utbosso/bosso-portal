-- private.get_total_storage_bytes() (from the previous migration) is never
-- reachable via supabase-js's admin.rpc(...) - Supabase's PostgREST layer
-- only exposes functions sitting in the public schema for RPC calls; the
-- "private" schema convention elsewhere in this project (e.g.
-- private.is_portal_admin()) only works because those functions are called
-- from inside SQL (RLS policies), never through the HTTP RPC endpoint.
-- Recreate it in public - the revoke/grant below is what actually restricts
-- who can call it, not which schema it lives in.
drop function if exists private.get_total_storage_bytes();

create or replace function public.get_total_storage_bytes()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)::bigint from storage.objects;
$$;

revoke all on function public.get_total_storage_bytes() from public;
grant execute on function public.get_total_storage_bytes() to service_role;
