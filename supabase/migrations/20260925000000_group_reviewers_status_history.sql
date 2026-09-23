-- Group reviewers (task_group_reviewers) can already read and act on tasks
-- in a group they were granted, via an additive policy on public.tasks -
-- but task_status_history only ever let the direct assignee/assigner read
-- it, so a reviewer's "submitted on time vs late" lookup (which reads this
-- table) came back empty for anything they only review, not own.
create policy "group reviewers read status history"
on public.task_status_history for select to authenticated
using (
  exists (
    select 1 from public.tasks task
    join public.task_group_reviewers reviewer on reviewer.group_task_id = task.group_task_id
    where task.id = task_status_history.task_id
      and reviewer.reviewer_id = auth.uid()
  )
);
