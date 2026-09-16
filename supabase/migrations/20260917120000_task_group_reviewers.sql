-- Lets a task's own assigner (and only the assigner) grant specific other
-- people read + review access to an entire task group - Team progress, every
-- assignee's updates, and the ability to approve - without opening that up
-- to every project_manager+ the way an earlier version of this feature did.
create table if not exists public.task_group_reviewers (
  id uuid primary key default gen_random_uuid(),
  group_task_id uuid not null,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_task_id, reviewer_id)
);

alter table public.task_group_reviewers enable row level security;

create policy "assigners and reviewers read reviewer records"
on public.task_group_reviewers for select to authenticated
using (
  reviewer_id = auth.uid()
  or added_by = auth.uid()
  or private.is_portal_admin()
);

create policy "only the group's real assigner adds reviewers"
on public.task_group_reviewers for insert to authenticated
with check (
  added_by = auth.uid()
  and exists (
    select 1 from public.tasks task
    where task.group_task_id = task_group_reviewers.group_task_id
      and task.assigned_by = auth.uid()
  )
);

create policy "assigners remove reviewers they added"
on public.task_group_reviewers for delete to authenticated
using (added_by = auth.uid() or private.is_portal_admin());

grant select, insert, delete on public.task_group_reviewers to authenticated;
grant all on public.task_group_reviewers to service_role;

-- Additive policies (Postgres OR-combines multiple permissive policies for
-- the same command) so an added reviewer can read and act on every task row
-- in a group they were granted, without touching whatever policy already
-- governs assigned_to/assigned_by access on this table.
create policy "group reviewers read reviewed tasks"
on public.tasks for select to authenticated
using (
  group_task_id is not null
  and exists (
    select 1 from public.task_group_reviewers reviewer
    where reviewer.group_task_id = tasks.group_task_id
      and reviewer.reviewer_id = auth.uid()
  )
);

create policy "group reviewers update reviewed tasks"
on public.tasks for update to authenticated
using (
  group_task_id is not null
  and exists (
    select 1 from public.task_group_reviewers reviewer
    where reviewer.group_task_id = tasks.group_task_id
      and reviewer.reviewer_id = auth.uid()
  )
)
with check (
  group_task_id is not null
  and exists (
    select 1 from public.task_group_reviewers reviewer
    where reviewer.group_task_id = tasks.group_task_id
      and reviewer.reviewer_id = auth.uid()
  )
);
