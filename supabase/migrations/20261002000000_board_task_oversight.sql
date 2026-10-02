-- Board (and the portal admin) can see and act on every task org-wide, as a
-- standing checkpoint - not scoped to what they personally assigned or were
-- granted as a reviewer, the way task_group_reviewers scopes everyone else.
-- Mirrors the existing "group reviewers read/update reviewed tasks" additive
-- policies (20260917120000_task_group_reviewers.sql), just without the
-- group_task_id restriction, since the base tasks policies already only
-- cover assigned_to/assigned_by and a new permissive policy is additive
-- (Postgres OR-combines permissive policies for the same command), so this
-- doesn't need to touch whatever policy already governs the rest.
create policy "board reads all tasks"
on public.tasks for select to authenticated
using (
  private.is_portal_admin()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'board_member')
);

create policy "board updates all tasks"
on public.tasks for update to authenticated
using (
  private.is_portal_admin()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'board_member')
)
with check (
  private.is_portal_admin()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'board_member')
);

-- Same oversight for status history, attachment metadata, and the private
-- attachment files - the same three spots the group-reviewer feature needed
-- (20260925000000_group_reviewers_status_history.sql,
-- 20260919120000_reviewer_attachment_access.sql), so Board can open an
-- attachment link and see "submitted on time/late" on any task, not just
-- ones they're the assigner or a granted reviewer on.
create policy "board reads status history"
on public.task_status_history for select to authenticated
using (
  private.is_portal_admin()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'board_member')
);

create policy "board reads attachment records"
on public.task_update_attachments for select to authenticated
using (
  private.is_portal_admin()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'board_member')
);

create policy "board reads task attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'task-attachments'
  and (
    private.is_portal_admin()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'board_member')
  )
);
