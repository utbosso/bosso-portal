-- A granted reviewer (task_group_reviewers, 20260917120000) can already see
-- Team progress, submissions, and approve work for their group - but the
-- attachment metadata table and the private storage bucket backing file
-- uploads on task updates only ever checked task.assigned_to/assigned_by
-- directly, with no idea task_group_reviewers exists. A reviewer could see
-- that a file was attached but the signed URL request (and the metadata
-- lookup behind it) came back empty, so the link only ever worked for the
-- task's literal assigner.
create policy "group reviewers read attachment records"
on public.task_update_attachments for select to authenticated
using (
  exists (
    select 1
    from public.tasks task
    join public.task_group_reviewers reviewer on reviewer.group_task_id = task.group_task_id
    where task.id = task_id
      and reviewer.reviewer_id = auth.uid()
  )
);

create policy "group reviewers read task attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'task-attachments'
  and exists (
    select 1
    from public.task_update_attachments attachment
    join public.tasks task on task.id = attachment.task_id
    join public.task_group_reviewers reviewer on reviewer.group_task_id = task.group_task_id
    where attachment.storage_path = storage.objects.name
      and reviewer.reviewer_id = auth.uid()
  )
);
