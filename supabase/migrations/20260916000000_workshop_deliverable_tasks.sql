-- Workshops now split their 2 points into 1.5 for showing up + 0.5 for a
-- deliverable due after the workshop (src/lib/bosso-points.ts). The
-- deliverable is a Task auto-created for whoever checks in, requiring
-- ordinary manual review/approval like any other task - not auto-approved.
--
-- point_value/points_earned columns predate this and may be integer from
-- their original setup; widen them to numeric so 1.5/0.5 don't get rounded
-- away. Safe/idempotent either way - a numeric column stays numeric.
alter table public.events alter column point_value type numeric(6,2) using point_value::numeric;
alter table public.tasks alter column point_value type numeric(6,2) using point_value::numeric;
alter table public.attendance_records alter column points_earned type numeric(6,2) using points_earned::numeric;

-- Per-event deliverable configuration. Null deliverable_point_value means no
-- deliverable is configured for this event (the common case - most events
-- aren't workshops with a follow-up deliverable).
alter table public.events
  add column if not exists deliverable_title text,
  add column if not exists deliverable_description text,
  add column if not exists deliverable_point_value numeric(6,2),
  add column if not exists deliverable_due_at timestamptz;
