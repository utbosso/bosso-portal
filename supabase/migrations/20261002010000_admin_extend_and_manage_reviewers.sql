-- Lets the portal admin (internal@txbosso.com) use "Extend to more people"
-- and "Manage reviewers" on any task, not just ones they created - unlike
-- Board, scoped to admin specifically for now.
--
-- "Extend to more people" inserts new per-person task rows with the
-- ORIGINAL assigner's id (assigned_by), not the admin's own id, so the
-- existing "admin bypass" baked into most of this app's policies doesn't
-- automatically cover it if the base tasks insert policy requires
-- assigned_by = auth.uid() (likely, though it predates this migrations
-- folder so it can't be checked directly) - this policy guarantees it
-- regardless.
create policy "admin inserts tasks for anyone"
on public.tasks for insert to authenticated
with check (private.is_portal_admin());

-- task_group_reviewers' own insert policy
-- (20260917120000_task_group_reviewers.sql, "only the group's real assigner
-- adds reviewers") has no admin bypass, unlike its select/delete policies -
-- an oversight from when that feature was first built.
create policy "admin adds reviewers to any group"
on public.task_group_reviewers for insert to authenticated
with check (private.is_portal_admin());
