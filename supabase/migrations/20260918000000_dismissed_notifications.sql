-- The notifications dropdown (AppShell) synthesizes its list live from
-- three unrelated sources each fetch (unread announcements, task_notifications
-- rows, upcoming events) rather than one persisted notifications table, so
-- there was nowhere to record "I dismissed this" - clicking a task
-- notification flipped task_notifications.is_read, but the query never
-- filtered on it, so it kept showing anyway; announcement and event entries
-- had no dismiss concept at all. One generic table, keyed by the same
-- synthetic id already used client-side (e.g. "task-notif-123"), covers all
-- three uniformly without needing a different mechanism per type.
create table if not exists public.dismissed_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_key text not null,
  dismissed_at timestamptz not null default now(),
  unique (user_id, notification_key)
);

alter table public.dismissed_notifications enable row level security;

create policy "members manage their own dismissed notifications"
on public.dismissed_notifications for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, delete on public.dismissed_notifications to authenticated;
grant all on public.dismissed_notifications to service_role;
