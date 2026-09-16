-- File upload for task/action-item updates, mirroring the existing private
-- point-request-proof pattern (20260820065551_semester_portal_foundation.sql,
-- 20260820160000_term_groups_and_delegated_point_requests.sql): a private,
-- per-user-folder storage bucket plus a metadata table, with signed URLs
-- generated client-side rather than the bucket being public. Applies to every
-- task automatically - existing and future - since it's just a new optional
-- attachment on the same task_updates flow every task already uses.
create table if not exists public.task_update_attachments (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.task_updates(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

alter table public.task_update_attachments enable row level security;

create policy "task participants read attachment records"
on public.task_update_attachments for select to authenticated
using (
  user_id = auth.uid()
  or private.is_portal_admin()
  or exists (
    select 1
    from public.tasks task
    where task.id = task_id
      and (task.assigned_to = auth.uid() or task.assigned_by = auth.uid())
  )
);

create policy "authors attach files to their own updates"
on public.task_update_attachments for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.task_updates update_row
    where update_row.id = update_id
      and update_row.created_by = auth.uid()
      and update_row.task_id = task_id
  )
);

create policy "owners and admins remove task attachments"
on public.task_update_attachments for delete to authenticated
using (user_id = auth.uid() or private.is_portal_admin());

grant select, insert, delete on public.task_update_attachments to authenticated;
grant all on public.task_update_attachments to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "members upload their own task attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'task-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "task participants read task attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'task-attachments'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or private.is_portal_admin()
    or exists (
      select 1
      from public.task_update_attachments attachment
      join public.tasks task on task.id = attachment.task_id
      where attachment.storage_path = storage.objects.name
        and (task.assigned_to = auth.uid() or task.assigned_by = auth.uid())
    )
  )
);

create policy "members remove their own task attachments"
on storage.objects for delete to authenticated
using (
  bucket_id = 'task-attachments'
  and ((storage.foldername(name))[1] = auth.uid()::text or private.is_portal_admin())
);
