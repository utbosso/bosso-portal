-- Lets the server compute total Supabase Storage usage (across every
-- bucket, since the plan's cap is project-wide) without needing to
-- paginate through every bucket's object list from the app. service_role
-- only - this reads storage.objects directly, which the app should never
-- need to do on behalf of an ordinary member.
create or replace function private.get_total_storage_bytes()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)::bigint from storage.objects;
$$;

revoke all on function private.get_total_storage_bytes() from public;
grant execute on function private.get_total_storage_bytes() to service_role;

-- Single-row table tracking the last storage-usage level we alerted on
-- (ok/warn/critical/full), so the app only emails internal@txbosso.com when
-- usage newly crosses into a more severe level - not on every upload after
-- that point, and again if usage drops back down and later re-crosses it.
create table if not exists public.storage_usage_state (
  id int primary key default 1 check (id = 1),
  last_level text not null default 'ok' check (last_level in ('ok', 'warn', 'critical', 'full')),
  updated_at timestamptz not null default now()
);
insert into public.storage_usage_state (id) values (1) on conflict (id) do nothing;

alter table public.storage_usage_state enable row level security;
grant all on public.storage_usage_state to service_role;
