-- Let a member attach a past event to a point request so the request's
-- points and category start from that event's own settings. This is
-- informational only: the linked event never grants points by itself,
-- and an administrator can still edit the final amount and category
-- before approving.

alter table public.point_requests
  add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists point_requests_event_idx
  on public.point_requests (event_id);
